import { _converse, api, constants } from '@converse/headless';
import 'plugins/chatview/heading.js';
import 'plugins/chatview/bottom-panel.js';
import BaseChatView from 'shared/chat/baseview.js';
import { __ } from 'i18n';
import DragResizable from 'plugins/dragresize/mixin.js';
import tplChat from './templates/chat.js';

const { ACTIVE } = constants;

/**
 * The view of an open/ongoing chat conversation.
 */
export default class ChatView extends DragResizable(BaseChatView) {
    length = 200;
    drag_depth = 0;

    static get properties() {
        return {
            model: { type: Object },
            drag_active: { state: true },
        };
    }

    async initialize() {
        const { chatboxviews, chatboxes } = _converse.state;
        chatboxviews.add(this.jid, this);
        this.model = chatboxes.get(this.jid);
        this.listenTo(this.model, 'change:requesting', () => this.requestUpdate());
        this.listenTo(this.model, 'change:hidden', () => !this.model.get('hidden') && this.afterShown());
        this.listenTo(this.model, 'change:show_help_messages', () => this.requestUpdate());
        this.listenTo(this.model, 'contact:add', () => this.requestUpdate());
        this.listenTo(this.model, 'contact:change', () => this.requestUpdate());
        this.listenTo(this.model, 'contact:destroy', () => this.requestUpdate());

        document.addEventListener('visibilitychange', () => this.onWindowStateChanged());

        await this.model.messages.fetched;
        !this.model.get('hidden') && this.afterShown();
        /**
         * Triggered once the {@link ChatView} has been initialized
         * @event _converse#chatBoxViewInitialized
         * @type {ChatView}
         * @example _converse.api.listen.on('chatBoxViewInitialized', view => { ... });
         */
        api.trigger('chatBoxViewInitialized', this);
    }

    render() {
        return tplChat(this);
    }

    getHelpMessages() {
        return [
            `<strong>/clear</strong>: ${__('Remove messages')}`,
            `<strong>/close</strong>: ${__('Close this chat')}`,
            `<strong>/me</strong>: ${__('Write in the third person')}`,
            `<strong>/help</strong>: ${__('Show this menu')}`,
        ];
    }

    afterShown() {
        this.model.setChatState(ACTIVE);
        this.model.clearUnreadMsgCounter();
        this.maybeFocus();
    }

    /**
     * Handle `dragenter` on the chat view — increment a depth counter so
     * we only show the overlay when the drag truly enters/exits the view.
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
     * truly leaves the chat view.
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
     * Handle files dropped anywhere in the chat view area.
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
}

api.elements.define('converse-chat', ChatView);
