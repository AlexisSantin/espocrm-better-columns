/************************************************************************
 * This file is part of Better Columns for EspoCRM.
 *
 * Copyright (C) 2026 Alexis SANTIN
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 ************************************************************************/

const DRAG_PREVIEW_PADDING = 8;

/**
 * Get the visible label to show in the reorder preview.
 *
 * @param {HTMLElement|null} header
 * @return {string}
 */
export function getHeaderLabel(header) {
    if (!header) {
        return '';
    }

    const content = header.innerText || header.textContent || '';
    const text = typeof content === 'string' ?
        content.replace(/\s+/g, ' ').trim() :
        '';

    if (text) {
        return text;
    }

    const ariaLabel = header.getAttribute?.('aria-label')?.trim();

    return ariaLabel || header.dataset?.name || '';
}

/**
 * Keep the pointer-following preview inside the viewport where possible.
 *
 * @param {number} clientX
 * @param {number} clientY
 * @param {number} previewWidth
 * @param {number} previewHeight
 * @param {number} viewportWidth
 * @param {number} viewportHeight
 * @param {number} [pointerOffsetX]
 * @param {number} [pointerOffsetY]
 * @return {{left: number, top: number}}
 */
export function getDragPreviewPosition(
    clientX,
    clientY,
    previewWidth,
    previewHeight,
    viewportWidth,
    viewportHeight,
    pointerOffsetX = 0,
    pointerOffsetY = 0
) {
    const preferredLeft = clientX - pointerOffsetX;
    const preferredTop = clientY - pointerOffsetY;
    const maxLeft = Math.max(
        DRAG_PREVIEW_PADDING,
        viewportWidth - previewWidth - DRAG_PREVIEW_PADDING
    );
    const maxTop = Math.max(
        DRAG_PREVIEW_PADDING,
        viewportHeight - previewHeight - DRAG_PREVIEW_PADDING
    );

    return {
        left: Math.round(Math.min(
            maxLeft,
            Math.max(DRAG_PREVIEW_PADDING, preferredLeft)
        )),
        top: Math.round(Math.min(
            maxTop,
            Math.max(DRAG_PREVIEW_PADDING, preferredTop)
        )),
    };
}
