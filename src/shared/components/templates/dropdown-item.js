/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { html, nothing } from 'lit';
import 'shared/components/icons.js';

/**
 * The single shared dropdown-item template: an `<a>` or `<button>` with a
 * `<converse-icon>` and a text label, sharing one hover/focus highlight colour.
 *
 * Rendered inline (not a custom element) so the element lands directly in each
 * caller's DOM, preserving existing selectors and synchronous queries.
 *
 * Used for the message-actions overflow, the chat-heading action dropdown, and
 * the room-list dropdown items.
 *
 * @param {Object} [o]
 * @param {'a'|'button'} [o.tag] - Element type (default `'button'`)
 * @param {string} [o.class] - extra classes appended to `dropdown-item`
 *  (e.g. `'chat-msg__action-edit'`, `'show-muc-details-modal'`)
 * @param {string} [o.icon] - Icon classes for the `<converse-icon>`
 *  (e.g. `'fa fa-pencil-alt'`)
 * @param {string} [o.color] - Icon colour (default `'var(--foreground-color)'`)
 * @param {string} [o.title] - Tooltip / accessible name
 * @param {string} [o.text] - Display label
 * @param {boolean} [o.disabled] - Disabled state (only applies to `<button>`)
 * @param {string} [o.data_room_jid] - data-room-jid attribute (rooms list)
 * @param {string} [o.data_room_name] - data-room-name attribute (rooms list)
 * @param {(ev: Event) => any} [o.handler] - Click handler
 * @returns {import('lit').TemplateResult}
 */
export default ({
    tag = 'button',
    icon = '',
    color = 'var(--foreground-color)',
    title = '',
    text = '',
    disabled = false,
    class: cls = '',
    data_room_jid = '',
    data_room_name = '',
    handler,
} = {}) => {
    if (tag === 'a') {
        return html`<a
            href="#"
            role="button"
            class="dropdown-item ${cls}"
            title="${title}"
            data-room-jid="${data_room_jid || nothing}"
            data-room-name="${data_room_name || nothing}"
            @click=${handler}
        >
            <converse-icon size="1em" class="${icon}"></converse-icon>${text}
        </a>`;
    }
    return html`<button
        type="button"
        class="dropdown-item chat-msg__action ${cls}"
        title="${title}"
        ?disabled=${disabled}
        @click=${handler}
    >
        <converse-icon class="${icon}" color="${color}" size="1em"></converse-icon>&nbsp;${text}
    </button>`;
};