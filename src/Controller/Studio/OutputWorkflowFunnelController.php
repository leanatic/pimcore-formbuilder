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

use FormBuilderBundle\OutputWorkflow\Channel\Funnel\Action\FunnelActionInterface;
use FormBuilderBundle\OutputWorkflow\Channel\Funnel\Layer\FunnelLayerInterface;
use FormBuilderBundle\Registry\FunnelActionRegistry;
use FormBuilderBundle\Registry\FunnelLayerRegistry;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;
use Symfony\Component\Serializer\Normalizer\AbstractNormalizer;
use Symfony\Component\Serializer\Normalizer\NormalizerInterface;
use Symfony\Component\Serializer\SerializerInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

final class OutputWorkflowFunnelController extends AbstractFormBuilderStudioController
{
    public function __construct(
        SerializerInterface $serializer,
        private readonly TranslatorInterface $translator,
        private readonly FunnelLayerRegistry $funnelLayerRegistry,
        private readonly FunnelActionRegistry $funnelActionRegistry,
    ) {
        parent::__construct($serializer);
    }

    #[Route('/formbuilder/output-workflows/funnel/layers', name: 'formbuilder_studio_api_output_workflow_funnel_layers', methods: ['GET'])]
    #[IsGranted('formbuilder_permission_settings')]
    public function getFunnelLayers(): JsonResponse
    {
        $data = [];

        /**
         * @var string               $identifier
         * @var FunnelLayerInterface $service
         */
        foreach ($this->funnelLayerRegistry->getAll() as $identifier => $service) {
            $funnelActionDefinitions = $service->getFunnelActionDefinitions();

            if ($service->dynamicFunnelActionAware() === true && count($funnelActionDefinitions) > 0) {
                return $this->errorResponse('Dynamic action aware funnel is not allowed to provide any preconfigured action elements.', JsonResponse::HTTP_INTERNAL_SERVER_ERROR);
            }

            $data[] = [
                'label'         => $service->getName(),
                'key'           => $identifier,
                'configuration' => [
                    'dynamicFunnelActionAware' => $service->dynamicFunnelActionAware(),
                    'funnelActionDefinitions'  => $this->serializer instanceof NormalizerInterface
                        ? $this->serializer->normalize(
                            $funnelActionDefinitions,
                            'array',
                            [
                                'groups'                      => ['ExtJs'],
                                AbstractNormalizer::CALLBACKS => [
                                    'label' => fn ($label) => $this->translator->trans($label, [], 'messages'),
                                ],
                            ]
                        )
                        : [],
                ],
            ];
        }

        return $this->json(['funnelLayers' => $data]);
    }

    #[Route('/formbuilder/output-workflows/funnel/actions', name: 'formbuilder_studio_api_output_workflow_funnel_actions', methods: ['GET'])]
    #[IsGranted('formbuilder_permission_settings')]
    public function getFunnelActions(): JsonResponse
    {
        $data = [];

        /**
         * @var string                $identifier
         * @var FunnelActionInterface $service
         */
        foreach ($this->funnelActionRegistry->getAll() as $identifier => $service) {
            $data[] = ['label' => $service->getName(), 'key' => $identifier];
        }

        return $this->json(['funnelActions' => $data]);
    }
}
