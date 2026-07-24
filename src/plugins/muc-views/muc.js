import { _converse, api, converse } from '@converse/headless';
import BaseChatView from 'shared/chat/baseview.js';
import DragResizable from 'plugins/dragresize/mixin.js';
import tplMuc from './templates/muc.js';

export default class MUCView extends DragResizable(BaseChatView) {
    length = 300;
    is_chatroom = true;

    async initialize() {
        this.model = await api.rooms.get(this.jid);
        _converse.state.chatboxviews.add(this.jid, this);

        this.setAttribute('id', this.model.get('box_id'));

        this.listenTo(this.model.session, 'change:connection_status', this.onConnectionStatusChanged);
        this.listenTo(this.model.session, 'change:view', () => this.requestUpdate());
        // Focus the compose box when the room is (re-)shown, so the user can
        // start typing immediately. See also onConnectionStatusChanged for the
        // just-entered case.
        this.listenTo(this.model, 'change:hidden', () => !this.model.get('hidden') && this.afterShown());

        document.addEventListener('visibilitychange', () => this.onWindowStateChanged());

        this.onConnectionStatusChanged();
        this.model.maybeShow();
        /**
         * Triggered once a {@link MUCView} has been opened
         * @event _converse#chatRoomViewInitialized
         * @type {MUCView}
         * @example _converse.api.listen.on('chatRoomViewInitialized', view => { ... });
         */
        api.trigger('chatRoomViewInitialized', this);
    }

    render() {
        return tplMuc(this);
    }

    /**
     * Focus the compose box once the room is shown and joined (its textarea
     * only exists once we've entered).
     */
    afterShown() {
        if (this.model.get('hidden')) return;
        if (this.model.session.get('connection_status') !== converse.ROOMSTATUS.ENTERED) return;
        this.maybeFocus();
    }

    onConnectionStatusChanged() {
        const conn_status = this.model.session.get('connection_status');
        if (conn_status === converse.ROOMSTATUS.ENTERED) {
            this.afterShown();
        }
        if (conn_status === converse.ROOMSTATUS.CONNECTING) {
            this.model.session.save({
                'disconnection_actor': undefined,
                'disconnection_message': undefined,
                'disconnection_reason': undefined,
            });
            this.model.save({
                'moved_jid': undefined,
                'password_validation_message': undefined,
                'reason': undefined,
            });
        }
        this.requestUpdate();
    }
}

api.elements.define('converse-muc', MUCView);
