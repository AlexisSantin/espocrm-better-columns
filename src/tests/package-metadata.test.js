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
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const clientMetadataPath = new URL(
    '../files/custom/Espo/Modules/BetterColumns/Resources/metadata/app/client.json',
    import.meta.url
);
const adminPanelMetadataPath = new URL(
    '../files/custom/Espo/Modules/BetterColumns/Resources/metadata/app/adminPanel.json',
    import.meta.url
);
const settingsMetadataPath = new URL(
    '../files/custom/Espo/Modules/BetterColumns/Resources/metadata/entityDefs/Settings.json',
    import.meta.url
);
const settingsLayoutPath = new URL(
    '../files/custom/Espo/Modules/BetterColumns/Resources/layouts/Settings/betterColumns.json',
    import.meta.url
);

test('the bundled frontend initializer is loaded by EspoCRM', async () => {
    const metadata = JSON.parse(
        await readFile(clientMetadataPath, 'utf8')
    );

    assert.deepEqual(metadata.scriptList, [
        '__APPEND__',
        'client/custom/modules/better-columns/lib/init.js',
    ]);
});

test('administration entry opens the Better Columns settings view', async () => {
    const metadata = JSON.parse(
        await readFile(adminPanelMetadataPath, 'utf8')
    );
    const item = metadata.customization.itemList[1];

    assert.equal(item.url, '#Admin/betterColumns');
    assert.equal(
        item.recordView,
        'better-columns:views/admin/settings'
    );
});

test('settings expose global, administration, bottom panel, and per-entity activation fields', async () => {
    const metadata = JSON.parse(
        await readFile(settingsMetadataPath, 'utf8')
    );

    assert.deepEqual(
        Object.keys(metadata.fields),
        [
            'betterColumnsEnabled',
            'betterColumnsAdminEnabled',
            'betterColumnsBottomPanelEnabled',
            'betterColumnsAllEntities',
            'betterColumnsEntityList',
        ]
    );
    assert.equal(
        metadata.fields.betterColumnsAdminEnabled.default,
        false
    );
    assert.equal(
        metadata.fields.betterColumnsEntityList.type,
        'multiEnum'
    );

    const layout = JSON.parse(
        await readFile(settingsLayoutPath, 'utf8')
    );

    assert.deepEqual(
        layout[0].rows.map(row => row[0].name),
        [
            'betterColumnsEnabled',
            'betterColumnsAdminEnabled',
            'betterColumnsBottomPanelEnabled',
            'betterColumnsAllEntities',
            'betterColumnsEntityList',
        ]
    );
});
