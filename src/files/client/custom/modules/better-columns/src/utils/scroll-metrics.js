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

/**
 * Pure geometry for the horizontal scroll hints, kept free of DOM access so it
 * can be unit tested.
 *
 * Positions are expressed as a distance from the inline start, so the same
 * values work in both directions: browsers report a negative scrollLeft in
 * right-to-left documents.
 */

/** Below this many pixels a list is treated as not scrollable. */
const tolerance = 1;

/**
 * @param {{
 *     scrollLeft: number,
 *     scrollWidth: number,
 *     clientWidth: number,
 *     trackWidth?: number,
 *     minimumThumbWidth?: number,
 * }} input
 * @return {{
 *     overflows: boolean,
 *     maxScroll: number,
 *     position: number,
 *     canScrollStart: boolean,
 *     canScrollEnd: boolean,
 *     thumbWidth: number,
 *     thumbOffset: number,
 * }}
 */
export function getScrollMetrics({
    scrollLeft,
    scrollWidth,
    clientWidth,
    trackWidth = 0,
    minimumThumbWidth = 32,
}) {
    const maxScroll = Math.max(0, scrollWidth - clientWidth);
    const overflows = maxScroll > tolerance;
    const position = Math.min(maxScroll, Math.abs(scrollLeft || 0));

    if (!overflows || trackWidth <= 0) {
        return {
            overflows,
            maxScroll,
            position,
            canScrollStart: overflows && position > tolerance,
            canScrollEnd: overflows && maxScroll - position > tolerance,
            thumbWidth: 0,
            thumbOffset: 0,
        };
    }

    const thumbWidth = Math.min(
        trackWidth,
        Math.max(minimumThumbWidth, trackWidth * clientWidth / scrollWidth)
    );
    const thumbOffset = (trackWidth - thumbWidth) * position / maxScroll;

    return {
        overflows,
        maxScroll,
        position,
        canScrollStart: position > tolerance,
        canScrollEnd: maxScroll - position > tolerance,
        thumbWidth,
        thumbOffset,
    };
}

/**
 * Converts a thumb drag into a scroll position measured from the inline start.
 *
 * @param {number} startPosition Position when the drag started.
 * @param {number} pointerDelta Horizontal pointer movement in pixels.
 * @param {{maxScroll: number, trackWidth: number, thumbWidth: number}} metrics
 * @param {boolean} [isRtl=false]
 * @return {number}
 */
export function getDraggedPosition(
    startPosition,
    pointerDelta,
    {maxScroll, trackWidth, thumbWidth},
    isRtl = false
) {
    const travel = trackWidth - thumbWidth;

    if (travel <= 0 || maxScroll <= 0) {
        return 0;
    }

    const delta = (isRtl ? -pointerDelta : pointerDelta) * maxScroll / travel;

    return Math.min(maxScroll, Math.max(0, startPosition + delta));
}

/**
 * @param {number} position Distance from the inline start.
 * @param {boolean} [isRtl=false]
 * @return {number} The value to assign to scrollLeft.
 */
export function toScrollLeft(position, isRtl = false) {
    return isRtl ? -position : position;
}
