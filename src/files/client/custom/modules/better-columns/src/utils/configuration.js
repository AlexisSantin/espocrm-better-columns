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
 * Keeps compatible entities enabled until an administrator explicitly limits
 * the extension to selected entities.
 *
 * @param {import('models/settings').default} config
 * @param {string} entityType
 * @param {boolean} [isAdministration=false]
 * @param {boolean} [isBottomPanel=false]
 * @return {boolean}
 */
export default function isBetterColumnsEnabledForEntity(
    config,
    entityType,
    isAdministration = false,
    isBottomPanel = false
) {
    if (config.get('betterColumnsEnabled') === false) {
        return false;
    }

    if (
        isAdministration &&
        config.get('betterColumnsAdminEnabled') !== true
    ) {
        return false;
    }

    if (
        isBottomPanel &&
        config.get('betterColumnsBottomPanelEnabled') !== true
    ) {
        return false;
    }

    if (config.get('betterColumnsAllEntities') !== false) {
        return true;
    }

    const entityList = config.get('betterColumnsEntityList');

    return Array.isArray(entityList) &&
        entityList.includes(entityType);
}
