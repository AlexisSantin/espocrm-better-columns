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
