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

use FormBuilderBundle\Builder\ExtJsFormBuilder;
use FormBuilderBundle\Form\Admin\Type\OutputWorkflow\OutputWorkflowType;
use FormBuilderBundle\Manager\FormDefinitionManager;
use FormBuilderBundle\Manager\OutputWorkflowManager;
use FormBuilderBundle\Model\FormDefinitionInterface;
use FormBuilderBundle\Model\OutputWorkflowInterface;
use Symfony\Component\Form\FormFactoryInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;
use Symfony\Component\Serializer\SerializerInterface;

final class OutputWorkflowController extends AbstractFormBuilderStudioController
{
    public function __construct(
        SerializerInterface $serializer,
        private readonly FormFactoryInterface $formFactory,
        private readonly FormDefinitionManager $formDefinitionManager,
        private readonly OutputWorkflowManager $outputWorkflowManager,
        private readonly ExtJsFormBuilder $formConfigBuilder,
    ) {
        parent::__construct($serializer);
    }

    #[Route('/formbuilder/forms/{formId}/output-workflows/tree', name: 'formbuilder_studio_api_output_workflows_tree', requirements: ['formId' => '\d+'], methods: ['GET'])]
    #[IsGranted('formbuilder_permission_settings')]
    public function getOutputWorkflowTree(int $formId): JsonResponse
    {
        $formDefinition = $this->formDefinitionManager->getById($formId);

        if (!$formDefinition instanceof FormDefinitionInterface || !$formDefinition->hasOutputWorkflows()) {
            return $this->json([]);
        }

        $items = [];
        foreach ($formDefinition->getOutputWorkflows() as $outputWorkflow) {
            $items[] = [
                'id'          => $outputWorkflow->getId(),
                'name'        => $outputWorkflow->getName(),
                'type'        => 'output_workflow',
                'funnelAware' => $outputWorkflow->isFunnelWorkflow(),
            ];
        }

        return $this->json($items);
    }

    #[Route('/formbuilder/forms/{formId}/output-workflows', name: 'formbuilder_studio_api_output_workflows_list', requirements: ['formId' => '\d+'], methods: ['GET'])]
    #[IsGranted('formbuilder_permission_settings')]
    public function getOutputWorkflowList(int $formId): JsonResponse
    {
        $formDefinition = $this->formDefinitionManager->getById($formId);

        if (!$formDefinition instanceof FormDefinitionInterface || !$formDefinition->hasOutputWorkflows()) {
            return $this->json(['outputWorkflows' => []]);
        }

        $outputWorkflows = [];
        foreach ($formDefinition->getOutputWorkflows() as $outputWorkflow) {
            $outputWorkflows[] = [
                'id'   => $outputWorkflow->getId(),
                'name' => $outputWorkflow->getName(),
            ];
        }

        return $this->json(['outputWorkflows' => $outputWorkflows]);
    }

    #[Route('/formbuilder/output-workflows/{outputWorkflowId}', name: 'formbuilder_studio_api_output_workflows_get', requirements: ['outputWorkflowId' => '\d+'], methods: ['GET'])]
    #[IsGranted('formbuilder_permission_settings')]
    public function getOutputWorkflowData(int $outputWorkflowId): JsonResponse
    {
        $outputWorkflow = $this->outputWorkflowManager->getById($outputWorkflowId);

        if (!$outputWorkflow instanceof OutputWorkflowInterface) {
            return $this->errorResponse(sprintf('No output workflow for id %d found.', $outputWorkflowId), JsonResponse::HTTP_NOT_FOUND);
        }

        try {
            return $this->json(['data' => $this->formConfigBuilder->generateExtJsOutputWorkflowForm($outputWorkflow)]);
        } catch (\Throwable $e) {
            return $this->errorResponse($e->getMessage());
        }
    }

    #[Route('/formbuilder/forms/{formId}/output-workflows', name: 'formbuilder_studio_api_output_workflows_add', requirements: ['formId' => '\d+'], methods: ['POST'])]
    #[IsGranted('formbuilder_permission_settings')]
    public function addOutputWorkflow(Request $request, int $formId): JsonResponse
    {
        $payload = $this->getPayload($request);
        $name = (string) ($payload['name'] ?? '');
        $funnelAware = filter_var($payload['funnelAware'] ?? false, FILTER_VALIDATE_BOOLEAN);

        if ($name === '') {
            return $this->errorResponse('Output workflow name must not be empty.');
        }

        $formDefinition = $this->formDefinitionManager->getById($formId);

        if (!$formDefinition instanceof FormDefinitionInterface) {
            return $this->errorResponse(sprintf('No form for ID "%s" found.', $formId), JsonResponse::HTTP_NOT_FOUND);
        }

        if ($this->outputWorkflowManager->getFormOutputWorkflowByName($name, $formId) instanceof OutputWorkflowInterface) {
            return $this->errorResponse(sprintf('Output Workflow with name "%s" already exists!', $name), JsonResponse::HTTP_CONFLICT);
        }

        try {
            $outputWorkflow = $this->outputWorkflowManager->save([
                'name'           => $name,
                'formDefinition' => $formDefinition,
                'funnelAware'    => $funnelAware,
            ]);
        } catch (\Exception $e) {
            return $this->errorResponse(sprintf('Error while creating new output workflow with name "%s". Error was: %s', $name, $e->getMessage()), JsonResponse::HTTP_INTERNAL_SERVER_ERROR);
        }

        return $this->json(['id' => $outputWorkflow?->getId()], JsonResponse::HTTP_CREATED);
    }

    #[Route('/formbuilder/output-workflows/{outputWorkflowId}', name: 'formbuilder_studio_api_output_workflows_save', requirements: ['outputWorkflowId' => '\d+'], methods: ['PUT'])]
    #[IsGranted('formbuilder_permission_settings')]
    public function saveOutputWorkflow(Request $request, int $outputWorkflowId): JsonResponse
    {
        $outputWorkflow = $this->outputWorkflowManager->getById($outputWorkflowId);

        if (!$outputWorkflow instanceof OutputWorkflowInterface) {
            return $this->errorResponse(sprintf('No output workflow for id %d found.', $outputWorkflowId), JsonResponse::HTTP_NOT_FOUND);
        }

        $payload = $this->getPayload($request);
        // the workflow data is either the payload itself or (legacy) wrapped in a "data" key
        $data = $this->decodeStructure($payload['data'] ?? $payload);

        $storedOutputWorkflowName = $outputWorkflow->getName();
        $outputWorkflowName = (string) ($data['name'] ?? $storedOutputWorkflowName);

        if ($outputWorkflowName !== $storedOutputWorkflowName) {
            $existingWorkflow = null;

            try {
                $existingWorkflow = $this->outputWorkflowManager->getFormOutputWorkflowByName($outputWorkflowName, $outputWorkflow->getFormDefinition()->getId());
            } catch (\Exception) {
                // fail silently.
            }

            if ($existingWorkflow instanceof OutputWorkflowInterface) {
                return $this->errorResponse(sprintf('Output Workflow with name "%s" already exists in this form!', $outputWorkflowName), JsonResponse::HTTP_CONFLICT);
            }

            if ($this->outputWorkflowManager->outputWorkflowIsRequiredByConditionalLogic($outputWorkflow)) {
                return $this->errorResponse(sprintf('Output Workflow with name "%s" is required in conditional logic section. Please remove those dependencies first!', $outputWorkflowName), JsonResponse::HTTP_CONFLICT);
            }
        }

        $form = $this->formFactory->createNamed('', OutputWorkflowType::class, $outputWorkflow);
        $form->submit($data);

        if (!$form->isValid()) {
            $errors = [];
            foreach ($form->getErrors(true, true) as $error) {
                $errorMessageTemplate = $error->getMessageTemplate();
                foreach ($error->getMessageParameters() as $key => $value) {
                    $errorMessageTemplate = str_replace($key, (string) $value, $errorMessageTemplate);
                }
                $errors[] = sprintf('%s: %s', $error->getOrigin()->getConfig()->getName(), $errorMessageTemplate);
            }

            return $this->errorResponse(implode('<br>', $errors));
        }

        $this->outputWorkflowManager->saveRawEntity($outputWorkflow);

        return $this->json(['id' => $outputWorkflowId]);
    }

    #[Route('/formbuilder/output-workflows/{outputWorkflowId}', name: 'formbuilder_studio_api_output_workflows_delete', requirements: ['outputWorkflowId' => '\d+'], methods: ['DELETE'])]
    #[IsGranted('formbuilder_permission_settings')]
    public function deleteOutputWorkflow(int $outputWorkflowId): JsonResponse
    {
        try {
            $this->outputWorkflowManager->delete($outputWorkflowId);
        } catch (\Exception $e) {
            return $this->errorResponse(sprintf('Error while deleting output workflow with id %d. Error was: %s', $outputWorkflowId, $e->getMessage()), JsonResponse::HTTP_INTERNAL_SERVER_ERROR);
        }

        return $this->json(['id' => $outputWorkflowId]);
    }
}
