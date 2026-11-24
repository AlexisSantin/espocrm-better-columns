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
    canStartHeaderReorder,
    reorderNamedCells,
} from
    '../files/client/custom/modules/better-columns/src/utils/dom-order.js';
import {calculateTableSizing} from
    '../files/client/custom/modules/better-columns/src/utils/field-sizing.js';

class FakeCell {

    constructor(
        name,
        {managed = false, action = false, filler = false} = {}
    ) {
        this.dataset = {name};
        this.managed = managed;
        this.action = action;
        this.filler = filler;
        this.parent = null;
    }
}

class FakeRow {

    constructor(cells) {
        this.children = cells;
        cells.forEach(cell => cell.parent = this);
    }

    querySelectorAll() {
        return this.children.filter(cell => cell.managed);
    }

    querySelector() {
        const filler = this.children.find(cell => cell.filler);

        if (filler) {
            return filler;
        }

        return this.children.find(cell =>
            cell.action || cell.dataset.name === 'buttons'
        ) || null;
    }

    insertBefore(cell, boundary) {
        this.remove(cell);
        this.children.splice(this.children.indexOf(boundary), 0, cell);
    }

    append(cell) {
        this.remove(cell);
        this.children.push(cell);
    }

    remove(cell) {
        const index = this.children.indexOf(cell);

        if (index !== -1) {
            this.children.splice(index, 1);
        }
    }

    names() {
        return this.children.map(cell => cell.dataset.name);
    }
}

test('headers and row cells keep the same order around technical columns', () => {
    const header = new FakeRow([
        new FakeCell('r-checkbox'),
        new FakeCell('name', {managed: true}),
        new FakeCell('emailAddress', {managed: true}),
        new FakeCell('status', {managed: true}),
        new FakeCell('filler', {filler: true}),
        new FakeCell('actions', {action: true}),
    ]);
    const row = new FakeRow([
        new FakeCell('r-checkbox'),
        new FakeCell('name', {managed: true}),
        new FakeCell('emailAddress', {managed: true}),
        new FakeCell('status', {managed: true}),
        new FakeCell('filler', {filler: true}),
        new FakeCell('buttons'),
    ]);
    const order = ['status', 'name', 'emailAddress'];

    reorderNamedCells(header, 'managed-header-selector', order);
    reorderNamedCells(row, 'managed-cell-selector', order);

    assert.deepEqual(
        header.names(),
        [
            'r-checkbox',
            'status',
            'name',
            'emailAddress',
            'filler',
            'actions',
        ]
    );
    assert.deepEqual(
        row.names(),
        [
            'r-checkbox',
            'status',
            'name',
            'emailAddress',
            'filler',
            'buttons',
        ]
    );
    assert.deepEqual(
        header.names().slice(1, -2),
        row.names().slice(1, -2)
    );
});

test('only the filler absorbs unused width', () => {
    assert.deepEqual(
        calculateTableSizing(800, 500),
        {fillerWidth: 300, tableWidth: 800}
    );
    assert.deepEqual(
        calculateTableSizing(800, 440),
        {fillerWidth: 360, tableWidth: 800}
    );
    assert.deepEqual(
        calculateTableSizing(800, 900),
        {fillerWidth: 0, tableWidth: 900}
    );
});

test('header reorder starts only outside native interactive content', () => {
    const originalElement = globalThis.Element;

    class FakeElement {

        constructor(interactive) {
            this.interactive = interactive;
        }

        closest() {
            return this.interactive ? {} : null;
        }
    }

    globalThis.Element = FakeElement;

    try {
        assert.equal(
            canStartHeaderReorder(new FakeElement(false)),
            true
        );
        assert.equal(
            canStartHeaderReorder(new FakeElement(true)),
            false
        );
        assert.equal(canStartHeaderReorder(null), false);
    } finally {
        globalThis.Element = originalElement;
    }
});
