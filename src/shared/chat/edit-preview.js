/**
 * @copyright 2025, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description A banner shown above the compose box while editing (correcting)
 * a message, so it's obvious that typing will update an existing message rather
 * than send a new one.
 */
import { api } from '@converse/headless';
import { CustomElement } from 'shared/components/element.js';
import { html, nothing } from 'lit';
import { __ } from 'i18n';

import './styles/edit-preview.scss';

export default class EditPreview extends CustomElement {
    static get properties() {
        return {
            model: { type: Object },
        };
    }

    constructor() {
        super();
        this.model = null;
    }

    initialize() {
        // The message being edited carries `correcting: true`.
        this.listenTo(this.model.messages, 'change:correcting', () => this.requestUpdate());
    }

    /** @returns {import('@converse/headless/types/shared/message').default|undefined} */
    getCorrectingMessage() {
        return this.model.messages?.findWhere?.({ correcting: true });
    }

    cancelEdit() {
        this.getCorrectingMessage()?.save('correcting', false);
    }

    render() {
        const message = this.getCorrectingMessage();
        if (!message) return nothing;

        const body = message.getMessageText?.() ?? '';
        const truncated = body.length > 100 ? body.slice(0, 100) + '…' : body;

        return html`
            <div class="edit-preview">
                <div class="edit-preview__content">
                    <span class="edit-preview__label">
                        <converse-icon class="fa fa-pencil-alt" size="0.85em"></converse-icon>
                        ${__('Editing message')}
                    </span>
                    <span class="edit-preview__text">${truncated}</span>
                </div>
                <button
                    type="button"
                    class="edit-preview__cancel"
                    @click=${() => this.cancelEdit()}
                    title="${__('Cancel editing')}"
                >
                    <converse-icon class="fa fa-times" size="1em"></converse-icon>
                </button>
            </div>
        `;
    }
}

api.elements.define('converse-edit-preview', EditPreview);
