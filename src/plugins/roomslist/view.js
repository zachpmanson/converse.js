import { _converse, api, converse, u, constants } from '@converse/headless';
import { __ } from 'i18n';
import 'plugins/muc-views/modals/muc-details.js';
import 'plugins/muc-views/modals/config.js';
import 'plugins/muc-views/modals/nickname.js';
import { CustomElement } from 'shared/components/element.js';
import RoomsListModel from './model.js';
import tplRoomslist from './templates/roomslist.js';

const { Strophe } = converse.env;
const { initStorage } = u;
const { CHATROOMS_TYPE, CLOSED, OPENED } = constants;

export class RoomsList extends CustomElement {
    initialize() {
        const bare_jid = _converse.session.get('bare_jid');
        const id = `converse.roomspanel${bare_jid}`;
        this.model = new RoomsListModel({ id });
        _converse.state.roomslist = this.model;

        initStorage(this.model, id);
        this.model.fetch();

        const { chatboxes } = _converse.state;
        this.listenTo(chatboxes, 'add', this.renderIfChatRoom);
        this.listenTo(chatboxes, 'remove', this.renderIfChatRoom);
        this.listenTo(chatboxes, 'destroy', this.renderIfChatRoom);
        this.listenTo(chatboxes, 'change', this.renderIfRelevantChange);
        this.listenTo(chatboxes, 'vcard:add', () => this.requestUpdate());
        this.listenTo(chatboxes, 'vcard:change', () => this.requestUpdate());
        this.listenTo(this.model, 'change', () => this.requestUpdate());

        // The sidebar filter (shared with the contacts list) filters groupchats
        // by name too, so re-render on its changes once it exists.
        api.waitUntil('rosterInitialized').then(() => {
            const { roster_filter } = _converse.state;
            if (roster_filter) this.listenTo(roster_filter, 'change', () => this.requestUpdate());
            this.requestUpdate();
        });

        // Re-render room bookmark toggles when the bookmark set changes.
        api.waitUntil('bookmarksInitialized').then(() => {
            this.listenTo(_converse.state.bookmarks, 'add', () => this.requestUpdate());
            this.listenTo(_converse.state.bookmarks, 'remove', () => this.requestUpdate());
            this.requestUpdate();
        });

        this.requestUpdate();
    }

    /** @param {string} jid */
    isBookmarked(jid) {
        return !!_converse.state.bookmarks?.get(jid);
    }

    /**
     * Toggle a groupchat's bookmark from its context menu: open the bookmark
     * form for an un-bookmarked room, or remove the bookmark (with a confirm)
     * for a bookmarked one.
     * @param {Event} ev
     */
    async toggleRoomBookmark(ev) {
        ev.preventDefault();
        const target = /** @type {HTMLElement} */ (ev.currentTarget);
        const jid = target.getAttribute('data-room-jid');
        const name = target.getAttribute('data-room-name');
        const { bookmarks } = _converse.state;
        if (bookmarks?.get(jid)) {
            const result = await api.confirm(__('Are you sure you want to remove the bookmark "%1$s"?', name));
            if (result) bookmarks.where({ jid }).forEach((b) => b.destroy());
        } else {
            api.modal.show('converse-bookmark-form-modal', { jid }, ev);
        }
    }

    render() {
        return tplRoomslist(this);
    }

    /** @param {import('@converse/headless').Model} model */
    renderIfChatRoom(model) {
        u.muc.isChatRoom(model) && this.requestUpdate();
    }

    /** @param {import('@converse/headless').Model} model */
    renderIfRelevantChange(model) {
        const attrs = ['bookmarked', 'hidden', 'name', 'num_unread', 'num_unread_general', 'has_activity'];
        const changed = model.changed || {};
        if (u.muc.isChatRoom(model) && Object.keys(changed).filter((m) => attrs.includes(m)).length) {
            this.requestUpdate();
        }
    }

    /** @returns {import('@converse/headless').MUC[]} */
    getRoomsToShow() {
        const { chatboxes, roster_filter } = _converse.state;
        let rooms = chatboxes.filter((m) => m.get('type') === CHATROOMS_TYPE && !m.get('closed'));
        // Honour the shared sidebar filter's text, matching room display names.
        const q = roster_filter?.get('text')?.toLowerCase();
        if (q) {
            rooms = rooms.filter((m) => m.getDisplayName().toLowerCase().includes(q));
        }
        rooms.sort((a, b) => (a.getDisplayName().toLowerCase() <= b.getDisplayName().toLowerCase() ? -1 : 1));
        return rooms;
    }

    /** @param {Event} ev */
    async openRoom(ev) {
        ev.preventDefault();
        const target = u.ancestor(/** @type {HTMLElement} */ (ev.target), '.open-room');
        const name = target.getAttribute('data-room-name');
        const jid = target.getAttribute('data-room-jid');
        const data = {
            'name': name || Strophe.unescapeNode(Strophe.getNodeFromJid(jid)) || jid,
        };
        await api.rooms.open(jid, data, true);
    }

    /** @param {Event} ev */
    async closeRoom(ev) {
        ev.preventDefault();
        const target = /** @type {HTMLElement} */ (ev.currentTarget);
        const name = target.getAttribute('data-room-name');
        const jid = target.getAttribute('data-room-jid');
        const result = await api.confirm(__('Confirm'), __('Are you sure you want to leave the groupchat %1$s?', name));
        if (result) {
            const room = await api.rooms.get(jid);
            room.close();
        }
    }

    /** @param {Event} [ev] */
    toggleRoomsList(ev) {
        ev?.preventDefault?.();
        const toggle_state = this.model.get('toggle_state') === CLOSED ? OPENED : CLOSED;
        this.model.save({ toggle_state });
    }

    /**
     * @param {Event} ev
     * @param {string} domain
     */
    toggleDomainList(ev, domain) {
        ev?.preventDefault?.();
        const collapsed = this.model.get('collapsed_domains');
        if (collapsed.includes(domain)) {
            this.model.save({ 'collapsed_domains': collapsed.filter((d) => d !== domain) });
        } else {
            this.model.save({ 'collapsed_domains': [...collapsed, domain] });
        }
    }
}

api.elements.define('converse-rooms-list', RoomsList);
