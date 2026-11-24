<?php
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

use Espo\Core\Container;
use Espo\Core\InjectableFactory;
use Espo\Core\Utils\Config\ConfigWriter;

/**
 * Called when the extension is uninstalled.
 */
class AfterUninstall
{
    public function run(Container $container): void
    {
        $factory = $container->getByClass(InjectableFactory::class);
        $configWriter = $factory->create(ConfigWriter::class);

        foreach ([
            'betterColumnsEnabled',
            'betterColumnsAdminEnabled',
            'betterColumnsAllEntities',
            'betterColumnsEntityList',
        ] as $name) {
            $configWriter->remove($name);
        }

        $configWriter->save();
    }
}

