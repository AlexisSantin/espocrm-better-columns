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

import ListColumnManager from
    'better-columns:controllers/list-column-manager';

export default class ListColumnsSetupHandler {

    constructor(view) {
        this.view = view;
    }

    process() {
        const existingManager = this.view._betterColumnsManager;

        if (
            !this.view.entityType ||
            !this.view.header ||
            existingManager && !existingManager.removed
        ) {
            return;
        }

        try {
            const manager = new ListColumnManager(this.view);

            this.view._betterColumnsManager = manager;
            manager.setup();
        } catch (error) {
            console.error(
                'Better Columns setup failed.',
                error
            );
        }
    }
}
