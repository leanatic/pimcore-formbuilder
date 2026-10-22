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

namespace FormBuilderBundle\EventListener\Admin;

use Pimcore\Event\BundleManager\PathsEvent;
use Pimcore\Event\BundleManagerEvents;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;

/**
 * Classic Admin (ExtJS) is gone in Pimcore Platform 2026 / Studio.
 * The ExtJS asset registration was removed; the frontend is delivered through the Studio UI
 * bundle (see FormBuilderBundle\Webpack\WebpackEntryPointProvider).
 *
 * This subscriber is kept for BC (service id and event wiring) but intentionally registers no paths.
 *
 * @deprecated will be removed once the Studio UI replaces the former ExtJS interface entirely
 */
class AssetListener implements EventSubscriberInterface
{
    public static function getSubscribedEvents(): array
    {
        return [
            BundleManagerEvents::CSS_PATHS          => 'addCssFiles',
            BundleManagerEvents::EDITMODE_CSS_PATHS => 'addEditModeCssFiles',
            BundleManagerEvents::JS_PATHS           => 'addJsFiles',
            BundleManagerEvents::EDITMODE_JS_PATHS  => 'addEditModeJsFiles'
        ];
    }

    public function addCssFiles(PathsEvent $event): void
    {
        // no-op: ExtJS css is not loaded by Studio
    }

    public function addEditModeCssFiles(PathsEvent $event): void
    {
        // no-op: document editor is React based in Studio
    }

    public function addJsFiles(PathsEvent $event): void
    {
        // no-op: ExtJS js is not loaded by Studio
    }

    public function addEditModeJsFiles(PathsEvent $event): void
    {
        // no-op: document editor is React based in Studio
    }
}
