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

use FormBuilderBundle\Controller\Admin\ExportController as AdminExportController;
use FormBuilderBundle\Manager\FormDefinitionManager;
use FormBuilderBundle\Model\FormDefinitionInterface;
use FormBuilderBundle\Tool\ImportExportProcessor;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;
use Symfony\Component\Serializer\SerializerInterface;

/**
 * Export / Import of form definitions and mail csv export.
 * The file generation / parsing logic is shared with the (legacy) admin controller.
 */
final class ExportController extends AbstractFormBuilderStudioController
{
    public function __construct(
        SerializerInterface $serializer,
        private readonly FormDefinitionManager $formDefinitionManager,
        private readonly AdminExportController $exportController,
    ) {
        parent::__construct($serializer);
    }

    #[Route('/formbuilder/forms/{id}/export', name: 'formbuilder_studio_api_forms_export', requirements: ['id' => '\d+'], methods: ['GET'])]
    #[IsGranted('formbuilder_permission_settings')]
    public function exportForm(Request $request, ImportExportProcessor $importExportProcessor, int $id): Response
    {
        if (!$this->formDefinitionManager->getById($id) instanceof FormDefinitionInterface) {
            return $this->errorResponse(sprintf('Form with id %d not found', $id), Response::HTTP_NOT_FOUND);
        }

        return $this->exportController->exportFormAction($request, $importExportProcessor);
    }

    #[Route('/formbuilder/forms/{id}/import', name: 'formbuilder_studio_api_forms_import', requirements: ['id' => '\d+'], methods: ['POST'])]
    #[IsGranted('formbuilder_permission_settings')]
    public function importForm(Request $request, ImportExportProcessor $importExportProcessor, int $id): JsonResponse
    {
        if (!$this->formDefinitionManager->getById($id) instanceof FormDefinitionInterface) {
            return $this->errorResponse(sprintf('Form with id %d not found', $id), Response::HTTP_NOT_FOUND);
        }

        if (!$request->files->get('formData')) {
            return $this->errorResponse('No import file ("formData") given.');
        }

        // multipart payload: formData (file), outputWorkflows ("true"|"false"), conditionalLogic ("true"|"false")
        $request->request->set('formId', $id);

        $adminResponse = $this->exportController->importFormAction($request, $importExportProcessor);
        $data = json_decode((string) $adminResponse->getContent(), true) ?? [];

        if (($data['success'] ?? false) !== true) {
            return $this->errorResponse((string) ($data['message'] ?? 'Import failed.'));
        }

        return $this->json(['id' => $id]);
    }

    #[Route('/formbuilder/forms/{id}/mail-csv-export', name: 'formbuilder_studio_api_forms_mail_csv_export', requirements: ['id' => '\d+'], methods: ['GET'])]
    #[IsGranted('formbuilder_permission_settings')]
    public function exportFormEmails(Request $request, int $id): Response
    {
        if (!$this->formDefinitionManager->getById($id) instanceof FormDefinitionInterface) {
            return $this->errorResponse(sprintf('Form with id %d not found', $id), Response::HTTP_NOT_FOUND);
        }

        // query: mailType = "all" | <output workflow id>
        return $this->exportController->exportFormEmailsAction($request);
    }
}
