import { converse, api, _converse } from '@converse/headless';
import { registerRestrictedReactionsHandler, sendReaction } from './utils.js';

import { html } from 'lit';
import { __ } from 'i18n';

const { Strophe } = converse.env;

// Quick-react emojis shown as an inline row at the top of the message menu.
const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉', '😮', '😢'];

/**
 * Inline row of quick-react emojis for the message action menu, plus a "+" that
 * opens the full picker. Replaces the old "Add Reaction" item that opened a
 * separate floating panel.
 * @param {import('shared/chat/message-actions').default} el
 */
function tplQuickReactionRow(el) {
    /** @param {MouseEvent} ev */
    const closeMenu = (ev) =>
        /** @type {any} */ (/** @type {Element} */ (ev.currentTarget).closest('converse-dropdown'))?.hide?.();
    return html`<div class="chat-msg__quick-reactions" role="group" aria-label="${__('React')}">
        ${QUICK_REACTIONS.map(
            (emoji) => html`<button
                type="button"
                class="quick-reaction"
                title="${emoji}"
                @click=${(/** @type {MouseEvent} */ ev) => {
                    sendReaction(el.model, emoji);
                    closeMenu(ev);
                }}
            >
                ${emoji}
            </button>`
        )}
        <button
            type="button"
            class="quick-reaction quick-reaction--more"
            title="${__('More reactions…')}"
            @click=${(/** @type {MouseEvent} */ ev) => {
                el.querySelector('converse-reaction-picker')?.open(ev);
                closeMenu(ev);
            }}
        >
            <converse-icon class="fas fa-plus" size="0.9em"></converse-icon>
        </button>
    </div>`;
}

converse.plugins.add('converse-reaction-views', {
    dependencies: ['converse-reactions', 'converse-disco', 'converse-chatview', 'converse-muc-views'],

    /**
     * Initializes the reactions UI plugin
     * Sets up event listeners for:
     * - Adding reaction buttons to messages
     * - Handling reaction picker interactions
     * - Disco feature advertisement and restrictions
     */
    initialize() {
        api.listen.on('addClientFeatures', () => {
            api.disco.own.features.add(Strophe.NS.REACTIONS);
        });

        api.listen.on('connected', () => registerRestrictedReactionsHandler());
        api.listen.on('reconnected', () => registerRestrictedReactionsHandler());

        api.listen.on('getMessageActionButtons', (el, buttons) => {
            // Inline row of quick reactions (with a "+" for the full picker),
            // instead of a single "Add Reaction" item that opened a floating panel.
            buttons.unshift({
                'name': 'reaction',
                'template': tplQuickReactionRow(el),
            });

            return buttons;
        });

        api.listen.on('getMessageActionContent', (el, content) => {
            return html`${content}<converse-reaction-picker .model=${el.model}></converse-reaction-picker>`;
        });
    },
});
