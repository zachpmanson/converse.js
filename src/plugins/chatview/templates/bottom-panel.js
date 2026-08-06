import { __ } from 'i18n';
import { html } from 'lit';
import 'shared/chat/edit-preview.js';

/**
 * @param {import('../bottom-panel').default} el
 */
export default (el) => {
    const unread_msgs = __('You have unread messages');
    return html`
        <div
            class="chat-bottom-panel__dropzone ${el.drag_active ? 'drag-active' : ''}"
            @dragenter=${/** @param {DragEvent} ev */ (ev) => el.onDragEnter(ev)}
            @dragleave=${/** @param {DragEvent} ev */ (ev) => el.onDragLeave(ev)}
            @dragover=${/** @param {DragEvent} ev */ (ev) => el.onDragOver(ev)}
            @drop=${/** @param {DragEvent} ev */ (ev) => el.onDrop(ev)}
        >
            ${el.model.ui.get('scrolled') && el.model.get('num_unread')
                ? html`<div
                      class="new-msgs-indicator"
                      @click=${/** @param {MouseEvent} ev */ (ev) => el.viewUnreadMessages(ev)}
                  >
                      ▼ ${unread_msgs} ▼
                  </div>`
                : ''}
            <converse-edit-preview .model=${el.model}></converse-edit-preview>
            <converse-reply-preview .model=${el.model}></converse-reply-preview>
            <converse-message-form .model=${el.model}></converse-message-form>
            ${el.drag_active ? html`<div class="chat-bottom-panel__drop-overlay">${__('Drop to send files')}</div>` : ''}
        </div>
    `;
};
