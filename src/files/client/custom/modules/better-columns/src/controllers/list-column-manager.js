import ColumnStore from 'better-columns:utils/column-store';
import {
    applyOrderToLayout,
    buildDisplayOrder,
    canHideLayoutItem,
    togglePinnedColumn,
} from 'better-columns:utils/column-state';
import {getFieldMinimumWidth} from 'better-columns:utils/field-sizing';
import isBetterColumnsEnabledForEntity from
    'better-columns:utils/configuration';
import ListTableController from
    'better-columns:controllers/list-table';

export default class ListColumnManager {

    /**
     * @param {import('views/record/list-base').default} view
     */
    constructor(view) {
        this.view = view;
        this.entityType = view.entityType || view.scope;
        this.layoutName = view.layoutName || view.type || 'list';
        this.store = new ColumnStore(
            view.getStorage(),
            this.entityType,
            this.layoutName,
            view.getUser().id
        );
        this.administratorLayout = null;
        this.state = null;
        this.tableController = new ListTableController(this);
        this.removed = false;
        this.settingsElement = null;
        this.settingsMenuOpen = false;
        this.observedElement = null;
        this.domObserver = null;
        this.reconcileFrame = null;

        this.onSettingsClickBind = this.onSettingsClick.bind(this);
        this.onDocumentClickBind = this.onDocumentClick.bind(this);
        this.onViewRemoveBind = this.onViewRemove.bind(this);
    }

    setup() {
        this.view.on('after:render', () => {
            window.requestAnimationFrame(() => {
                if (this.removed) {
                    return;
                }

                try {
                    this.afterRender();
                } catch (error) {
                    console.error(
                        'Better Columns rendering failed.',
                        error
                    );
                }
            });
        });
        document.addEventListener('click', this.onDocumentClickBind);
        this.view.on('remove', this.onViewRemoveBind);
    }

    afterRender() {
        if (this.removed || !this.view.element) {
            return;
        }

        const currentUrl = this.view.getRouter()?.getCurrentUrl?.() || '';
        const isAdministration = currentUrl.startsWith('#Admin/');

        if (
            !isBetterColumnsEnabledForEntity(
                this.view.getConfig(),
                this.entityType,
                isAdministration
            )
        ) {
            return;
        }

        this.disableNativeColumnResize();

        if (!this.state) {
            this.initializeState();
        }

        if (!this.state) {
            return;
        }

        this.observeViewDom();
        this.tableController.attach();
        this.bindPersistentSettingsMenu();
    }

    onViewRemove(options = {}) {
        if (options.ignoreCleaning) {
            this.suspend();

            return;
        }

        this.dispose();
    }

    disableNativeColumnResize() {
        const helper = this.view._listSettingsHelper;

        if (!helper?.getColumnResize?.()) {
            return;
        }

        helper.storeColumnResize(false);
    }

    observeViewDom() {
        const element = this.view.element;

        if (!element || this.observedElement === element) {
            return;
        }

        this.domObserver?.disconnect();
        this.observedElement = element;
        this.domObserver = new MutationObserver(() => {
            this.scheduleDomReconcile();
        });
        this.domObserver.observe(element, {
            childList: true,
            subtree: true,
        });
    }

    scheduleDomReconcile() {
        if (this.removed || this.reconcileFrame !== null) {
            return;
        }

        this.reconcileFrame = window.requestAnimationFrame(() => {
            this.reconcileFrame = null;

            if (this.removed || !this.view.element) {
                return;
            }

            try {
                this.reconcileDom();
            } catch (error) {
                console.error(
                    'Better Columns DOM reconciliation failed.',
                    error
                );
            }
        });
    }

    reconcileDom() {
        const table = this.view.element.querySelector('.list > table');
        const rows = table ?
            [...table.querySelectorAll(':scope > tbody > tr.list-row')] :
            [];
        const headers = table ?
            [
                ...table.querySelectorAll(
                    ':scope > thead > tr > ' +
                    'th.field-header-cell[data-name]'
                ),
            ] :
            [];
        const needsTableAttach = table !== this.tableController.table ||
            Boolean(table) && (
                !table.classList.contains('better-columns-managed-table') ||
                !table.querySelector(':scope > colgroup.better-columns-colgroup') ||
                headers.some(header =>
                    !header.querySelector(':scope > .better-columns-resizer') ||
                    !header.querySelector(':scope > .better-columns-column-menu-button')
                ) ||
                rows.some(row =>
                    !row.querySelector(':scope > .better-columns-filler-cell')
                )
            );

        if (needsTableAttach) {
            this.tableController.attach();
        }

        this.bindPersistentSettingsMenu();
    }

    bindPersistentSettingsMenu() {
        const element = this.view.element.querySelector(
            '.settings-container'
        );

        if (this.settingsElement !== element) {
            this.settingsElement?.removeEventListener(
                'click',
                this.onSettingsClickBind
            );
            this.settingsElement = element;
            this.settingsElement?.addEventListener(
                'click',
                this.onSettingsClickBind
            );
        }

        this.hideNativeResizeSetting();
        this.ensureResetAction();
        this.ensureSettingsToggle();

        if (!this.settingsMenuOpen || !this.settingsElement) {
            return;
        }

        const group = this.settingsElement.querySelector('.btn-group');

        group?.classList.add('open');
        group?.querySelector('.dropdown-toggle')
            ?.setAttribute('aria-expanded', 'true');
    }

    hideNativeResizeSetting() {
        const action = this.settingsElement?.querySelector(
            '[data-action="toggleColumnResize"]'
        );
        const item = action?.closest('li');

        if (!item) {
            return;
        }

        item.classList.add('hidden');

        if (item.previousElementSibling?.classList.contains('divider')) {
            item.previousElementSibling.classList.add('hidden');
        }
    }

    ensureResetAction() {
        const menu = this.settingsElement?.querySelector('.dropdown-menu');

        if (!menu || menu.querySelector('[data-action="betterColumnsResetColumns"]')) {
            return;
        }

        const divider = document.createElement('li');
        const fitItem = document.createElement('li');
        const fitAction = document.createElement('a');
        const fitLabel = this.view.translate(
            'Fit All Columns',
            'labels',
            'BetterColumns'
        );
        const item = document.createElement('li');
        const action = document.createElement('a');
        const label = this.view.translate(
            'Reset Order and Widths',
            'labels',
            'BetterColumns'
        );

        divider.className = 'divider better-columns-reset-columns-divider';
        fitItem.className = 'better-columns-fit-columns-item';
        fitAction.role = 'button';
        fitAction.tabIndex = 0;
        fitAction.dataset.action = 'betterColumnsFitColumns';
        fitAction.title = fitLabel;
        fitAction.innerHTML = [
            '<span class="item-icon fas fa-arrows-left-right-to-line"></span>',
            `<span class="item-text">${this.escapeHtml(fitLabel)}</span>`,
        ].join(' ');
        item.className = 'better-columns-reset-columns-item';
        action.role = 'button';
        action.tabIndex = 0;
        action.dataset.action = 'betterColumnsResetColumns';
        action.title = label;
        action.innerHTML = [
            '<span class="item-icon fas fa-undo"></span>',
            `<span class="item-text">${this.escapeHtml(label)}</span>`,
        ].join(' ');

        fitItem.append(fitAction);
        item.append(action);
        menu.append(divider, fitItem, item);
    }


    ensureSettingsToggle() {
        const toggle = this.settingsElement?.querySelector('.dropdown-toggle');

        if (!toggle || toggle.classList.contains('better-columns-settings-toggle')) {
            return;
        }

        const label = this.view.translate('Columns', 'labels', 'BetterColumns');

        toggle.classList.remove('btn-text');
        toggle.classList.add('btn', 'btn-default', 'better-columns-settings-toggle');
        toggle.title = label;
        toggle.setAttribute('aria-label', label);
        toggle.innerHTML = '<span class="fas fa-table-columns"></span>';
    }

    escapeHtml(value) {
        const element = document.createElement('span');

        element.textContent = value;

        return element.innerHTML;
    }

    onSettingsClick(event) {
        this.ensureResetAction();

        const fitAction = event.target.closest(
            '[data-action="betterColumnsFitColumns"]'
        );

        if (fitAction) {
            event.preventDefault();
            event.stopPropagation();
            this.closeSettingsMenu();
            this.tableController.fitAllColumns();

            return;
        }

        const resetAction = event.target.closest(
            '[data-action="betterColumnsResetColumns"]'
        );

        if (resetAction) {
            event.preventDefault();
            event.stopPropagation();
            this.closeSettingsMenu();
            void this.resetColumns();

            return;
        }

        if (!event.target.closest('.dropdown-menu')) {
            return;
        }

        this.settingsMenuOpen = true;

        // The native EspoCRM action has already been handled on this same
        // container. Prevent only Bootstrap's document-level auto-close.
        event.stopPropagation();
    }

    onDocumentClick(event) {
        if (
            this.settingsElement &&
            this.settingsElement.contains(event.target)
        ) {
            return;
        }

        this.settingsMenuOpen = false;
    }

    closeSettingsMenu() {
        this.settingsMenuOpen = false;

        const group = this.settingsElement?.querySelector('.btn-group');

        group?.classList.remove('open');
        group?.querySelector('.dropdown-toggle')
            ?.setAttribute('aria-expanded', 'false');
    }

    initializeState() {
        if (!Array.isArray(this.view.listLayout)) {
            return;
        }

        this.administratorLayout = this.view.listLayout
            .map(item => ({...item}));
        this.state = this.store.load(this.administratorLayout);
    }

    getState() {
        if (!this.state && this.administratorLayout) {
            this.state = this.store.load(this.administratorLayout);
        }

        return this.state;
    }

    getMinimumWidth() {
        return getFieldMinimumWidth();
    }

    captureWidths(widthMap, minimum = this.getMinimumWidth()) {
        if (!this.state) {
            return;
        }

        let changed = false;

        Object.entries(widthMap).forEach(([name, width]) => {
            if (name in this.state.widths || !Number.isFinite(width)) {
                return;
            }

            this.state.widths[name] = Math.max(
                minimum,
                Math.round(width)
            );
            changed = true;
        });

        if (changed) {
            this.store.save();
        }
    }

    shouldFitInitialWidths() {
        return Boolean(this.state) &&
            Object.keys(this.state.widths).length === 0;
    }

    setWidth(name, width) {
        if (!this.state) {
            return;
        }

        this.state.widths[name] = Math.max(
            this.getMinimumWidth(),
            Math.round(width)
        );
        this.store.save();
    }

    getDisplayOrder() {
        if (!this.state) {
            return [];
        }

        return buildDisplayOrder(this.state.order, this.state.pinned);
    }

    isPinned(name) {
        return Boolean(this.state?.pinned.includes(name));
    }

    async togglePin(name) {
        if (!this.state || !this.state.order.includes(name)) {
            return;
        }

        this.state.pinned = togglePinnedColumn(this.state.pinned, name);
        this.store.save();
        await this.refresh();
    }

    canHideColumn(name) {
        const item = this.administratorLayout?.find(
            layoutItem => layoutItem.name === name
        );

        return canHideLayoutItem(item);
    }

    /**
     * EspoCRM only lists the fields the administrator made available as
     * list filters, and it omits the fields the user cannot access.
     *
     * @param {string} name
     * @returns {HTMLElement|null}
     */
    getSearchView() {
        return this.view.getParentView?.()?.getView('search') || null;
    }

    getSearchFilterItem(name) {
        const element = this.getSearchView()?.element;

        return element?.querySelector(
            `ul.filter-list > li.filter-item[data-name="${CSS.escape(name)}"]`
        ) || null;
    }

    canFilterColumn(name) {
        return Boolean(this.getSearchFilterItem(name));
    }

    /**
     * Reuse the search panel's own add-filter handler, so the filter is
     * created and applied exactly as if it had been picked from the panel.
     *
     * @param {string} name
     */
    async activateColumnFilter(name) {
        const searchView = this.getSearchView();

        if (!searchView?.element || !this.canFilterColumn(name)) {
            return;
        }

        if (searchView.element.querySelector('.advanced-filters')
            ?.classList.contains('hidden')
        ) {
            await this.showAllSearchFilters(searchView);
        }

        const item = this.getSearchFilterItem(name);

        if (!item) {
            return;
        }

        if (!item.classList.contains('hidden')) {
            item.querySelector('a[data-action="addFilter"]')?.click();
        }

        this.focusSearchFilter(searchView, name);
    }

    /**
     * A non-default preset hides the advanced filters panel, so switch back
     * to the "all" preset and wait for the search panel to re-render.
     *
     * @param {import('views/record/search').default} searchView
     * @returns {Promise<void>}
     */
    showAllSearchFilters(searchView) {
        const allPreset = searchView.element.querySelector(
            'a.preset[data-action="selectPreset"][data-name=""]'
        );

        if (!allPreset) {
            return Promise.resolve();
        }

        return new Promise(resolve => {
            searchView.once('after:render', resolve);
            allPreset.click();
        });
    }

    focusSearchFilter(searchView, name, attemptsLeft = 20) {
        const container = searchView.element?.querySelector(
            `.advanced-filters .filter[data-name="${CSS.escape(name)}"]`
        );
        const visibleInputs = [...(container?.querySelectorAll(
            '.main-element, input:not([type="hidden"]), select, textarea'
        ) || [])].filter(element => element.getClientRects().length > 0);
        const input = visibleInputs.find(
            element => element.classList.contains('main-element')
        ) || visibleInputs[0];

        if (input) {
            input.focus();

            return;
        }

        if (attemptsLeft > 0) {
            setTimeout(
                () => this.focusSearchFilter(searchView, name, attemptsLeft - 1),
                50
            );
        }
    }

    /**
     * Store the hidden state in EspoCRM's own map, so the native Columns
     * menu and the list rendering stay in sync with the table.
     *
     * @param {string} name
     * @param {boolean} hidden
     */
    async setColumnHidden(name, hidden) {
        const helper = this.view._listSettingsHelper;

        if (!helper || !this.state || !this.canHideColumn(name)) {
            return;
        }

        helper.storeHiddenColumnMap({
            ...helper.getHiddenColumnMap(),
            [name]: hidden,
        });

        void this.view.getView('settings')?.reRender();

        await this.refresh();
    }

    async moveColumn(name, beforeName = null) {
        if (!this.state || name === beforeName) {
            return;
        }

        const pinned = this.isPinned(name);

        if (beforeName && this.isPinned(beforeName) !== pinned) {
            return;
        }

        if (pinned) {
            const pinnedOrder = this.state.pinned.filter(item => item !== name);
            const pinnedIndex = beforeName ? pinnedOrder.indexOf(beforeName) : -1;

            pinnedIndex === -1 ?
                pinnedOrder.push(name) :
                pinnedOrder.splice(pinnedIndex, 0, name);

            this.state.pinned = pinnedOrder;
        } else {
            const order = this.state.order.filter(item => item !== name);
            const index = beforeName ? order.indexOf(beforeName) : -1;

            index === -1 ?
                order.push(name) :
                order.splice(index, 0, name);

            this.state.order = order;
        }

        this.store.save();
        await this.refresh();
    }

    async refresh() {
        if (!this.state || !this.administratorLayout) {
            return;
        }

        this.view.listLayout = applyOrderToLayout(
            this.administratorLayout,
            this.getDisplayOrder()
        );
        this.view._internalLayout = null;

        const selectAttributes = await this.view.getSelectAttributeList();

        if (selectAttributes) {
            this.view.collection.data.select = selectAttributes.join(',');
        }

        await this.view.collection.fetch();
    }

    async resetColumns() {
        if (!this.administratorLayout) {
            return;
        }

        this.store.clear();
        this.state = this.store.load(this.administratorLayout);

        const helper = this.view._listSettingsHelper;

        if (helper) {
            helper.clearHiddenColumnMap();
            helper.clearColumnWidthMap();
        }

        void this.view.getView('settings')?.reRender();

        try {
            await this.refresh();
        } catch (error) {
            console.error(
                'Better Columns reset failed.',
                error
            );
        }
    }

    suspend() {
        this.domObserver?.disconnect();
        this.domObserver = null;
        this.observedElement = null;

        if (this.reconcileFrame !== null) {
            window.cancelAnimationFrame(this.reconcileFrame);
            this.reconcileFrame = null;
        }

        this.settingsElement?.removeEventListener(
            'click',
            this.onSettingsClickBind
        );
        this.settingsElement = null;
        this.settingsMenuOpen = false;
        this.tableController.detachTable();
    }

    dispose() {
        if (this.removed) {
            return;
        }

        this.removed = true;
        this.suspend();
        document.removeEventListener('click', this.onDocumentClickBind);
        this.view.off('remove', this.onViewRemoveBind);
        this.tableController.dispose();

        if (this.view._betterColumnsManager === this) {
            delete this.view._betterColumnsManager;
        }
    }
}
