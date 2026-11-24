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

import assert from 'node:assert/strict';
import test from 'node:test';

import {
    getDragPreviewPosition,
    getHeaderLabel,
} from '../files/client/custom/modules/better-columns/src/utils/drag-preview.js';

test('drag preview prefers the rendered header label with safe fallbacks', () => {
    assert.equal(
        getHeaderLabel({
            textContent: '  Email\n address ',
            getAttribute: () => 'Accessible label',
            dataset: {name: 'emailAddress'},
        }),
        'Email address'
    );
    assert.equal(
        getHeaderLabel({
            textContent: '',
            getAttribute: name => name === 'aria-label' ? 'Status' : null,
            dataset: {name: 'status'},
        }),
        'Status'
    );
    assert.equal(
        getHeaderLabel({
            textContent: '',
            getAttribute: () => null,
            dataset: {name: 'assignedUser'},
        }),
        'assignedUser'
    );
});

test('drag preview keeps its grab point while staying inside the viewport', () => {
    assert.deepEqual(
        getDragPreviewPosition(400, 300, 140, 32, 800, 600, 35, 12),
        {left: 365, top: 288}
    );
    assert.deepEqual(
        getDragPreviewPosition(790, 590, 140, 32, 800, 600, 20, 16),
        {left: 652, top: 560}
    );
});
