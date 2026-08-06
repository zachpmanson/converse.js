/**
 * @typedef {import('shared/chat/emoji-picker.js').default} EmojiPicker
 * @typedef {import('shared/chat/emoji-dropdown.js').default} EmojiDropdown
 * @typedef {import('./message-form.js').default} MessageForm
 */
import { _converse, api } from '@converse/headless';
import { CustomElement } from 'shared/components/element.js';
import tplBottomPanel from './templates/bottom-panel.js';
import { clearMessages } from './utils.js';
import './message-form.js';

import './styles/chat-bottom-panel.scss';

export default class ChatBottomPanel extends CustomElement {
    constructor() {
        super();
        this.model = null;
        this.drag_depth = 0;
    }

    static get properties() {
        return {
            model: { type: Object },
            drag_active: { state: true },
        };
    }

    async connectedCallback() {
        super.connectedCallback();
        await this.initialize();
        // Don't call in initialize, since the MUCBottomPanel subclasses it
        // and we want to render after it has finished as well.
        this.requestUpdate();
    }

    async initialize() {
        await this.model.initialized;
        this.listenTo(this.model, 'change:num_unread', () => this.requestUpdate());
        this.listenTo(this.model, 'emoji-picker-autocomplete', this.autocompleteInPicker);

        this.addEventListener('emojipickerblur', () =>
            /** @type {HTMLElement} */ (this.querySelector('.chat-textarea')).focus()
        );
    }

    render() {
        return this.model ? tplBottomPanel(this) : '';
    }

    viewUnreadMessages(ev) {
        ev?.preventDefault?.();
        this.model.ui.set({ 'scrolled': false });
    }

    /**
     * Handle `dragenter` on the bottom panel — increment a depth counter so
     * we only toggle the overlay when the drag truly enters/exits the panel
     * (not when crossing child element boundaries).
     * @param {DragEvent} ev
     */
    onDragEnter(ev) {
        ev.preventDefault();
        this.drag_depth += 1;
        if (this.drag_depth === 1) {
            this.drag_active = true;
            this.requestUpdate();
        }
    }

    /**
     * Handle `dragleave` — decrement depth, hide overlay when the drag
     * truly leaves the panel.
     * @param {DragEvent} ev
     */
    onDragLeave(ev) {
        ev.preventDefault();
        this.drag_depth -= 1;
        if (this.drag_depth <= 0) {
            this.drag_depth = 0;
            this.drag_active = false;
            this.requestUpdate();
        }
    }

    /**
     * Handle `dragover` — required to allow the drop.
     * @param {DragEvent} ev
     */
    onDragOver(ev) {
        ev.preventDefault();
    }

    /**
     * Handle files dropped anywhere in the bottom panel area.
     * @param {DragEvent} ev
     */
    onDrop(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        this.drag_depth = 0;
        this.drag_active = false;
        this.requestUpdate();

        if (!ev.dataTransfer?.files?.length) return;
        this.model.stageFiles(ev.dataTransfer.files);
    }

    clearMessages(ev) {
        ev?.preventDefault?.();
        clearMessages(this.model);
    }

    /**
     * @typedef {Object} AutocompleteInPickerEvent
     * @property {HTMLTextAreaElement} target
     * @property {string} value
     * @param {AutocompleteInPickerEvent} ev
     */
    async autocompleteInPicker(ev) {
        const { target: input, value } = ev;
        await api.emojis.initialize();
        const emoji_picker = /** @type {EmojiPicker} */ (this.querySelector('converse-emoji-picker'));
        if (emoji_picker) {
            emoji_picker.state.set({
                ac_position: input.selectionStart,
                autocompleting: value,
                query: value,
            });
            const emoji_dropdown = /** @type {EmojiDropdown} */ (this.querySelector('converse-emoji-dropdown'));
            emoji_dropdown?.show();
        }
    }
}

api.elements.define('converse-chat-bottom-panel', ChatBottomPanel);
