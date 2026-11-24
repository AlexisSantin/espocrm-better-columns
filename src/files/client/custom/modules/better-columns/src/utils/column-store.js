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

import {
    columnStateVersion,
    reconcileState,
} from 'better-columns:utils/column-state';

export default class ColumnStore {

    /**
     * @param {import('storage').default} storage
     * @param {string} entityType
     * @param {string} layoutName
     * @param {string} userId
     */
    constructor(storage, entityType, layoutName, userId) {
        this.storage = storage;
        this.key = `${layoutName}-${entityType}-${userId}`;
        this.state = null;
    }

    /**
     * @param {Array<Record<string, any>>} administratorLayout
     */
    load(administratorLayout) {
        const raw = this.storage.get('betterColumns', this.key);

        this.state = reconcileState(raw, administratorLayout);

        return this.state;
    }

    save() {
        if (!this.state) {
            return;
        }

        this.state.version = columnStateVersion;
        this.storage.set('betterColumns', this.key, this.state);
    }

    clear() {
        this.storage.clear('betterColumns', this.key);
        this.state = null;
    }
}

