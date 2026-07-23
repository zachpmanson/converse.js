import { html } from 'lit';
import { api } from '@converse/headless';
import { __ } from 'i18n';
import tplIconButton from 'shared/components/templates/icon-button.js';

/**
 * @param {import('../buttons').default} el
 */
function tplUserSettingsButton(el) {
    const i18n_details = __('Show details about this chat client');
    return tplIconButton({
        class: 'controlbox-heading__btn show-client-info align-self-center',
        icon: 'fa fa-cog',
        title: i18n_details,
        handler: (ev) => el.showUserSettingsModal(ev),
    });
}

/**
 * @param {import('../buttons').default} el
 */
function tplCloseButton(el) {
    return tplIconButton({
        class: 'controlbox-heading__btn close align-self-center',
        icon: 'fa fa-times',
        label: __('Close'),
        handler: (ev) => el.closeControlBox(ev),
    });
}

/**
 * @param {import('../buttons').default} el
 */
export default (el) => {
    const is_connected = el.model.get('connected');
    const show_settings_button = api.settings.get('show_client_info') || api.settings.get('allow_adhoc_commands');
    return html`<div class="btn-toolbar g-0" role="toolbar">
            <div class="btn-group" role="group">
                ${is_connected && show_settings_button ? tplUserSettingsButton(el) : ''}
                ${api.settings.get('sticky_controlbox') ? '' : tplCloseButton(el)}
            </div>
        </div>`;
};
