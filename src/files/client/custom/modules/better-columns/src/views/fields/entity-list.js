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

import MultiEnumFieldView from 'views/fields/multi-enum';

export default class BetterColumnsEntityListFieldView
    extends MultiEnumFieldView {

    setup() {
        const scopeList = Object.keys(
            this.getMetadata().get('scopes') || {}
        );

        this.params.options = scopeList
            .filter(scope => {
                const defs =
                    this.getMetadata().get(['scopes', scope]) || {};

                return Boolean(
                    defs.entity &&
                    defs.object &&
                    !defs.disabled &&
                    scope !== 'Settings'
                );
            })
            .sort((scopeA, scopeB) =>
                this.translate(scopeA, 'scopeNamesPlural')
                    .localeCompare(
                        this.translate(scopeB, 'scopeNamesPlural')
                    )
            );

        super.setup();
    }
}
