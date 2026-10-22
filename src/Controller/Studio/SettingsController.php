<?php

/*
 * This source file is available under two different licenses:
 *   - GNU General Public License version 3 (GPLv3)
 *   - DACHCOM Commercial License (DCL)
 * Full copyright and license information is available in
 * LICENSE.md which is distributed with this source code.
 *
 * @copyright  Copyright (c) DACHCOM.DIGITAL AG (https://www.dachcom-digital.com)
 * @license    GPLv3 and DCL
 */

namespace FormBuilderBundle\Controller\Studio;

use Doctrine\ORM\Tools\Pagination\Paginator;
use FormBuilderBundle\Builder\ExtJsFormBuilder;
use FormBuilderBundle\Configuration\Configuration;
use FormBuilderBundle\Manager\DoubleOptInManager;
use FormBuilderBundle\Manager\FormDefinitionManager;
use FormBuilderBundle\Manager\PresetManager;
use FormBuilderBundle\Model\DoubleOptInSessionInterface;
use FormBuilderBundle\Model\FormDefinitionInterface;
use FormBuilderBundle\Registry\ChoiceBuilderRegistry;
use FormBuilderBundle\Registry\DataInjectionRegistry;
use FormBuilderBundle\Repository\DoubleOptInSessionRepositoryInterface;
use FormBuilderBundle\Tool\FormDependencyLocator;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;
use Symfony\Component\Serializer\Normalizer\NormalizerInterface;
use Symfony\Component\Serializer\SerializerInterface;

final class SettingsController extends AbstractFormBuilderStudioController
{
    public function __construct(
        SerializerInterface $serializer,
        private readonly Configuration $configuration,
        private readonly FormDefinitionManager $formDefinitionManager,
        private readonly DoubleOptInManager $doubleOptInManager,
        private readonly ExtJsFormBuilder $formConfigBuilder,
        private readonly ChoiceBuilderRegistry $choiceBuilderRegistry,
        private readonly FormDependencyLocator $formDependencyLocator,
        private readonly DoubleOptInSessionRepositoryInterface $doubleOptInSessionRepository,
    ) {
        parent::__construct($serializer);
    }

    #[Route('/formbuilder/forms/tree', name: 'formbuilder_studio_api_forms_tree', methods: ['GET'])]
    #[IsGranted('formbuilder_permission_settings')]
    public function getTree(): JsonResponse
    {
        $items = [];
        $groups = [];

        foreach ($this->formDefinitionManager->getAll() as $form) {
            $node = [
                'id'   => (int) $form->getId(),
                'name' => $form->getName(),
                'type' => 'form',
            ];

            $group = $form->getGroup();

            if ($group === null) {
                $items[] = $node;

                continue;
            }

            if (!isset($groups[$group])) {
                $groups[$group] = count($items);
                $items[] = [
                    'id'       => $group,
                    'name'     => $group,
                    'type'     => 'group',
                    'children' => [],
                ];
            }

            $items[$groups[$group]]['children'][] = $node;
        }

        return $this->json($items);
    }

    #[Route('/formbuilder/settings', name: 'formbuilder_studio_api_settings', methods: ['GET'])]
    #[IsGranted('formbuilder_permission_settings')]
    public function getSettings(): JsonResponse
    {
        $settings = $this->configuration->getConfigArray();
        $honeypotFieldName = $settings['spam_protection']['honeypot']['field_name'];
        $settings['forbidden_form_field_names'] = array_merge(Configuration::INVALID_FIELD_NAMES, [$honeypotFieldName]);

        return $this->json(['settings' => $settings]);
    }

    #[Route('/formbuilder/dynamic-choice-builder', name: 'formbuilder_studio_api_dynamic_choice_builder', methods: ['GET'])]
    #[IsGranted('formbuilder_permission_settings')]
    public function getDynamicChoiceBuilder(): JsonResponse
    {
        $data = [];
        foreach ($this->choiceBuilderRegistry->getAll() as $identifier => $service) {
            $data[] = ['label' => $service['label'], 'value' => $identifier];
        }

        return $this->json($data);
    }

    #[Route('/formbuilder/forms/{id}', name: 'formbuilder_studio_api_forms_get', requirements: ['id' => '\d+'], methods: ['GET'])]
    #[IsGranted('formbuilder_permission_settings')]
    public function getForm(int $id): JsonResponse
    {
        $form = $this->formDefinitionManager->getById($id);

        if (!$form instanceof FormDefinitionInterface) {
            return $this->errorResponse(sprintf('No form for id %d found.', $id), JsonResponse::HTTP_NOT_FOUND);
        }

        try {
            return $this->json(['data' => $this->formConfigBuilder->generateExtJsForm($form)]);
        } catch (\Throwable $e) {
            return $this->errorResponse($e->getMessage());
        }
    }

    #[Route('/formbuilder/forms', name: 'formbuilder_studio_api_forms_add', methods: ['POST'])]
    #[IsGranted('formbuilder_permission_settings')]
    public function addForm(Request $request): JsonResponse
    {
        $name = $this->getSaveName((string) ($this->getPayload($request)['name'] ?? ''));

        if ($name === '') {
            return $this->errorResponse('Form name must not be empty.');
        }

        try {
            $existingForm = $this->formDefinitionManager->getIdByName($name);
        } catch (\Exception) {
            $existingForm = null;
        }

        if ($existingForm instanceof FormDefinitionInterface) {
            return $this->errorResponse(sprintf('Form with name "%s" already exists!', $name), JsonResponse::HTTP_CONFLICT);
        }

        try {
            $formDefinition = $this->formDefinitionManager->save(['form_name' => $name]);
        } catch (\Exception $e) {
            return $this->errorResponse(sprintf('Error while creating new form with name "%s". Error was: %s', $name, $e->getMessage()), JsonResponse::HTTP_INTERNAL_SERVER_ERROR);
        }

        return $this->json(['id' => $formDefinition?->getId(), 'name' => $name], JsonResponse::HTTP_CREATED);
    }

    #[Route('/formbuilder/forms/{id}', name: 'formbuilder_studio_api_forms_save', requirements: ['id' => '\d+'], methods: ['PUT'])]
    #[IsGranted('formbuilder_permission_settings')]
    public function saveForm(Request $request, int $id): JsonResponse
    {
        $formDefinition = $this->formDefinitionManager->getById($id);

        if (!$formDefinition instanceof FormDefinitionInterface) {
            return $this->errorResponse(sprintf('No form for id %d found.', $id), JsonResponse::HTTP_NOT_FOUND);
        }

        $payload = $this->getPayload($request);
        $storedFormName = $formDefinition->getName();

        $formConfig = $this->decodeStructure($payload['config'] ?? null);
        $formFields = $this->decodeStructure($payload['fields'] ?? null);
        $formConditionalLogic = $this->decodeStructure($payload['conditionalLogic'] ?? null);

        if (isset($formConditionalLogic['cl'])) {
            $formConditionalLogic = $formConditionalLogic['cl'];
        }

        $formName = (string) ($formConfig['name'] ?? $storedFormName);
        $formGroup = (string) ($formConfig['group'] ?? '');

        if ($formName !== $storedFormName) {
            try {
                $existingForm = $this->formDefinitionManager->getIdByName($formName);
            } catch (\Exception) {
                $existingForm = null;
            }

            if ($existingForm instanceof FormDefinitionInterface) {
                return $this->errorResponse(sprintf('Form with name "%s" already exists!', $formName), JsonResponse::HTTP_CONFLICT);
            }

            $formName = $this->getSaveName($formName);
            $this->formDefinitionManager->rename($id, $formName);
        }

        $data = [
            'form_name'              => $formName,
            'form_group'             => $formGroup,
            'form_config'            => $formConfig,
            'form_fields'            => $this->formConfigBuilder->generateStoreFields($formFields),
            'form_conditional_logic' => $this->formConfigBuilder->generateConditionalLogicStoreFields($formConditionalLogic),
        ];

        try {
            $formDefinition = $this->formDefinitionManager->save($data, $id);
        } catch (\Exception $e) {
            return $this->errorResponse(sprintf('Error while saving form with id %d. Error was: %s', $id, $e->getMessage()), JsonResponse::HTTP_INTERNAL_SERVER_ERROR);
        }

        return $this->json([
            'id'   => $id,
            'name' => $formDefinition?->getName() ?? $formName,
        ]);
    }

    #[Route('/formbuilder/forms/{id}', name: 'formbuilder_studio_api_forms_delete', requirements: ['id' => '\d+'], methods: ['DELETE'])]
    #[IsGranted('formbuilder_permission_settings')]
    public function deleteForm(int $id): JsonResponse
    {
        try {
            $this->formDefinitionManager->delete($id);
        } catch (\Exception $e) {
            return $this->errorResponse(sprintf('Error while deleting form with id %d. Error was: %s', $id, $e->getMessage()), JsonResponse::HTTP_INTERNAL_SERVER_ERROR);
        }

        return $this->json(['id' => $id]);
    }

    #[Route('/formbuilder/group-templates', name: 'formbuilder_studio_api_group_templates', methods: ['GET'])]
    #[IsGranted('formbuilder_permission_settings')]
    public function getGroupTemplates(): JsonResponse
    {
        $areaConfig = $this->configuration->getConfig('area');

        $templates = [['key' => null, 'label' => '--']];

        foreach ($areaConfig['group_templates'] ?? [] as $configName => $element) {
            $templates[] = ['key' => $configName, 'label' => $element['niceName']];
        }

        return $this->json($templates);
    }

    #[Route('/formbuilder/forms/{id}/dependencies', name: 'formbuilder_studio_api_forms_dependencies', requirements: ['id' => '\d+'], methods: ['GET'])]
    #[IsGranted('formbuilder_permission_settings')]
    public function findFormDependencies(Request $request, int $id): JsonResponse
    {
        $offset = max(0, $request->query->getInt('offset', 0));
        $limit = max(1, $request->query->getInt('limit', 25));

        try {
            $data = $this->formDependencyLocator->findDocumentDependencies($id, $offset, $limit);
        } catch (\Exception) {
            $data = [];
        }

        return $this->json([
            'documents' => $data['documents'] ?? [],
            'limit'     => $limit,
            'total'     => $data['total'] ?? 0,
        ]);
    }

    #[Route('/formbuilder/presets/{name}/description', name: 'formbuilder_studio_api_preset_description', methods: ['GET'])]
    #[IsGranted('formbuilder_permission_settings')]
    public function getPresetDescription(PresetManager $presetManager, string $name): JsonResponse
    {
        return $this->json(['previewData' => $presetManager->getDataForPreview($name)]);
    }

    #[Route('/formbuilder/data-injection-store', name: 'formbuilder_studio_api_data_injection_store', methods: ['GET'])]
    #[IsGranted('formbuilder_permission_settings')]
    public function getDataInjectionStore(DataInjectionRegistry $dataInjectionRegistry): JsonResponse
    {
        $store = [];

        foreach ($dataInjectionRegistry->getAll() as $identifier => $service) {
            $store[] = [
                'value'       => $identifier,
                'label'       => $service->getName(),
                'description' => $service->getDescription(),
            ];
        }

        return $this->json(['store' => $store]);
    }

    #[Route('/formbuilder/forms/{id}/double-opt-in/sessions', name: 'formbuilder_studio_api_double_opt_in_sessions', requirements: ['id' => '\d+'], methods: ['GET'])]
    #[IsGranted('formbuilder_permission_settings')]
    public function getDoubleOptInSessions(Request $request, int $id): JsonResponse
    {
        $offset = max(0, $request->query->getInt('offset', 0));
        $limit = max(1, $request->query->getInt('limit', 25));

        $qb = $this->doubleOptInSessionRepository->getQueryBuilder();

        $qb->where('s.formDefinition = :formDefinition');
        $qb->setParameter('formDefinition', $id);
        $qb->setMaxResults($limit);
        $qb->setFirstResult($offset);

        $paginator = new Paginator($qb);

        return $this->json([
            'total'    => $paginator->count(),
            'sessions' => $this->serializer instanceof NormalizerInterface
                ? $this->serializer->normalize(iterator_to_array($paginator->getIterator()), 'array', ['groups' => ['ExtJs']])
                : [],
        ]);
    }

    #[Route('/formbuilder/double-opt-in/sessions/{token}', name: 'formbuilder_studio_api_double_opt_in_session_delete', methods: ['DELETE'])]
    #[IsGranted('formbuilder_permission_settings')]
    public function deleteDoubleOptInSession(string $token): JsonResponse
    {
        $session = $this->doubleOptInSessionRepository->find($token);

        if (!$session instanceof DoubleOptInSessionInterface) {
            return $this->errorResponse(sprintf('Session %s not found', $token), JsonResponse::HTTP_NOT_FOUND);
        }

        $this->doubleOptInManager->deleteDoubleOptInSession($session);

        return $this->json(['token' => $token]);
    }

    private function getSaveName(string $name): string
    {
        return (string) preg_replace('/[^A-Za-z0-9aäüöÜÄÖß \-]/', '', $name);
    }
}
