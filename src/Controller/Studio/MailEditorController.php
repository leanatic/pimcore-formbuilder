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

use FormBuilderBundle\Controller\Admin\MailEditorController as AdminMailEditorController;
use FormBuilderBundle\Manager\FormDefinitionManager;
use FormBuilderBundle\Model\FormDefinitionInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;
use Symfony\Component\Serializer\SerializerInterface;

final class MailEditorController extends AbstractFormBuilderStudioController
{
    public function __construct(
        SerializerInterface $serializer,
        private readonly FormDefinitionManager $formDefinitionManager,
        private readonly AdminMailEditorController $mailEditorController,
    ) {
        parent::__construct($serializer);
    }

    #[Route('/formbuilder/forms/{id}/mail-editor', name: 'formbuilder_studio_api_mail_editor_load', requirements: ['id' => '\d+'], methods: ['GET'])]
    #[IsGranted('formbuilder_permission_settings')]
    public function getMailEditorData(Request $request, int $id): JsonResponse
    {
        if (!$this->formDefinitionManager->getById($id) instanceof FormDefinitionInterface) {
            return $this->errorResponse(sprintf('No form for id %d found.', $id), JsonResponse::HTTP_NOT_FOUND);
        }

        return $this->mailEditorController->getMailEditorDataAction($request);
    }
}
