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
