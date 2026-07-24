/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { html } from 'lit';
import 'shared/components/icons.js';

/**
 * Shared heading for the collapsible controlbox side-panels (Contacts,
 * Groupchats, …). Renders the padded row with a collapse/expand toggle
 * (label + caret) and an action slot the caller fills with its own control —
 * an overflow `<converse-dropdown>` for contacts, a single icon button for
 * groupchats. The chrome (layout, sizing, spacing, toggle hover) is identical
 * across panels; only the accent colour and the action control differ.
 *
 * @param {Object} o
 * @param {string} o.label - heading text
 * @param {string} [o.title] - toggle tooltip
 * @param {string} o.modifier - panel key for the accent colour, e.g.
 *  `'contacts'` / `'groupchats'` (drives `controlbox-heading--<modifier>`)
 * @param {string} [o.toggle_class] - extra class on the toggle, e.g.
 *  `'open-contacts-toggle'` (kept as a colour/hook target)
 * @param {boolean} o.is_closed - whether the panel is collapsed
 * @param {boolean} [o.show_caret] - render the expand/collapse caret
 * @param {string} [o.color] - caret colour, e.g. `'var(--chat-color)'`
 * @param {(ev: Event) => any} o.on_toggle - collapse/expand handler
 * @param {import('lit').TemplateResult|string} [o.action] - the action control
 * @param {(ev: MouseEvent) => any} [o.on_contextmenu] - optional right-click handler
 * @returns {import('lit').TemplateResult}
 */
export default ({
    label,
    title = '',
    modifier,
    toggle_class = '',
    is_closed,
    show_caret = true,
    color = '',
    on_toggle,
    action = '',
    on_contextmenu,
}) => html`
    <div class="d-flex controlbox-padded" @contextmenu=${on_contextmenu}>
        <span class="w-100 controlbox-heading controlbox-heading--${modifier}">
            <a
                class="list-toggle controlbox-heading__toggle ${toggle_class}"
                title="${title}"
                role="heading"
                aria-level="3"
                @click=${on_toggle}
            >
                ${label}
                ${show_caret
                    ? html`<converse-icon
                          class="fa ${is_closed ? 'fa-caret-right' : 'fa-caret-down'}"
                          size="1em"
                          color="${color}"
                      ></converse-icon>`
                    : ''}
            </a>
        </span>
        ${action}
    </div>
`;
