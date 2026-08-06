import { html, nothing } from 'lit';
import { api } from '@converse/headless';
import { getChatStyle } from 'shared/chat/utils.js';
import { getChatRoomBodyTemplate } from '../utils.js';
import { __ } from 'i18n';
import '../chatarea.js';
import '../destroyed.js';
import '../disconnected.js';
import '../heading.js';
import '../nickname-form.js';
import '../password-form.js';

/**
 * @param {import('../muc').default} el
 */
export default (el) => {
    const style = el.model ? getChatStyle(el.model) : '';
    return html` <div
        class="flyout box-flyout"
        style="${style || nothing}"
        @dragenter=${/** @param {DragEvent} ev */ (ev) => el.onDragEnter(ev)}
        @dragleave=${/** @param {DragEvent} ev */ (ev) => el.onDragLeave(ev)}
        @dragover=${/** @param {DragEvent} ev */ (ev) => el.onDragOver(ev)}
        @drop=${/** @param {DragEvent} ev */ (ev) => el.onDrop(ev)}
    >
        ${api.settings.get('view_mode') === 'overlayed' ? html`<converse-dragresize></converse-dragresize>` : ''}
        ${el.model
            ? html`
                  <converse-muc-heading jid="${el.model.get('jid')}" class="chat-head chat-head-chatroom row g-0">
                  </converse-muc-heading>
                  <div class="chat-body chatroom-body row g-0">${getChatRoomBodyTemplate(el.model)}</div>
                  ${el.drag_active
                      ? html`<div class="chat-view__drop-overlay">${__('Drop to send files')}</div>`
                      : ''}
              `
            : ''}
    </div>`;
};
