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

import SettingsEditRecordView from 'views/settings/record/edit';

export default class BetterColumnsSettingsView
    extends SettingsEditRecordView {

    layoutName = 'betterColumns'

    dynamicLogicDefs = {
        fields: {
            betterColumnsAdminEnabled: {
                visible: {
                    conditionGroup: [
                        {
                            attribute: 'betterColumnsEnabled',
                            type: 'isTrue',
                        },
                    ],
                },
            },
            betterColumnsBottomPanelEnabled: {
                visible: {
                    conditionGroup: [
                        {
                            attribute: 'betterColumnsEnabled',
                            type: 'isTrue',
                        },
                    ],
                },
            },
            betterColumnsAllEntities: {
                visible: {
                    conditionGroup: [
                        {
                            attribute: 'betterColumnsEnabled',
                            type: 'isTrue',
                        },
                    ],
                },
            },
            betterColumnsEntityList: {
                visible: {
                    conditionGroup: [
                        {
                            attribute: 'betterColumnsEnabled',
                            type: 'isTrue',
                        },
                        {
                            attribute: 'betterColumnsAllEntities',
                            type: 'isFalse',
                        },
                    ],
                },
            },
        },
    }

    setup() {
        if (this.model.get('betterColumnsEnabled') == null) {
            this.model.set('betterColumnsEnabled', true);
        }

        if (this.model.get('betterColumnsAdminEnabled') == null) {
            this.model.set('betterColumnsAdminEnabled', false);
        }

        if (this.model.get('betterColumnsBottomPanelEnabled') == null) {
            this.model.set('betterColumnsBottomPanelEnabled', false);
        }

        if (this.model.get('betterColumnsAllEntities') == null) {
            this.model.set('betterColumnsAllEntities', true);
        }

        if (this.model.get('betterColumnsEntityList') == null) {
            this.model.set('betterColumnsEntityList', []);
        }

        super.setup();
    }
}
