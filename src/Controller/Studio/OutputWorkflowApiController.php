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
use FormBuilderBundle\Registry\ApiProviderRegistry;
use FormBuilderBundle\Registry\FieldTransformerRegistry;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\OptionsResolver\OptionsResolver;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;
use Symfony\Component\Serializer\SerializerInterface;

final class OutputWorkflowApiController extends AbstractFormBuilderStudioController
{
    public function __construct(
        SerializerInterface $serializer,
        private readonly FormDefinitionManager $formDefinitionManager,
        private readonly ExtJsFormBuilder $formConfigBuilder,
        private readonly ApiProviderRegistry $apiProviderRegistry,
        private readonly FieldTransformerRegistry $fieldTransformerRegistry,
    ) {
        parent::__construct($serializer);
    }

    /**
     * Body: { "id": <formId>, "baseConfiguration": { "apiProvider": "...", "apiConfiguration": { ... } } }
     */
    #[Route('/formbuilder/output-workflows/api/form-data', name: 'formbuilder_studio_api_output_workflow_api_form_data', methods: ['POST'])]
    #[IsGranted('formbuilder_permission_settings')]
    public function getFormData(Request $request): JsonResponse
    {
        $payload = $this->getPayload($request);
        $baseConfiguration = $this->decodeStructure($payload['baseConfiguration'] ?? null);
        $formDefinition = $this->formDefinitionManager->getById((int) ($payload['id'] ?? 0));

        $apiProviderName = (string) ($baseConfiguration['apiProvider'] ?? '');
        $configurationFields = $baseConfiguration['apiConfiguration'] ?? [];

        if (!$formDefinition instanceof FormDefinitionInterface) {
            return $this->errorResponse('form is not available', JsonResponse::HTTP_NOT_FOUND);
        }

        try {
            $formFieldDefinitions = $this->formConfigBuilder->generateExtJsFormFields($formDefinition);
        } catch (\Exception $e) {
            return $this->errorResponse($e->getMessage());
        }

        try {
            $apiProvider = $this->apiProviderRegistry->get($apiProviderName);
        } catch (\Throwable $e) {
            return $this->errorResponse(sprintf('API Provider error: %s', $e->getMessage()));
        }

        try {
            $predefinedApiFields = $this->validateApiPredefinedFields($apiProvider->getPredefinedApiFields($formDefinition, $configurationFields));
        } catch (\Throwable $e) {
            return $this->errorResponse($e->getMessage());
        }

        $fieldTransformer = [];
        foreach ($this->fieldTransformerRegistry->getAll() as $identifier => $transformer) {
            $fieldTransformer[] = [
                'value'       => $identifier,
                'label'       => $transformer->getName(),
                'description' => $transformer->getDescription(),
            ];
        }

        return $this->json([
            'configuration' => [
                'formFieldDefinitions' => $formFieldDefinitions,
                'fieldTransformer'     => $fieldTransformer,
                'apiProvider'          => [
                    'key'                 => $apiProviderName,
                    'label'               => $apiProvider->getName(),
                    'predefinedApiFields' => $predefinedApiFields,
                ],
            ],
        ]);
    }

    /**
     * Query: id = <formId>
     */
    #[Route('/formbuilder/output-workflows/api/providers', name: 'formbuilder_studio_api_output_workflow_api_providers', methods: ['GET'])]
    #[IsGranted('formbuilder_permission_settings')]
    public function getApiProvider(Request $request): JsonResponse
    {
        $formDefinition = $this->formDefinitionManager->getById($request->query->getInt('id'));

        if (!$formDefinition instanceof FormDefinitionInterface) {
            return $this->errorResponse('form is not available', JsonResponse::HTTP_NOT_FOUND);
        }

        $data = [];
        foreach ($this->apiProviderRegistry->getAll() as $identifier => $service) {
            try {
                $configurationFields = $this->validateApiConfigurationFields($service->getProviderConfigurationFields($formDefinition));
            } catch (\Throwable $e) {
                return $this->errorResponse($e->getMessage());
            }

            $data[] = [
                'label'               => $service->getName(),
                'key'                 => $identifier,
                'configurationFields' => $configurationFields,
            ];
        }

        return $this->json(['types' => $data]);
    }

    private function validateApiPredefinedFields(array $fields): array
    {
        return array_map(static function ($property) {
            if (!is_array($property)) {
                $property = [
                    'label' => $property,
                    'value' => $property,
                ];
            }

            return [
                'label' => $property['label'] ?? 'UNKNOWN',
                'value' => $property['value'] ?? 'UNKNOWN',
            ];
        }, $fields);
    }

    private function validateApiConfigurationFields(array $fields): array
    {
        $validatedConfigurationFields = [];

        foreach ($fields as $field) {
            $optionsResolver = new OptionsResolver();
            $optionsResolver->setRequired(['type', 'label', 'name', 'required']);
            $optionsResolver->setAllowedValues('type', ['text', 'select']);
            $optionsResolver->setAllowedTypes('type', ['string']);
            $optionsResolver->setAllowedTypes('label', ['string']);
            $optionsResolver->setAllowedTypes('name', ['string']);
            $optionsResolver->setAllowedTypes('required', ['bool']);

            if (($field['type'] ?? null) === 'select') {
                $optionsResolver->setRequired('store');
                $optionsResolver->setAllowedTypes('store', ['array']);
            }

            try {
                $validatedConfigurationFields[] = $optionsResolver->resolve($field);
            } catch (\Throwable $e) {
                throw new \Exception(sprintf('API configuration error for field "%s": %s', $field['type'] ?? '-', $e->getMessage()));
            }
        }

        return $validatedConfigurationFields;
    }
}
