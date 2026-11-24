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

export const FIELD_MINIMUM_WIDTH = 56;
export const RESIZE_HIT_TOLERANCE = 12;
export const RESIZE_OUTSIDE_HIT_TOLERANCE = 6;
const AUTO_FIT_FALLBACK_PADDING = 8;

/**
 * @return {number}
 */
export function getFieldMinimumWidth() {
    return FIELD_MINIMUM_WIDTH;
}

/**
 * @param {number} value
 * @param {number} minimum
 * @return {number}
 */
export function constrainWidth(value, minimum) {
    return Math.max(minimum, Math.round(value));
}

/**
 * Keep real columns fixed and assign only unused space to a filler column.
 *
 * @param {number} availableWidth
 * @param {number} contentWidth
 * @return {{fillerWidth: number, tableWidth: number}}
 */
export function calculateTableSizing(availableWidth, contentWidth) {
    const fillerWidth = Math.max(0, availableWidth - contentWidth);

    return {
        fillerWidth,
        tableWidth: contentWidth + fillerWidth,
    };
}

/**
 * Fit rendered widths into the available field area. The regular resize
 * minimum is retained whenever possible. When there are too many columns,
 * the effective minimum is reduced so a reset never creates an overflow.
 *
 * @param {Record<string, number>} widthMap
 * @param {number} availableWidth
 * @param {number} minimum
 * @return {Record<string, number>}
 */
export function fitColumnWidths(widthMap, availableWidth, minimum) {
    const entries = Object.entries(widthMap)
        .filter(([, width]) => Number.isFinite(width) && width > 0);
    const budget = Math.max(0, Math.floor(availableWidth));

    if (!entries.length) {
        return {};
    }

    const total = entries.reduce((sum, [, width]) => sum + width, 0);

    if (total <= budget) {
        return Object.fromEntries(
            entries.map(([name, width]) => [name, Math.floor(width)])
        );
    }

    const effectiveMinimum = Math.min(
        minimum,
        budget / entries.length
    );
    const result = {};
    let remaining = entries.map(([name, width]) => ({name, width}));
    let remainingBudget = budget;

    while (remaining.length) {
        const remainingTotal = remaining.reduce(
            (sum, item) => sum + item.width,
            0
        );
        const scale = remainingTotal ?
            remainingBudget / remainingTotal :
            0;
        const constrained = remaining.filter(
            item => item.width * scale < effectiveMinimum
        );

        if (!constrained.length) {
            remaining.forEach(item => {
                result[item.name] = item.width * scale;
            });

            break;
        }

        constrained.forEach(item => {
            result[item.name] = effectiveMinimum;
            remainingBudget -= effectiveMinimum;
        });

        const constrainedNames = new Set(
            constrained.map(item => item.name)
        );

        remaining = remaining.filter(
            item => !constrainedNames.has(item.name)
        );
    }

    return Object.fromEntries(
        entries.map(([name]) => [
            name,
            Math.max(1, Math.floor(result[name] || 0)),
        ])
    );
}

/**
 * Find the column whose trailing edge is close enough to the pointer.
 * The first pixels beyond the edge still belong to the preceding column so
 * resizing takes priority over reordering around the visual separator.
 *
 * @param {HTMLElement[]} headers
 * @param {number} clientX
 * @param {boolean} rtl
 * @param {number} [insideTolerance]
 * @param {number} [outsideTolerance]
 * @return {HTMLElement|null}
 */
export function findHeaderAtResizeBoundary(
    headers,
    clientX,
    rtl,
    insideTolerance = RESIZE_HIT_TOLERANCE,
    outsideTolerance = RESIZE_OUTSIDE_HIT_TOLERANCE
) {
    let closest = null;
    let closestDistance = Math.max(
        insideTolerance,
        outsideTolerance
    ) + 1;

    headers.forEach(header => {
        const rect = header.getBoundingClientRect();
        const boundary = rtl ? rect.left : rect.right;
        const insideDistance = rtl ?
            clientX - boundary :
            boundary - clientX;
        const distance = Math.abs(insideDistance);

        if (
            insideDistance > insideTolerance ||
            insideDistance < -outsideTolerance ||
            distance >= closestDistance
        ) {
            return;
        }

        closest = header;
        closestDistance = distance;
    });

    return closest;
}

let measurementCanvas = null;

function measureText(element) {
    const text = (element.innerText || element.textContent || '')
        .split('\n')
        .map(value => value.trim())
        .filter(Boolean);

    if (!text.length) {
        return 0;
    }

    measurementCanvas ??= document.createElement('canvas');

    const context = measurementCanvas.getContext('2d');
    const style = window.getComputedStyle(element);

    context.font = style.font;

    return Math.max(
        ...text.map(value => context.measureText(value).width)
    );
}

function measureControls(element) {
    return [...element.querySelectorAll(
        'input, select, button, img, svg, canvas, [role="img"], ' +
        '.fas, .far, .fab'
    )].reduce((width, control) => {
        if (
            control instanceof HTMLInputElement &&
            !['checkbox', 'radio'].includes(control.type)
        ) {
            const style = window.getComputedStyle(control);

            measurementCanvas ??= document.createElement('canvas');

            const context = measurementCanvas.getContext('2d');

            context.font = style.font;

            return width + context.measureText(
                control.value || control.placeholder || ''
            ).width;
        }

        return width + control.getBoundingClientRect().width;
    }, 0);
}

function getHorizontalSpacing(style, includePadding) {
    return [
        style.marginLeft,
        style.marginRight,
        style.borderLeftWidth,
        style.borderRightWidth,
        includePadding ? style.paddingLeft : 0,
        includePadding ? style.paddingRight : 0,
    ].reduce(
        (total, value) => total + (parseFloat(value || '0') || 0),
        0
    );
}

function measureElementWidth(element) {
    const style = window.getComputedStyle(element);

    return Math.max(
        element.scrollWidth,
        element.getBoundingClientRect().width
    ) + getHorizontalSpacing(style, false);
}

function expandIntrinsicCloneContent(clone) {
    const expandableDisplays = new Set([
        'block',
        'flex',
        'grid',
        'inline-block',
        'inline-flex',
        'inline-grid',
        'list-item',
        'table',
        'table-cell',
    ]);
    const descendants = [...clone.querySelectorAll('*')];

    for (let pass = 0; pass < 2; pass++) {
        descendants.forEach(descendant => {
            const style = window.getComputedStyle(descendant);

            if (
                style.display === 'none' ||
                ['absolute', 'fixed'].includes(style.position)
            ) {
                return;
            }

            descendant.style.setProperty(
                'overflow',
                'visible',
                'important'
            );
            descendant.style.setProperty(
                'text-overflow',
                'clip',
                'important'
            );
            descendant.style.setProperty(
                'white-space',
                'nowrap',
                'important'
            );

            const parent = descendant.parentElement;
            const rect = descendant.getBoundingClientRect();
            const parentRect = parent?.getBoundingClientRect();
            const fillsParent = parentRect &&
                rect.width >= parentRect.width - 1;
            const overflows = descendant.scrollWidth > rect.width + 1;

            if (
                overflows ||
                (fillsParent && expandableDisplays.has(style.display))
            ) {
                descendant.style.setProperty(
                    'max-width',
                    'none',
                    'important'
                );
                descendant.style.setProperty(
                    'width',
                    'max-content',
                    'important'
                );
            }
        });
    }
}

/**
 * Measure a cell's rendered contents without the current fixed column width
 * constraining its layout. This deliberately works from the DOM rather than
 * from field types: links, avatars, badges, icons, controls and custom field
 * renderers all contribute whatever width they actually occupy.
 *
 * @param {HTMLElement} element
 * @return {number}
 */
function measureIntrinsicElementWidth(element) {
    if (
        !element ||
        typeof document === 'undefined' ||
        !document.body ||
        typeof element.cloneNode !== 'function'
    ) {
        return 0;
    }

    const sourceTable = element.closest?.('table');
    const sourceRow = element.closest?.('tr');
    const sourceList = element.closest?.('.list');
    const host = document.createElement('div');
    const table = document.createElement('table');
    const body = document.createElement('tbody');
    const row = document.createElement('tr');
    const clone = element.cloneNode(true);

    if (sourceList?.className) {
        host.className = sourceList.className;
    }

    if (sourceTable?.className) {
        table.className = sourceTable.className;
    }

    if (sourceRow?.className) {
        row.className = sourceRow.className;
    }

    host.setAttribute('aria-hidden', 'true');
    host.style.setProperty('height', 'auto', 'important');
    host.style.setProperty('left', '-100000px', 'important');
    host.style.setProperty('overflow', 'visible', 'important');
    host.style.setProperty('pointer-events', 'none', 'important');
    host.style.setProperty('position', 'fixed', 'important');
    host.style.setProperty('top', '0', 'important');
    host.style.setProperty('visibility', 'hidden', 'important');
    host.style.setProperty('width', 'max-content', 'important');
    host.style.setProperty('z-index', '-1', 'important');

    table.style.setProperty('border-collapse', 'separate', 'important');
    table.style.setProperty('height', 'auto', 'important');
    table.style.setProperty('max-width', 'none', 'important');
    table.style.setProperty('min-width', '0', 'important');
    table.style.setProperty('table-layout', 'auto', 'important');
    table.style.setProperty('width', 'max-content', 'important');

    clone.style.setProperty('display', 'table-cell', 'important');
    clone.style.setProperty('height', 'auto', 'important');
    clone.style.setProperty('max-height', 'none', 'important');
    clone.style.setProperty('max-width', 'none', 'important');
    clone.style.setProperty('min-width', '0', 'important');
    clone.style.setProperty('overflow', 'visible', 'important');
    clone.style.setProperty('white-space', 'nowrap', 'important');
    clone.style.setProperty('width', 'max-content', 'important');

    row.append(clone);
    body.append(row);
    table.append(body);
    host.append(table);
    document.body.append(host);

    try {
        expandIntrinsicCloneContent(clone);

        const rect = clone.getBoundingClientRect();

        return Math.max(
            Number(clone.scrollWidth) || 0,
            Number(rect.width) || 0
        );
    } finally {
        host.remove();
    }
}

/**
 * Measure known decorations omitted by canvas text measurement. The generic
 * intrinsic DOM measurement remains the primary path; these extras preserve a
 * useful fallback when a browser cannot lay out a cloned cell.
 *
 * @param {HTMLElement} element
 * @return {number}
 */
function measureEnumExtras(element) {
    const iconWidth = [...element.querySelectorAll('.color-icon')]
        .reduce((width, icon) => {
            const spacing = icon.nextElementSibling;
            const spacingWidth = spacing &&
                !(spacing.textContent || '').trim() ?
                measureElementWidth(spacing) :
                0;

            return width + measureElementWidth(icon) + spacingWidth;
        }, 0);
    const labelChrome = [...element.querySelectorAll('.label')]
        .reduce(
            (width, label) => width + getHorizontalSpacing(
                window.getComputedStyle(label),
                true
            ),
            0
        );

    return iconWidth + labelChrome;
}

/**
 * @param {number} textWidth
 * @param {number} extrasWidth
 * @param {number} controlsWidth
 * @param {number} padding
 * @return {number}
 */
export function combineContentWidths(
    textWidth,
    extrasWidth,
    controlsWidth,
    padding
) {
    return Math.max(
        textWidth + extrasWidth,
        controlsWidth
    ) + padding;
}

/**
 * @param {HTMLElement[]} elements
 * @param {number} minimum
 * @param {number} [maximum]
 * @return {number}
 */
export function measureContentWidth(elements, minimum, maximum = 520) {
    const measured = elements.reduce((width, element) => {
        const style = window.getComputedStyle(element);
        const padding =
            parseFloat(style.paddingLeft || '0') +
            parseFloat(style.paddingRight || '0');
        const contentWidth = combineContentWidths(
            measureText(element),
            measureEnumExtras(element),
            measureControls(element),
            padding
        );
        const intrinsicWidth = measureIntrinsicElementWidth(element);
        const elementWidth = Math.max(
            contentWidth,
            intrinsicWidth
        ) + (
            intrinsicWidth >= contentWidth ?
                0 :
                AUTO_FIT_FALLBACK_PADDING
        );

        return Math.max(
            width,
            elementWidth
        );
    }, minimum);

    return Math.min(maximum, Math.max(minimum, Math.ceil(measured)));
}
