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
use FormBuilderBundle\Manager\FormDefinitionManager;
use FormBuilderBundle\Model\FormDefinitionInterface;
use FormBuilderBundle\OutputWorkflow\DynamicObjectResolver\DynamicObjectResolverInterface;
use FormBuilderBundle\Registry\DynamicObjectResolverRegistry;
use Pimcore\Model\DataObject;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;
use Symfony\Component\Serializer\SerializerInterface;

final class OutputWorkflowObjectController extends AbstractFormBuilderStudioController
{
    public function __construct(
        SerializerInterface $serializer,
        private readonly FormDefinitionManager $formDefinitionManager,
        private readonly DynamicObjectResolverRegistry $dynamicObjectResolverRegistry,
        private readonly ExtJsFormBuilder $formConfigBuilder,
    ) {
        parent::__construct($serializer);
    }

    #[Route('/formbuilder/output-workflows/object/classes', name: 'formbuilder_studio_api_output_workflow_object_classes', methods: ['GET'])]
    #[IsGranted('formbuilder_permission_settings')]
    public function getObjectClasses(): JsonResponse
    {
        $list = new DataObject\ClassDefinition\Listing();

        $classes = [];
        foreach ($list->load() as $class) {
            $classes[] = ['key' => $class->getName(), 'label' => $class->getName()];
        }

        return $this->json(['types' => $classes]);
    }

    #[Route('/formbuilder/output-workflows/object/class-fields', name: 'formbuilder_studio_api_output_workflow_object_class_fields', methods: ['GET'])]
    #[IsGranted('formbuilder_permission_settings')]
    public function getObjectClassFields(Request $request): JsonResponse
    {
        $type = $request->query->get('type');
        $id = (string) $request->query->get('id');

        $fields = [];
        if ($type === 'fieldCollection') {
            $definition = DataObject\Fieldcollection\Definition::getByKey($id);
            $fields = $definition?->getFieldDefinitions() ?? [];
        } elseif ($type === 'dataClass') {
            $definition = DataObject\ClassDefinition::getById($id);
            $fields = $definition?->getFieldDefinitions() ?? [];
        }

        $flattenFields = [];
        foreach ($fields as $field) {
            $flattenFields[] = [
                'key'   => $field->getName(),
                'label' => empty($field->getTitle()) ? $field->getName() : $field->getTitle(),
            ];
        }

        return $this->json(['fields' => $flattenFields]);
    }

    #[Route('/formbuilder/output-workflows/object/field-collection-types', name: 'formbuilder_studio_api_output_workflow_object_field_collection_types', methods: ['GET'])]
    #[IsGranted('formbuilder_permission_settings')]
    public function getFieldCollectionTypes(Request $request): JsonResponse
    {
        $classId = (string) $request->query->get('classId');
        $fieldCollectionKey = (string) $request->query->get('fieldCollectionKey');

        try {
            $classDefinition = DataObject\ClassDefinition::getById($classId);
        } catch (\Exception $e) {
            return $this->errorResponse($e->getMessage());
        }

        if (!$classDefinition instanceof DataObject\ClassDefinition) {
            return $this->errorResponse('No class definition found.', JsonResponse::HTTP_NOT_FOUND);
        }

        $field = $classDefinition->getFieldDefinition($fieldCollectionKey);
        if (!$field instanceof DataObject\ClassDefinition\Data\Fieldcollections) {
            return $this->errorResponse('No valid field collection found.');
        }

        $allowedTypes = [];
        foreach ($field->getAllowedTypes() as $type) {
            $allowedTypes[] = ['key' => $type, 'label' => $type];
        }

        return $this->json(['types' => $allowedTypes]);
    }

    /**
     * Body: { "id": <formId>, "baseConfiguration": { ... } }
     */
    #[Route('/formbuilder/output-workflows/object/form-data', name: 'formbuilder_studio_api_output_workflow_object_form_data', methods: ['POST'])]
    #[IsGranted('formbuilder_permission_settings')]
    public function getFormData(Request $request): JsonResponse
    {
        $payload = $this->getPayload($request);
        $baseConfiguration = $this->decodeStructure($payload['baseConfiguration'] ?? null);
        $formDefinition = $this->formDefinitionManager->getById((int) ($payload['id'] ?? 0));

        if (!$formDefinition instanceof FormDefinitionInterface) {
            return $this->errorResponse('form is not available', JsonResponse::HTTP_NOT_FOUND);
        }

        $classDefinition = null;
        $resolveStrategy = $baseConfiguration['resolveStrategy'] ?? null;
        $dynamicObjectResolver = $baseConfiguration['dynamicObjectResolver'] ?? null;

        if (!empty($dynamicObjectResolver)) {
            $classDefinition = DataObject\ClassDefinition::getByName($baseConfiguration['dynamicObjectResolverClass'] ?? '');
        } elseif ($resolveStrategy === 'newObject') {
            $classDefinition = DataObject\ClassDefinition::getByName($baseConfiguration['resolvingObjectClass'] ?? '');
        } elseif ($resolveStrategy === 'existingObject') {
            $dataObject = DataObject::getById((int) ($baseConfiguration['resolvingObject']['id'] ?? 0));
            $classDefinition = $dataObject instanceof DataObject\Concrete ? $dataObject->getClass() : null;
        }

        if (!$classDefinition instanceof DataObject\ClassDefinition) {
            return $this->errorResponse('No class definition found.');
        }

        try {
            $formFieldDefinitions = $this->formConfigBuilder->generateExtJsFormFields($formDefinition);
        } catch (\Exception $e) {
            return $this->errorResponse($e->getMessage());
        }

        return $this->json([
            'configuration' => [
                'classId'              => $classDefinition->getId(),
                'className'            => $classDefinition->getName(),
                'formFieldDefinitions' => $formFieldDefinitions,
            ],
        ]);
    }

    #[Route('/formbuilder/output-workflows/object/dynamic-object-resolvers', name: 'formbuilder_studio_api_output_workflow_object_dynamic_object_resolvers', methods: ['GET'])]
    #[IsGranted('formbuilder_permission_settings')]
    public function getDynamicObjectResolver(Request $request): JsonResponse
    {
        $modeFilter = $request->query->get('allowedObjectResolverMode');

        $data = [];
        foreach ($this->dynamicObjectResolverRegistry->getAll() as $identifier => $serviceData) {
            /** @var DynamicObjectResolverInterface $service */
            $service = $serviceData['service'];
            $allowedModes = $service::getAllowedObjectResolverModes();

            if ($modeFilter !== null && !in_array($modeFilter, $allowedModes, true)) {
                continue;
            }

            $data[] = [
                'label'                      => $serviceData['label'],
                'key'                        => $identifier,
                'allowedObjectResolverModes' => $allowedModes,
            ];
        }

        return $this->json(['resolver' => $data]);
    }
}
