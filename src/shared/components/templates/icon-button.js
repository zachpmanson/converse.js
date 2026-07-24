/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { html, nothing } from 'lit';
import 'shared/components/icons.js';

/**
 * The single shared icon button: a `.btn` wrapping a `<converse-icon>`.
 *
 * Rendered inline (rather than as a wrapper custom element) so the `<button>`
 * lands directly in the calling template's DOM. This keeps the markup identical
 * to a hand-written button, so existing CSS, test selectors and
 * `DropdownBase`'s `querySelector('button')` all keep working.
 *
 * Used for the compose-toolbar buttons (emoji, attachment, geolocation, call,
 * spoiler, send), the chat-heading buttons, the controlbox settings/close
 * buttons and the dropdown (overflow / emoji) toggles.
 *
 * @param {Object} [o]
 * @param {string} [o.icon] - Font Awesome classes, e.g. `'fa fa-smile'`
 * @param {string} [o.color] - icon colour, e.g. `'var(--chat-color)'`
 * @param {string} [o.size] - icon size (default `'1em'`)
 * @param {string} [o.class] - extra classes appended to the base `btn` class
 *  (e.g. `'toggle-call'`, `'send-button'`), preserved so existing CSS and tests
 *  keep matching
 * @param {string} [o.title] - tooltip / accessible name
 * @param {string} [o.label] - explicit aria-label (falls back to `title`)
 * @param {string} [o.type] - button type (default `'button'`)
 * @param {boolean} [o.disabled]
 * @param {string} [o.id] - id the dropdown menu's `aria-labelledby` points at
 * @param {boolean} [o.haspopup] - advertise `aria-haspopup` / `aria-expanded`
 * @param {(ev: MouseEvent) => any} [o.handler] - click handler
 * @returns {import('lit').TemplateResult}
 */
export default ({
    icon = '',
    color = '',
    size = '1em',
    class: cls = '',
    title = '',
    label = '',
    type = 'button',
    disabled = false,
    id = '',
    haspopup = false,
    handler,
} = {}) => html`<button
    id="${id || nothing}"
    type="${type}"
    class="btn icon-button ${cls}"
    title="${title || nothing}"
    aria-label="${label || title || nothing}"
    aria-haspopup="${haspopup ? 'true' : nothing}"
    aria-expanded="${haspopup ? 'false' : nothing}"
    ?disabled=${disabled}
    @click=${handler}
>
    <converse-icon aria-hidden="true" class="${icon}" color="${color || nothing}" size="${size}"></converse-icon>
</button>`;
