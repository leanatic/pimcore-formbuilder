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

namespace FormBuilderBundle\Twig\Extension;

use Twig\Extension\AbstractExtension;
use Twig\TwigFilter;

/**
 * Twig deprecated its "spaceless" filter in 3.12 without a replacement. The form themes apply it to included
 * content (snippets, instructions, uploader templates), which whitespace control cannot reach, so this filter
 * keeps the exact behavior of the Twig one.
 */
class SpacelessExtension extends AbstractExtension
{
    public function getFilters(): array
    {
        return [
            new TwigFilter('form_builder_spaceless', [$this, 'spaceless'], ['is_safe' => ['html']])
        ];
    }

    /**
     * Removes the whitespace between HTML tags, same as Twig\Extension\CoreExtension::spaceless().
     */
    public function spaceless(?string $content): string
    {
        return trim(preg_replace('/>\s+</', '><', $content ?? ''));
    }
}
