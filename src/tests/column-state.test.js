import assert from 'node:assert/strict';
import test from 'node:test';

import {
    applyOrderToLayout,
    buildDisplayOrder,
    canHideLayoutItem,
    getEligibleLayoutItems,
    reconcileOrder,
    reconcileState,
    togglePinnedColumn,
} from '../files/client/custom/modules/better-columns/src/utils/column-state.js';
import {
    combineContentWidths,
    constrainWidth,
    fitColumnWidths,
    findHeaderAtResizeBoundary,
    getFieldMinimumWidth,
    measureContentWidth,
} from '../files/client/custom/modules/better-columns/src/utils/field-sizing.js';
import isBetterColumnsEnabledForEntity from
    '../files/client/custom/modules/better-columns/src/utils/configuration.js';

test('eligible columns follow the active administrator layout', () => {
    const items = getEligibleLayoutItems([
        {name: 'name', link: true},
        {name: 'status'},
        {name: 'internal', noLabel: true},
        {name: 'forbidden', customLabel: ''},
        {name: 'status'},
    ]);

    assert.deepEqual(
        items.map(item => item.name),
        ['name', 'status']
    );
});

test('entity and administration configuration applies restrictions', () => {
    const createConfig = values => ({
        get: name => values[name],
    });

    assert.equal(
        isBetterColumnsEnabledForEntity(createConfig({}), 'Lead'),
        true
    );
    assert.equal(
        isBetterColumnsEnabledForEntity(
            createConfig({betterColumnsAdminEnabled: false}),
            'Lead',
            true
        ),
        false
    );
    assert.equal(
        isBetterColumnsEnabledForEntity(createConfig({}), 'Lead', true),
        false
    );
    assert.equal(
        isBetterColumnsEnabledForEntity(
            createConfig({betterColumnsAdminEnabled: true}),
            'Lead',
            true
        ),
        true
    );
    assert.equal(
        isBetterColumnsEnabledForEntity(
            createConfig({betterColumnsAdminEnabled: false}),
            'Lead'
        ),
        true
    );
    assert.equal(
        isBetterColumnsEnabledForEntity(createConfig({
            betterColumnsEnabled: false,
        }), 'Lead'),
        false
    );
    assert.equal(
        isBetterColumnsEnabledForEntity(createConfig({
            betterColumnsAllEntities: false,
            betterColumnsEntityList: ['Lead', 'Account'],
        }), 'Lead'),
        true
    );
    assert.equal(
        isBetterColumnsEnabledForEntity(createConfig({
            betterColumnsAllEntities: false,
            betterColumnsEntityList: ['Account'],
        }), 'Lead'),
        false
    );
});

test('stored order is reconciled with administrator additions and removals', () => {
    assert.deepEqual(
        reconcileOrder(
            ['emailAddress', 'removed', 'name'],
            ['name', 'status', 'emailAddress', 'assignedUser']
        ),
        ['emailAddress', 'assignedUser', 'name', 'status']
    );
});

test('version one width and order preferences are migrated', () => {
    const state = reconcileState(
        {
            version: 1,
            order: ['name'],
            widths: {name: 180, removed: 250},
        },
        [
            {name: 'name', link: true},
            {name: 'phoneNumber', hidden: true},
        ]
    );

    assert.deepEqual(state.order, ['name', 'phoneNumber']);
    assert.deepEqual(state.widths, {name: 180});
    assert.deepEqual(state.pinned, []);
    assert.equal(state.version, 3);
});

test('pinned preferences are filtered and deduplicated', () => {
    const state = reconcileState(
        {
            version: 3,
            order: ['name', 'status', 'removed'],
            pinned: ['status', 'removed', 'status', 'name', 'assignedUser', 'phoneNumber'],
            widths: {},
        },
        [
            {name: 'name', link: true},
            {name: 'status'},
            {name: 'assignedUser'},
            {name: 'phoneNumber'},
        ]
    );

    assert.deepEqual(state.pinned, ['status', 'name', 'assignedUser', 'phoneNumber']);
});

test('display order places pinned columns first in pin order', () => {
    assert.deepEqual(
        buildDisplayOrder(['name', 'status', 'email', 'phone'], ['email', 'phone']),
        ['email', 'phone', 'name', 'status']
    );
    assert.deepEqual(
        buildDisplayOrder(['name', 'status'], []),
        ['name', 'status']
    );
});

test('pinning has no count limit and unpinning keeps other pins', () => {
    let pinned = [];

    pinned = togglePinnedColumn(pinned, 'name');
    pinned = togglePinnedColumn(pinned, 'status');
    pinned = togglePinnedColumn(pinned, 'email');
    assert.deepEqual(pinned, ['name', 'status', 'email']);

    pinned = togglePinnedColumn(pinned, 'phone');
    assert.deepEqual(pinned, ['name', 'status', 'email', 'phone']);

    pinned = togglePinnedColumn(pinned, 'status');
    assert.deepEqual(pinned, ['name', 'email', 'phone']);
});

test('applying order preserves native visibility data', () => {
    const layout = applyOrderToLayout(
        [
            {name: 'name', hidden: true},
            {name: 'status', hidden: false},
        ],
        ['status', 'name']
    );

    assert.deepEqual(
        layout.map(item => [item.name, item.hidden]),
        [
            ['status', false],
            ['name', true],
        ]
    );
});

test('an empty preference restores administrator order and widths', () => {
    const state = reconcileState(null, [
        {name: 'name', widthPx: 220},
        {name: 'status', width: 20},
        {name: 'assignedUser'},
    ]);

    assert.deepEqual(state.order, ['name', 'status', 'assignedUser']);
    assert.deepEqual(state.widths, {});
});

test('all field types share the same compact minimum width', () => {
    assert.equal(getFieldMinimumWidth('name', 'varchar'), 56);
    assert.equal(getFieldMinimumWidth('emailAddress', 'email'), 56);
    assert.equal(getFieldMinimumWidth('amount', 'float'), 56);
    assert.equal(getFieldMinimumWidth('custom', 'unknown'), 56);
    assert.equal(constrainWidth(22.4, 56), 56);
    assert.equal(constrainWidth(147.6, 56), 148);
});

test('auto-fit can include targeted enum decoration widths', () => {
    assert.equal(
        combineContentWidths(72, 14, 8, 16),
        102
    );
    assert.equal(
        combineContentWidths(50, 10, 0, 16),
        76
    );
});

test('auto-fit uses the intrinsic rendered width of non-text decorations', () => {
    const originalDocument = globalThis.document;
    const originalWindow = globalThis.window;
    const originalInput = globalThis.HTMLInputElement;

    class FakeStyle {

        setProperty() {}

    }

    class FakeElement {

        constructor({intrinsicWidth = 0, text = ''} = {}) {
            this.intrinsicWidth = intrinsicWidth;
            this.innerText = text;
            this.textContent = text;
            this.scrollWidth = intrinsicWidth;
            this.style = new FakeStyle();
            this.className = '';
        }

        append() {}

        cloneNode() {
            return new FakeElement({
                intrinsicWidth: this.intrinsicWidth,
                text: this.textContent,
            });
        }

        closest() {
            return null;
        }

        getBoundingClientRect() {
            return {width: this.intrinsicWidth};
        }

        querySelectorAll() {
            return [];
        }

        remove() {}

        setAttribute() {}

    }

    const fakeBody = new FakeElement();

    globalThis.document = {
        body: fakeBody,
        createElement: name => name === 'canvas' ?
            {
                getContext: () => ({
                    measureText: () => ({width: 42}),
                }),
            } :
            new FakeElement(),
    };
    globalThis.window = {
        getComputedStyle: () => ({
            borderLeftWidth: '0',
            borderRightWidth: '0',
            font: '16px sans-serif',
            marginLeft: '0',
            marginRight: '0',
            paddingLeft: '0',
            paddingRight: '0',
        }),
    };
    globalThis.HTMLInputElement = class {};

    try {
        const assignedUserCell = new FakeElement({
            intrinsicWidth: 124,
            text: 'Admin',
        });

        assert.equal(
            measureContentWidth([assignedUserCell], 56),
            124
        );
    } finally {
        if (originalDocument === undefined) {
            delete globalThis.document;
        } else {
            globalThis.document = originalDocument;
        }

        if (originalWindow === undefined) {
            delete globalThis.window;
        } else {
            globalThis.window = originalWindow;
        }

        if (originalInput === undefined) {
            delete globalThis.HTMLInputElement;
        } else {
            globalThis.HTMLInputElement = originalInput;
        }
    }
});

test('reset widths fit the viewport without horizontal overflow', () => {
    const fitted = fitColumnWidths(
        {name: 240, status: 140, emailAddress: 220},
        420,
        56
    );

    assert.ok(Object.values(fitted).every(width => width >= 56));
    assert.ok(
        Object.values(fitted).reduce((sum, width) => sum + width, 0) <= 420
    );
});

test('reset can go below the resize minimum when columns cannot fit', () => {
    const fitted = fitColumnWidths(
        {name: 100, status: 100, emailAddress: 100},
        120,
        56
    );

    assert.deepEqual(fitted, {
        name: 40,
        status: 40,
        emailAddress: 40,
    });
});

test('resize boundaries take priority on both sides of separators', () => {
    const status = {
        getBoundingClientRect: () => ({left: 40, right: 140}),
    };
    const pipeline = {
        getBoundingClientRect: () => ({left: 140, right: 260}),
    };

    assert.equal(
        findHeaderAtResizeBoundary([status, pipeline], 128, false),
        status
    );
    assert.equal(
        findHeaderAtResizeBoundary([status, pipeline], 140, false),
        status
    );
    assert.equal(
        findHeaderAtResizeBoundary([status, pipeline], 146, false),
        status
    );
    assert.equal(
        findHeaderAtResizeBoundary([status, pipeline], 147, false),
        null
    );
    assert.equal(
        findHeaderAtResizeBoundary([status, pipeline], 152, true),
        pipeline
    );
    assert.equal(
        findHeaderAtResizeBoundary([status, pipeline], 134, true),
        pipeline
    );
    assert.equal(
        findHeaderAtResizeBoundary([status, pipeline], 133, true),
        null
    );
});

test('hideable columns match the Columns menu rules', () => {
    assert.equal(canHideLayoutItem({name: 'status'}), true);
    assert.equal(canHideLayoutItem({name: 'name', link: true}), false);
    assert.equal(canHideLayoutItem({name: 'internal', noLabel: true}), false);
    assert.equal(canHideLayoutItem({name: 'forbidden', customLabel: ''}), false);
    assert.equal(canHideLayoutItem({}), false);
    assert.equal(canHideLayoutItem(undefined), false);
});
