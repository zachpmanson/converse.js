import { html } from 'lit';
import { until } from 'lit/directives/until.js';
import { __ } from 'i18n';
import { api } from '@converse/headless';
import tplIconButton from 'shared/components/templates/icon-button.js';

function tplSendButton() {
    const i18n_send_message = __('Send the message');
    return tplIconButton({
        type: 'submit',
        class: 'send-button',
        icon: 'fa fa-paper-plane',
        color: 'var(--background-color)',
        title: i18n_send_message,
    });
}

/**
 * @param {import('../toolbar').ChatToolbar} el
 */
export default (el) => {
    const message_limit = api.settings.get('message_limit');
    return html`
        <span class="btn-group toolbar-buttons">${until(el.getButtons(), '')}</span>
        <span>
            ${ message_limit ? html`<converse-message-limit-indicator .model="${el.model}"/>` : '' }
            ${el.show_send_button ? tplSendButton() : ''}
        </span>
    `;
};
