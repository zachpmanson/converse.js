/**
 * @module converse-reactions
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
/**
 * @typedef {import('@converse/headless/types/shared/message').default} BaseMessage
 * @typedef {import('@converse/headless/types/shared/types').ChatBoxOrMUC} ChatBoxOrMUC
 */
import { html } from 'lit';
import { _converse, api, u, EmojiPicker } from '@converse/headless';
import DropdownBase from 'shared/components/dropdownbase.js';
import 'shared/components/icons.js';
import 'shared/chat/emoji-picker.js';
import 'shared/chat/styles/emoji.scss';

export default class EmojiPickerDropdown extends DropdownBase {
    static get properties() {
        return {
            'message_model': { type: Object },
            'opened': { state: true },
        };
    }

    constructor() {
        super();
        /** @type {BaseMessage|null} */
        this.message_model = null;
        // Whether THIS dropdown's picker is open. The heavy <converse-emoji-picker>
        // is only rendered while open — chatbox.emoji_picker is shared across all
        // of a chat's messages, so rendering the picker whenever it merely exists
        // meant every message rendered a full picker (huge memory use).
        this.opened = false;
    }

    /**
     * @returns {ChatBoxOrMUC|undefined}
     */
    get chatbox() {
        return this.message_model?.collection?.chatbox;
    }

    /**
     * @returns {string[]|undefined}
     */
    get allowed_emojis() {
        return this.chatbox?.get('allowed_reactions');
    }

    /**
     * @returns {import('lit').TemplateResult}
     */
    render() {
        return html`
            <button class="reaction-item more dropdown-toggle" type="button" aria-haspopup="true" aria-expanded="false">
                <converse-icon class="fas fa-plus" size="1em"></converse-icon>
            </button>
            <ul class="dropdown-menu">
                <li>
                    ${this.opened && this.chatbox?.emoji_picker
                        ? html`
                              <converse-emoji-picker
                                  .state=${this.chatbox.emoji_picker}
                                  .model=${this.chatbox}
                                  .allowed_emojis=${this.allowed_emojis}
                                  @emojiSelected=${(ev) => {
                                      ev.stopPropagation();
                                      this.dispatchEvent(
                                          new CustomEvent('emoji-picker-selected', {
                                              detail: { emoji: ev.detail.value },
                                              bubbles: true,
                                              composed: true,
                                          }),
                                      );
                                  }}
                                  ?render_emojis=${true}
                                  current_category="${this.chatbox.emoji_picker.get('current_category') || ''}"
                                  current_skintone="${this.chatbox.emoji_picker.get('current_skintone') || ''}"
                                  query="${this.chatbox.emoji_picker.get('query') || ''}"
                              ></converse-emoji-picker>
                          `
                        : ''}
                </li>
            </ul>
        `;
    }

    firstUpdated() {
        this.menu = /** @type {HTMLElement} */ (this.querySelector('.dropdown-menu'));
        this.button = /** @type {HTMLButtonElement} */ (this.querySelector('button'));

        this._onButtonClick =
            /** @param {MouseEvent} ev */
            async (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                if (this.opened) {
                    this.hide();
                    return;
                }
                await this.#initPicker();
                this.opened = true; // render the picker before showing it
                await this.updateComplete;
                this.show();
            };
        this.button.addEventListener('click', this._onButtonClick);
    }

    /**
     * @param {import('lit').PropertyValues} changed
     */
    updated(changed) {
        super.updated(changed);
        this.menu = /** @type {HTMLElement} */ (this.querySelector('.dropdown-menu'));
        this.button = /** @type {HTMLButtonElement} */ (/** @type {unknown} */ (this.querySelector('button')));
    }

    /**
     * Open the full emoji picker anchored at a cursor position. Used by the
     * message menu's inline "+" to jump straight to the picker (rather than
     * routing through the popular-reactions panel), and works even though the
     * toggle button is hidden, since it positions via a virtual cursor element.
     * @param {number} x @param {number} y
     */
    async openAt(x, y) {
        await this.#initPicker();
        this.opened = true;
        await this.updateComplete;
        this.showAt(x, y);
    }

    /** @override — also unrender the picker when closed (see the `opened` note). */
    hide() {
        this.opened = false;
        super.hide();
    }

    /**
     * Lazily creates and fetches the emoji picker model for the chatbox
     * if one doesn't already exist.
     * @returns {Promise<void>}
     */
    async #initPicker() {
        const chatbox = this.chatbox;
        if (!chatbox || chatbox.emoji_picker) return;
        await api.emojis.initialize();
        const bare_jid = _converse.session.get('bare_jid');
        const id = `converse.emoji-${bare_jid}-${chatbox.get('jid')}`;
        chatbox.emoji_picker = new EmojiPicker({ id });
        u.initStorage(chatbox.emoji_picker, id);
        await new Promise((resolve) => chatbox.emoji_picker.fetch({ success: resolve, error: resolve }));
        this.requestUpdate();
    }
}

api.elements.define('converse-emoji-picker-dropdown', EmojiPickerDropdown);
