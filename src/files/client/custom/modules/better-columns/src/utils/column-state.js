const STATE_VERSION = 3;

/**
 * Return the user-manageable columns from the administrator list layout.
 *
 * The layout has already been filtered by EspoCRM's field-level read ACL.
 *
 * @param {Array<Record<string, any>>} layout
 * @return {Array<Record<string, any>>}
 */
export function getEligibleLayoutItems(layout) {
    const met = new Set();

    return (layout || []).filter(item => {
        if (
            !item?.name ||
            item.noLabel ||
            item.customLabel === '' ||
            met.has(item.name)
        ) {
            return false;
        }

        met.add(item.name);

        return true;
    });
}

/**
 * Whether a column can be hidden from the column menu.
 *
 * Mirrors the rules of EspoCRM's Columns menu, so every hidden column can be
 * shown again from there. Link columns, such as the name, are never listed.
 *
 * @param {Record<string, any>|undefined} item
 * @return {boolean}
 */
export function canHideLayoutItem(item) {
    return Boolean(item?.name) &&
        !item.link &&
        !item.noLabel &&
        item.customLabel !== '';
}

/**
 * Merge a stored order with the current administrator order.
 *
 * New administrator columns are inserted next to their nearest known
 * neighbour. Removed columns are discarded.
 *
 * @param {string[]} storedOrder
 * @param {string[]} administratorOrder
 * @return {string[]}
 */
export function reconcileOrder(storedOrder, administratorOrder) {
    const allowed = new Set(administratorOrder);
    const result = (storedOrder || []).filter((name, index, list) =>
        allowed.has(name) && list.indexOf(name) === index
    );

    administratorOrder.forEach((name, administratorIndex) => {
        if (result.includes(name)) {
            return;
        }

        let inserted = false;

        for (let index = administratorIndex - 1; index >= 0; index--) {
            const previousName = administratorOrder[index];
            const resultIndex = result.indexOf(previousName);

            if (resultIndex === -1) {
                continue;
            }

            result.splice(resultIndex + 1, 0, name);
            inserted = true;
            break;
        }

        if (inserted) {
            return;
        }

        const nextName = administratorOrder
            .slice(administratorIndex + 1)
            .find(item => result.includes(item));

        if (nextName) {
            result.splice(result.indexOf(nextName), 0, name);

            return;
        }

        result.push(name);
    });

    return result;
}

/**
 * Return the pinned columns in display order, followed by the other columns.
 *
 * @param {string[]} order
 * @param {string[]} pinned
 * @return {string[]}
 */
export function buildDisplayOrder(order, pinned) {
    const pinnedNames = new Set(pinned || []);

    return [
        ...(pinned || []),
        ...(order || []).filter(name => !pinnedNames.has(name)),
    ];
}

/**
 * @param {string[]} pinned
 * @param {string} name
 * @return {string[]}
 */
export function togglePinnedColumn(pinned, name) {
    if (pinned.includes(name)) {
        return pinned.filter(item => item !== name);
    }

    return [...pinned, name];
}

/**
 * @param {Record<string, any>|null} rawState
 * @param {Array<Record<string, any>>} administratorLayout
 * @return {{
 *     version: number,
 *     order: string[],
 *     pinned: string[],
 *     widths: Record<string, number>,
 * }}
 */
export function reconcileState(rawState, administratorLayout) {
    const items = getEligibleLayoutItems(administratorLayout);
    const administratorOrder = items.map(item => item.name);
    const hasStoredState = [1, 2, STATE_VERSION].includes(rawState?.version);
    const storedOrder = hasStoredState ? rawState.order : [];
    const order = reconcileOrder(storedOrder, administratorOrder);
    const allowed = new Set(administratorOrder);
    const widths = {};
    const storedPinned = hasStoredState && Array.isArray(rawState.pinned) ?
        rawState.pinned :
        [];
    const pinned = storedPinned
        .filter((name, index, list) =>
            allowed.has(name) && list.indexOf(name) === index
        );

    if (hasStoredState && rawState.widths) {
        Object.entries(rawState.widths).forEach(([name, width]) => {
            if (allowed.has(name) && Number.isFinite(width) && width > 0) {
                widths[name] = Math.round(width);
            }
        });
    }

    return {
        version: STATE_VERSION,
        order,
        pinned,
        widths,
    };
}

/**
 * Apply a personal order without changing EspoCRM's native visibility data.
 *
 * @param {Array<Record<string, any>>} administratorLayout
 * @param {string[]} order
 * @return {Array<Record<string, any>>}
 */
export function applyOrderToLayout(administratorLayout, order) {
    const itemMap = new Map();
    const unmanaged = [];
    const eligible = new Set(
        getEligibleLayoutItems(administratorLayout).map(item => item.name)
    );

    (administratorLayout || []).forEach(item => {
        if (eligible.has(item?.name)) {
            itemMap.set(item.name, {...item});

            return;
        }

        unmanaged.push({...item});
    });

    const ordered = (order || [])
        .map(name => itemMap.get(name))
        .filter(Boolean);
    const met = new Set((order || []));
    const missing = [...itemMap.entries()]
        .filter(([name]) => !met.has(name))
        .map(([, item]) => item);

    return [...ordered, ...missing, ...unmanaged];
}

export const columnStateVersion = STATE_VERSION;
