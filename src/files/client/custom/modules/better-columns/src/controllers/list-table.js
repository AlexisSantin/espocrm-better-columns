import {
    calculateTableSizing,
    constrainWidth,
    fitColumnWidths,
    findHeaderAtResizeBoundary,
    measureContentWidth,
} from 'better-columns:utils/field-sizing';
import {
    canStartHeaderReorder,
    reorderNamedCells,
} from
    'better-columns:utils/dom-order';
import {
    getDragPreviewPosition,
    getHeaderLabel,
} from 'better-columns:utils/drag-preview';

export default class ListTableController {

    /**
     * @param {import('./list-column-manager').default} manager
     */
    constructor(manager) {
        this.manager = manager;
        this.table = null;
        this.listElement = null;
        this.colMap = new Map();
        this.staticWidth = 0;
        this.activeInteraction = null;
        this.columnMenu = null;

        this.onPointerDownBind = this.onPointerDown.bind(this);
        this.onDoubleClickBind = this.onDoubleClick.bind(this);
        this.onTableClickBind = this.onTableClick.bind(this);
        this.onTablePointerMoveBind = this.onTablePointerMove.bind(this);
        this.onTablePointerLeaveBind = this.clearResizeHover.bind(this);
        this.onPointerMoveBind = this.onPointerMove.bind(this);
        this.onPointerUpBind = this.onPointerUp.bind(this);
        this.onPointerCancelBind = this.onPointerCancel.bind(this);
        this.onWindowResizeBind = this.layoutTable.bind(this);
        this.onColumnMenuClickBind = this.onColumnMenuClick.bind(this);
        this.onColumnMenuKeydownBind = this.onColumnMenuKeydown.bind(this);
        this.onDocumentPointerDownBind = this.onDocumentPointerDown.bind(this);
        this.onDocumentKeydownBind = this.onDocumentKeydown.bind(this);
        this.closeColumnMenuBind = this.closeColumnMenu.bind(this);
        this.updateScrollShadowBind = this.updateScrollShadow.bind(this);
    }

    attach() {
        const table = this.manager.view.element
            .querySelector('.list > table');

        if (this.columnMenu && !this.columnMenu.button.isConnected) {
            this.closeColumnMenu();
        }

        if (!table) {
            this.detachTable();

            return;
        }

        if (this.table !== table) {
            this.detachTable();
            this.table = table;
            this.listElement = table.closest('.list');
            this.listElement?.addEventListener(
                'scroll',
                this.updateScrollShadowBind,
                { passive: true }
            );
            table.addEventListener('pointerdown', this.onPointerDownBind);
            table.addEventListener('dblclick', this.onDoubleClickBind);
            table.addEventListener('click', this.onTableClickBind);
            table.addEventListener(
                'pointermove',
                this.onTablePointerMoveBind
            );
            table.addEventListener(
                'pointerleave',
                this.onTablePointerLeaveBind
            );
            window.addEventListener('resize', this.onWindowResizeBind);
        }

        this.listElement?.classList.add('better-columns-list');
        table.classList.add('column-resizable', 'better-columns-managed-table');
        this.prepareHeaders();
        this.applyColumnOrder();
        this.captureInitialWidths();
        this.buildColumnModel();
        this.layoutTable();
    }

    applyColumnOrder() {
        if (!this.table) {
            return;
        }

        const headerRow = this.table.querySelector(
            ':scope > thead > tr'
        );

        if (headerRow) {
            this.reorderRowCells(
                headerRow,
                ':scope > th.field-header-cell[data-name]'
            );
        }

        this.table.querySelectorAll(':scope > tbody > tr.list-row')
            .forEach(row => {
                this.reorderRowCells(
                    row,
                    ':scope > td.cell[data-name]'
                );
            });
    }

    reorderRowCells(row, selector) {
        const order = this.manager.getDisplayOrder();

        reorderNamedCells(row, selector, order);
    }

    prepareHeaders() {
        this.getFieldHeaders().forEach(header => {
            let resizer = header.querySelector(':scope > .column-resizer');

            if (!resizer) {
                resizer = document.createElement('div');
                resizer.className = 'column-resizer';
                header.append(resizer);
            }

            resizer.classList.add(
                'column-resizer-right',
                'better-columns-resizer'
            );
            resizer.title = this.translate('Resize Column');

            this.ensureColumnMenuButton(header);
        });
    }

    ensureColumnMenuButton(header) {
        if (header.querySelector(':scope > .better-columns-column-menu-button')) {
            return;
        }

        const label = this.translate('Column Options');
        const button = document.createElement('button');

        button.type = 'button';
        button.className = 'better-columns-column-menu-button';
        button.title = label;
        button.setAttribute('aria-label', label);
        button.setAttribute('aria-haspopup', 'menu');
        button.setAttribute('aria-expanded', 'false');
        button.innerHTML = '<span class="fas fa-ellipsis-v"></span>';
        header.append(button);
    }

    toggleColumnMenu(button, name) {
        if (this.columnMenu?.button === button) {
            this.closeColumnMenu();

            return;
        }

        this.openColumnMenu(button, name);
    }

    openColumnMenu(button, name) {
        this.closeColumnMenu();

        const element = document.createElement('ul');

        element.className = 'dropdown-menu better-columns-column-menu';
        element.setAttribute('role', 'menu');
        element.append(this.createPinMenuItem(name));

        if (this.manager.canHideColumn(name)) {
            element.append(this.createHideMenuItem());
        }

        if (this.manager.canFilterColumn(name)) {
            element.append(this.createFilterMenuItem());
        }

        document.body.append(element);

        this.columnMenu = {button, element, name};
        button.setAttribute('aria-expanded', 'true');
        this.positionColumnMenu(button, element);
        element.querySelector('[role="menuitem"]:not([aria-disabled="true"])')
            ?.focus();

        element.addEventListener('click', this.onColumnMenuClickBind);
        element.addEventListener('keydown', this.onColumnMenuKeydownBind);
        document.addEventListener(
            'pointerdown',
            this.onDocumentPointerDownBind,
            true
        );
        document.addEventListener('keydown', this.onDocumentKeydownBind, true);
        window.addEventListener('resize', this.closeColumnMenuBind);
        window.addEventListener('scroll', this.closeColumnMenuBind, true);
    }

    createFilterMenuItem() {
        const item = document.createElement('li');
        const action = document.createElement('a');

        action.role = 'menuitem';
        action.tabIndex = -1;
        action.dataset.action = 'betterColumnsFilterColumn';
        action.setAttribute('aria-disabled', 'false');
        action.innerHTML = [
            '<span class="item-text"></span>',
            '<span class="item-icon fas fa-filter"></span>',
        ].join(' ');
        action.querySelector('.item-text').textContent =
            this.translate('Filter Column');
        item.append(action);

        return item;
    }

    createPinMenuItem(name) {
        const pinned = this.manager.isPinned(name);
        const label = this.translate(pinned ? 'Unpin Column' : 'Pin Column');
        const item = document.createElement('li');
        const action = document.createElement('a');

        action.role = 'menuitem';
        action.tabIndex = -1;
        action.dataset.action = 'betterColumnsTogglePin';
        action.setAttribute('aria-disabled', 'false');
        action.innerHTML = [
            `<span class="item-text"></span>`,
            '<span class="item-icon fas fa-thumbtack"></span>',
        ].join(' ');
        action.querySelector('.item-text').textContent = label;
        item.append(action);

        return item;
    }

    createHideMenuItem() {
        const item = document.createElement('li');
        const action = document.createElement('a');

        action.role = 'menuitem';
        action.tabIndex = -1;
        action.dataset.action = 'betterColumnsHideColumn';
        action.setAttribute('aria-disabled', 'false');
        action.innerHTML = [
            '<span class="item-text"></span>',
            '<span class="item-icon fas fa-eye-slash"></span>',
        ].join(' ');
        action.querySelector('.item-text').textContent =
            this.translate('Hide Column');
        item.append(action);

        return item;
    }

    positionColumnMenu(button, element) {
        const rect = button.getBoundingClientRect();
        const width = element.offsetWidth;
        const isRtl = document.documentElement.dir === 'rtl';
        const preferred = isRtl ? rect.left : rect.right - width;
        const left = Math.min(
            Math.max(8, preferred),
            window.innerWidth - width - 8
        );

        element.style.left = `${Math.round(left)}px`;
        element.style.top = `${Math.round(rect.bottom + 4)}px`;
    }

    closeColumnMenu() {
        if (!this.columnMenu) {
            return;
        }

        const {button, element} = this.columnMenu;

        this.columnMenu = null;
        element.remove();
        button.setAttribute('aria-expanded', 'false');
        document.removeEventListener(
            'pointerdown',
            this.onDocumentPointerDownBind,
            true
        );
        document.removeEventListener(
            'keydown',
            this.onDocumentKeydownBind,
            true
        );
        window.removeEventListener('resize', this.closeColumnMenuBind);
        window.removeEventListener('scroll', this.closeColumnMenuBind, true);
    }

    onColumnMenuClick(event) {
        const action = event.target.closest('[role="menuitem"]');

        if (!action || action.getAttribute('aria-disabled') === 'true') {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        const name = this.columnMenu?.name;
        const actionName = action.dataset.action;

        this.closeColumnMenu();

        if (!name) {
            return;
        }

        if (actionName === 'betterColumnsHideColumn') {
            void this.manager.setColumnHidden(name, true);

            return;
        }

        if (actionName === 'betterColumnsFilterColumn') {
            void this.manager.activateColumnFilter(name);

            return;
        }

        void this.manager.togglePin(name);
    }

    onColumnMenuKeydown(event) {
        const items = [
            ...(this.columnMenu?.element.querySelectorAll(
                '[role="menuitem"]:not([aria-disabled="true"])'
            ) || []),
        ];
        const index = items.indexOf(document.activeElement);

        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            const step = event.key === 'ArrowDown' ? 1 : -1;

            items[(index + step + items.length) % items.length]?.focus();

            return;
        }

        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            document.activeElement?.click();
        }
    }

    onDocumentPointerDown(event) {
        if (!this.columnMenu) {
            return;
        }

        const {button, element} = this.columnMenu;

        if (element.contains(event.target) || button.contains(event.target)) {
            return;
        }

        this.closeColumnMenu();
    }

    onDocumentKeydown(event) {
        if (!this.columnMenu) {
            return;
        }

        if (event.key === 'Escape') {
            const button = this.columnMenu.button;

            event.preventDefault();
            event.stopPropagation();
            this.closeColumnMenu();
            button.focus();

            return;
        }

        if (event.key === 'Tab') {
            this.closeColumnMenu();
        }
    }

    translate(key) {
        return this.manager.view.translate(key, 'labels', 'BetterColumns');
    }

    captureInitialWidths() {
        let map = {};

        this.getFieldHeaders().forEach(header => {
            map[header.dataset.name] = header.getBoundingClientRect().width;
        });

        if (this.manager.shouldFitInitialWidths()) {
            map = fitColumnWidths(
                map,
                this.getAvailableFieldWidth(),
                this.manager.getMinimumWidth()
            );
            this.manager.captureWidths(map, 1);

            return;
        }

        this.manager.captureWidths(map);
    }

    getAvailableFieldWidth() {
        const headerRow = this.table?.querySelector(
            ':scope > thead > tr'
        );

        if (!headerRow || !this.listElement) {
            return 0;
        }

        const staticWidth = [...headerRow.children]
            .filter(header =>
                !header.classList.contains('better-columns-filler-cell') &&
                (
                    !header.classList.contains('field-header-cell') ||
                    header.classList.contains('action-cell')
                )
            )
            .reduce(
                (width, header) =>
                    width + header.getBoundingClientRect().width,
                0
            );

        return Math.max(
            0,
            this.listElement.clientWidth -
                staticWidth -
                this.getTableBorderWidth()
        );
    }

    getTableBorderWidth() {
        if (!this.table) {
            return 0;
        }

        const style = getComputedStyle(this.table);

        return (parseFloat(style.borderLeftWidth) || 0) +
            (parseFloat(style.borderRightWidth) || 0);
    }

    buildColumnModel() {
        this.table.querySelector(
            ':scope > colgroup.better-columns-colgroup'
        )?.remove();

        const headerRow = this.table.querySelector(':scope > thead > tr');

        if (!headerRow) {
            return;
        }

        this.ensureFillerCells(headerRow);

        const colgroup = document.createElement('colgroup');

        colgroup.className = 'better-columns-colgroup';
        this.colMap.clear();
        this.staticWidth = 0;

        [...headerRow.children].forEach(header => {
            const col = document.createElement('col');
            const name = header.dataset.name;

            if (name && header.classList.contains('field-header-cell')) {
                col.dataset.name = name;
                this.colMap.set(name, col);
            } else if (header.classList.contains('better-columns-filler-cell')) {
                col.className = 'better-columns-filler-col';
            } else {
                const width = Math.ceil(
                    header.getBoundingClientRect().width
                );

                col.style.width = `${width}px`;
                this.staticWidth += width;
            }

            colgroup.append(col);
        });

        this.table.prepend(colgroup);
    }

    ensureFillerCells(headerRow) {
        this.placeFillerCell(
            headerRow,
            'th',
            ':scope > th.action-cell'
        );

        this.table.querySelectorAll(':scope > tbody > tr.list-row')
            .forEach(row => {
                this.placeFillerCell(
                    row,
                    'td',
                    ':scope > td[data-name="buttons"]'
                );
            });
    }

    placeFillerCell(row, tagName, boundarySelector) {
        const fillers = [
            ...row.querySelectorAll(
                ':scope > .better-columns-filler-cell'
            ),
        ];
        const filler = fillers.shift() ||
            document.createElement(tagName);
        const boundary = row.querySelector(boundarySelector);

        fillers.forEach(element => element.remove());
        filler.className = 'better-columns-filler-cell';
        filler.setAttribute('aria-hidden', 'true');

        boundary ?
            row.insertBefore(filler, boundary) :
            row.append(filler);
    }

    layoutTable() {
        if (!this.table?.isConnected || !this.listElement) {
            return;
        }

        const state = this.manager.getState();

        if (!state) {
            return;
        }

        let fieldWidth = 0;

        this.colMap.forEach((col, name) => {
            const storedWidth = state.widths[name];
            const width = Number.isFinite(storedWidth) ?
                Math.max(1, storedWidth) :
                this.manager.getMinimumWidth();

            col.style.width = `${width}px`;
            fieldWidth += width;
        });

        const borderWidth = this.getTableBorderWidth();
        const available = Math.max(
            0,
            this.listElement.clientWidth - borderWidth
        );
        const fixedWidth = this.staticWidth + fieldWidth;
        const sizing = calculateTableSizing(available, fixedWidth);
        const filler = this.table.querySelector(
            ':scope > colgroup > col.better-columns-filler-col'
        );

        if (filler) {
            filler.style.width = `${sizing.fillerWidth}px`;
        }

        this.table.style.width = `${sizing.tableWidth + borderWidth}px`;
        this.table.style.minWidth = '';
        this.table.style.tableLayout = 'fixed';
        this.applyPinnedLayout();
    }

    applyPinnedLayout() {
        this.clearPinnedLayout();

        const headerRow = this.table?.querySelector(':scope > thead > tr');
        const pinned = (this.manager.getState()?.pinned || []).filter(name =>
            headerRow?.querySelector(`:scope > th[data-name="${this.escapeName(name)}"]`)
        );

        if (!headerRow || !pinned.length) {
            return;
        }

        const side = document.documentElement.dir === 'rtl' ?
            'right' :
            'left';
        const leading = [];
        const checkbox = headerRow.querySelector(':scope > th.checkbox-cell[data-name]');

        if (checkbox) {
            leading.push(checkbox.dataset.name);
        }

        leading.push(...pinned);

        let offset = 0;

        // Hidden pinned columns have no header cell, so the edge is the last rendered one.
        const rendered = leading
            .map(name => ({
                name,
                header: headerRow.querySelector(
                    `:scope > th[data-name="${this.escapeName(name)}"]`
                ),
            }))
            .filter(item => item.header);

        rendered.forEach(({ name, header }, index) => {
            const selector = `[data-name="${this.escapeName(name)}"]`;
            const isEdge = index === rendered.length - 1;
            const cells = [
                header,
                ...this.table.querySelectorAll(
                    `:scope > tbody > tr.list-row > td${selector}`
                ),
            ];

            cells.forEach(cell => {
                cell.classList.add('better-columns-pinned');
                cell.classList.toggle('better-columns-pinned-edge', isEdge);
                cell.style.position = 'sticky';
                cell.style[side] = `${offset}px`;
                cell.style.zIndex = cell === header ? '3' : '2';
            });

            offset += header.getBoundingClientRect().width;
        });

        this.updateScrollShadow();
    }

    updateScrollShadow() {
        const scrolled = Math.abs(this.listElement?.scrollLeft || 0) > 0;

        this.table?.classList.toggle('better-columns-scrolled', scrolled);
    }

    clearPinnedLayout() {
        this.table?.querySelectorAll('.better-columns-pinned')
            .forEach(cell => {
                cell.classList.remove(
                    'better-columns-pinned',
                    'better-columns-pinned-edge'
                );
                cell.style.position = '';
                cell.style.left = '';
                cell.style.right = '';
                cell.style.zIndex = '';
            });
    }

    escapeName(name) {
        return window.CSS?.escape ?
            window.CSS.escape(name) :
            name.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
    }

    onPointerDown(event) {
        const resizer = event.target.closest('.better-columns-resizer');
        const reorderHeader = event.target.closest(
            'th.field-header-cell[data-name]:not(.action-cell)'
        );
        const header = resizer?.closest('th[data-name]') ||
            this.getResizeHeaderAtPointer(event);

        if (header) {
            this.startResize(event, header);

            return;
        }

        if (
            reorderHeader &&
            canStartHeaderReorder(event.target)
        ) {
            this.startReorder(event, reorderHeader);
        }
    }

    startResize(event, header) {
        if (!event.isPrimary || event.button !== 0) {
            return;
        }

        const name = header?.dataset.name;

        if (!name) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        const width = this.manager.getState().widths[name] ||
            header.getBoundingClientRect().width;

        this.activeInteraction = {
            type: 'resize',
            name,
            startX: event.clientX,
            startWidth: width,
            width,
            minimum: this.manager.getMinimumWidth(),
        };

        header.classList.add('being-resized');
        document.body.classList.add('better-columns-is-resizing');
        this.createGuide(event.clientX, 'resize');
        this.bindWindowPointerEvents();
    }

    startReorder(event, source) {
        if (!event.isPrimary || event.button !== 0) {
            return;
        }

        const header = source.closest('th[data-name]');
        const name = header?.dataset.name;
        const headerRect = header?.getBoundingClientRect();

        if (!name) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        this.activeInteraction = {
            type: 'reorder',
            name,
            source: header,
            startX: event.clientX,
            active: false,
            beforeName: null,
            dragPreview: null,
            previewOffsetX: event.clientX - headerRect.left,
            previewOffsetY: event.clientY - headerRect.top,
        };
        this.bindWindowPointerEvents();
    }

    bindWindowPointerEvents() {
        window.addEventListener('pointermove', this.onPointerMoveBind);
        window.addEventListener('pointerup', this.onPointerUpBind);
        window.addEventListener('pointercancel', this.onPointerCancelBind);
    }

    onPointerMove(event) {
        if (!this.activeInteraction) {
            return;
        }

        if (this.activeInteraction.type === 'resize') {
            const direction =
                document.documentElement.dir === 'rtl' ? -1 : 1;
            const delta =
                (event.clientX - this.activeInteraction.startX) * direction;
            const width = constrainWidth(
                this.activeInteraction.startWidth + delta,
                this.activeInteraction.minimum
            );

            this.activeInteraction.width = width;
            this.manager.getState().widths[
                this.activeInteraction.name
            ] = width;
            this.updateGuide(event.clientX);
            this.layoutTable();

            return;
        }

        if (
            !this.activeInteraction.active &&
            Math.abs(event.clientX - this.activeInteraction.startX) < 5
        ) {
            return;
        }

        this.activeInteraction.active = true;
        document.body.classList.add('better-columns-is-reordering');
        this.createDragPreview(this.activeInteraction.source);

        const draggedName = this.activeInteraction.name;
        const draggingPinned = this.manager.isPinned(draggedName);
        const groupHeaders = this.getFieldHeaders()
            .filter(header =>
                this.manager.isPinned(header.dataset.name) === draggingPinned
            );
        const headers = groupHeaders
            .filter(header => header.dataset.name !== draggedName);
        const target = headers.find(header => {
            const rect = header.getBoundingClientRect();

            return event.clientX < rect.left + rect.width / 2;
        });

        this.activeInteraction.beforeName = target?.dataset.name || null;
        this.createGuide(
            target ?
                target.getBoundingClientRect().left :
                this.getLastFieldBoundary(groupHeaders),
            'reorder'
        );
        this.updateDragPreview(event.clientX, event.clientY);
    }

    async onPointerUp() {
        const interaction = this.activeInteraction;

        if (!interaction) {
            return;
        }

        this.cleanupInteraction();

        if (interaction.type === 'resize') {
            this.manager.setWidth(interaction.name, interaction.width);

            return;
        }

        if (interaction.active) {
            await this.manager.moveColumn(
                interaction.name,
                interaction.beforeName
            );
        }
    }

    onPointerCancel() {
        const interaction = this.activeInteraction;

        if (interaction?.type === 'resize') {
            this.manager.getState().widths[interaction.name] =
                interaction.startWidth;
            this.layoutTable();
        }

        this.cleanupInteraction();
    }

    onDoubleClick(event) {
        const resizer = event.target.closest('.better-columns-resizer');
        const header = resizer?.closest('th[data-name]') ||
            this.getResizeHeaderAtPointer(event);

        if (!header) {
            return;
        }

        const name = header?.dataset.name;

        if (!name) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        this.manager.setWidth(name, this.measureColumnWidth(name));
        this.layoutTable();
    }

    measureColumnWidth(name) {
        const escaped = window.CSS?.escape ?
            window.CSS.escape(name) :
            name.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
        const cells = [
            ...this.table.querySelectorAll(
                `:scope > tbody > tr.list-row > td.cell[data-name="${escaped}"]`
            ),
        ];

        return measureContentWidth(
            cells,
            this.manager.getMinimumWidth()
        );
    }

    fitAllColumns() {
        if (!this.table?.isConnected || !this.manager.getState()) {
            return;
        }

        this.colMap.forEach((col, name) => {
            this.manager.setWidth(name, this.measureColumnWidth(name));
        });
        this.layoutTable();
    }

    onTableClick(event) {
        const button = event.target.closest('.better-columns-column-menu-button');

        if (!button || !this.table?.contains(button)) {
            return;
        }

        const name = button.closest('th[data-name]')?.dataset.name;

        if (!name) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        this.toggleColumnMenu(button, name);
    }

    onTablePointerMove(event) {
        if (this.activeInteraction) {
            return;
        }

        const header = this.getResizeHeaderAtPointer(event);

        this.table?.classList.toggle(
            'better-columns-resize-hot',
            Boolean(header)
        );
        this.table?.querySelector('th.better-columns-resize-hot')
            ?.classList.remove('better-columns-resize-hot');
        header?.classList.add('better-columns-resize-hot');
    }

    getResizeHeaderAtPointer(event) {
        if (!event.target.closest('thead')) {
            return null;
        }

        return findHeaderAtResizeBoundary(
            this.getFieldHeaders(),
            event.clientX,
            document.documentElement.dir === 'rtl'
        );
    }

    clearResizeHover() {
        this.table?.classList.remove('better-columns-resize-hot');
        this.table?.querySelector('th.better-columns-resize-hot')
            ?.classList.remove('better-columns-resize-hot');
    }

    createGuide(x, type) {
        let guide = document.querySelector('.better-columns-column-guide');

        if (!guide) {
            guide = document.createElement('div');
            guide.className = 'better-columns-column-guide';
            document.body.append(guide);
        }

        guide.dataset.type = type;
        guide.style.left = `${Math.round(x)}px`;

        if (this.table) {
            const rect = this.table.getBoundingClientRect();

            guide.style.top = `${Math.round(rect.top)}px`;
            guide.style.height = `${Math.round(rect.height)}px`;
        }
    }

    updateGuide(x) {
        const guide = document.querySelector('.better-columns-column-guide');

        if (guide) {
            guide.style.left = `${Math.round(x)}px`;
        }
    }

    createDragPreview(header) {
        if (!this.activeInteraction || this.activeInteraction.dragPreview) {
            return;
        }

        const preview = document.createElement('div');
        const clone = header.cloneNode(true);
        const content = document.createElement('div');
        const rect = header.getBoundingClientRect();

        preview.className = 'better-columns-column-drag-preview';
        preview.setAttribute('aria-hidden', 'true');
        preview.setAttribute('inert', '');
        preview.dataset.name = header.dataset.name || '';

        clone.querySelectorAll(
            '.better-columns-resizer, .column-resizer, .better-columns-column-menu-button'
        )
            .forEach(element => element.remove());
        clone.removeAttribute('id');
        clone.querySelectorAll('[id], [tabindex]')
            .forEach(element => {
                element.removeAttribute('id');
                element.removeAttribute('tabindex');
            });

        content.className = 'better-columns-column-drag-preview-content';
        while (clone.firstChild) {
            content.append(clone.firstChild);
        }

        if (content.textContent?.trim() || content.children.length) {
            preview.append(content);
        } else {
            preview.textContent = getHeaderLabel(header);
        }

        if (rect.width) {
            preview.style.width = `${Math.round(rect.width)}px`;
        }

        if (rect.height) {
            preview.style.height = `${Math.round(rect.height)}px`;
        }

        document.body.append(preview);
        this.activeInteraction.dragPreview = preview;
    }

    updateDragPreview(clientX, clientY) {
        const preview = this.activeInteraction?.dragPreview;

        if (!preview) {
            return;
        }

        const rect = preview.getBoundingClientRect();
        const position = getDragPreviewPosition(
            clientX,
            clientY,
            rect.width,
            rect.height,
            window.innerWidth,
            window.innerHeight,
            this.activeInteraction.previewOffsetX,
            this.activeInteraction.previewOffsetY
        );

        preview.style.left = `${position.left}px`;
        preview.style.top = `${position.top}px`;
    }

    getLastFieldBoundary(headers = this.getFieldHeaders()) {
        const last = headers[headers.length - 1];

        return last ? last.getBoundingClientRect().right : 0;
    }

    getFieldHeaders() {
        if (!this.table) {
            return [];
        }

        return [...this.table.querySelectorAll(
            ':scope > thead > tr > th.field-header-cell[data-name]'
        )].filter(header => !header.classList.contains('action-cell'));
    }

    cleanupInteraction() {
        window.removeEventListener('pointermove', this.onPointerMoveBind);
        window.removeEventListener('pointerup', this.onPointerUpBind);
        window.removeEventListener('pointercancel', this.onPointerCancelBind);
        document.body.classList.remove(
            'better-columns-is-resizing',
            'better-columns-is-reordering'
        );
        this.activeInteraction?.dragPreview?.remove();
        this.table?.querySelector('th.being-resized')
            ?.classList.remove('being-resized');
        this.clearResizeHover();
        document.querySelector('.better-columns-column-guide')?.remove();
        document.querySelector(
            '.better-columns-column-drag-preview'
        )?.remove();
        this.activeInteraction = null;
    }

    detachTable() {
        this.cleanupInteraction();
        this.closeColumnMenu();

        if (this.table) {
            this.table.removeEventListener(
                'pointerdown',
                this.onPointerDownBind
            );
            this.table.removeEventListener(
                'dblclick',
                this.onDoubleClickBind
            );
            this.table.removeEventListener('click', this.onTableClickBind);
            this.table.removeEventListener(
                'pointermove',
                this.onTablePointerMoveBind
            );
            this.table.removeEventListener(
                'pointerleave',
                this.onTablePointerLeaveBind
            );
        }

        window.removeEventListener('resize', this.onWindowResizeBind);
        this.listElement?.removeEventListener(
            'scroll',
            this.updateScrollShadowBind
        );
        this.listElement?.classList.remove('better-columns-list');
        this.table?.querySelectorAll('.better-columns-filler-cell')
            .forEach(element => element.remove());
        this.table = null;
        this.listElement = null;
        this.colMap.clear();
    }

    dispose() {
        this.detachTable();
        document.querySelector('.better-columns-column-guide')?.remove();
    }
}
