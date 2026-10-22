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

use Pimcore\Bundle\StudioBackendBundle\Controller\AbstractApiController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;

abstract class AbstractFormBuilderStudioController extends AbstractApiController
{
    public const PERMISSION = 'formbuilder_permission_settings';

    /**
     * Returns the request payload (json body or form data).
     */
    protected function getPayload(Request $request): array
    {
        return $request->getPayload()->all();
    }

    /**
     * Structures may be submitted as nested json or (legacy) as json encoded string.
     */
    protected function decodeStructure(mixed $value): array
    {
        if (is_string($value)) {
            $value = json_decode($value, true);
        }

        return is_array($value) ? $value : [];
    }

    protected function errorResponse(string $message, int $status = JsonResponse::HTTP_UNPROCESSABLE_ENTITY): JsonResponse
    {
        return $this->json(['message' => $message], $status);
    }
}
