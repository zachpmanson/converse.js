/**
 * @typedef {import('../view').RoomsList} RoomsList
 * @typedef {import('@converse/headless').MUC} MUC
 */
import { html } from 'lit';
import { _converse, api, u, constants } from '@converse/headless';
import 'plugins/muc-views/modals/add-muc.js';
import { __ } from 'i18n';
import { getMUCActionButtons } from 'plugins/muc-views/utils.js';
import { getHeadingDropdownItem, getUnreadMsgsDisplay, openDropdownAt } from 'shared/chat/utils.js';
import tplIconButton from 'shared/components/templates/icon-button.js';
import tplListHeading from 'shared/components/templates/list-heading.js';

import '../styles/roomsgroups.scss';

const { CLOSED } = constants;
const { isUniView } = u;

/** @param {MUC} room */
function isCurrentlyOpen(room) {
    return isUniView() && !room.get('hidden');
}

/** @param {MUC} room */
function tplUnreadIndicator(room) {
    return html`<span class="list-item-badge badge badge--muc msgs-indicator">${getUnreadMsgsDisplay(room)}</span>`;
}

function tplActivityIndicator() {
    return html`<span class="list-item-badge badge badge--muc msgs-indicator"></span>`;
}

/**
 * @param {RoomsList} el
 * @param {MUC} room
 */
function tplRoomItem(el, room) {
    const i18n_leave_room = __('Leave this groupchat');
    const has_unread_msgs = room.get('num_unread_general') || room.get('has_activity');

    // The same management actions (Details/Configure/Moderate/…) the MUC's own
    // heading offers, so they're reachable without opening the room.
    const action_btns = getMUCActionButtons(room).map((b) => getHeadingDropdownItem(b));

    if (_converse.state.bookmarks) {
        const is_bookmarked = el.isBookmarked(room.get('jid'));
        action_btns.push(html`<a
            class="dropdown-item toggle-bookmark"
            role="button"
            data-room-jid="${room.get('jid')}"
            data-room-name="${room.getDisplayName()}"
            title="${is_bookmarked ? __('Remove this bookmark') : __('Bookmark this groupchat')}"
            @click=${(/** @type {Event} */ ev) => el.toggleRoomBookmark(ev)}
        >
            <converse-icon class="fa fa-bookmark" size="1em"></converse-icon>&nbsp;${is_bookmarked
                ? __('Unbookmark')
                : __('Bookmark')}
        </a>`);
    }

    action_btns.push(html`<a
        class="dropdown-item close-room"
        role="button"
        data-room-jid="${room.get('jid')}"
        data-room-name="${room.getDisplayName()}"
        title="${i18n_leave_room}"
        @click=${(/** @type {Event} */ ev) => el.closeRoom(ev)}
    >
        <converse-icon class="fa fa-sign-out-alt" size="1em"></converse-icon>&nbsp;${__('Leave')}
    </a>`);
    return html` <li
        class="list-item controlbox-padded available-chatroom d-flex flex-row ${isCurrentlyOpen(room)
            ? 'open'
            : ''} ${has_unread_msgs ? 'unread-msgs' : ''}"
        data-room-jid="${room.get('jid')}"
        @contextmenu=${(/** @type {MouseEvent} */ ev) => openDropdownAt(ev, ev.currentTarget)}
    >
        <a
            class="list-item-link open-room available-room w-100"
            data-room-jid="${room.get('jid')}"
            data-room-name="${room.getDisplayName()}"
            title="${__('Click to open this groupchat')}"
            @click=${(/** @type {Event} */ ev) => el.openRoom(ev)}
        >
            <converse-avatar
                .model=${room}
                class="avatar avatar-muc"
                name="${room.getDisplayName()}"
                nonce=${room.vcard?.get('vcard_updated')}
                height="30"
                width="30"
            ></converse-avatar>
            <span
                >${room.get('num_unread')
                    ? tplUnreadIndicator(room)
                    : room.get('has_activity')
                      ? tplActivityIndicator()
                      : ''}
                ${room.getDisplayName()}</span
            >
        </a>

        <converse-dropdown
            class="btn-group dropstart list-item-action room-actions"
            .items=${action_btns}
        ></converse-dropdown>
    </li>`;
}

/**
 * @param {RoomsList} el
 * @param {string} domain
 * @param {MUC[]} rooms
 */
function tplRoomDomainGroup(el, domain, rooms) {
    const i18n_title = __('Click to hide these rooms');
    const collapsed = el.model.get('collapsed_domains');
    const is_collapsed = collapsed.includes(domain);
    return html` <div class="muc-domain-group" data-domain="${domain}">
        <a
            href="#"
            class="list-toggle muc-domain-group-toggle controlbox-padded"
            title="${i18n_title}"
            @click=${(/** @type {Event} */ ev) => el.toggleDomainList(ev, domain)}
        >
            <converse-icon
                class="fa ${is_collapsed ? 'fa-caret-right' : 'fa-caret-down'}"
                size="1em"
                color="var(--muc-color)"
            ></converse-icon>
            ${domain}
        </a>
        <ul class="items-list muc-domain-group-rooms ${is_collapsed ? 'collapsed' : ''}" data-domain="${domain}">
            ${rooms.map((room) => tplRoomItem(el, room))}
        </ul>
    </div>`;
}

/**
 * @param {RoomsList} el
 * @param {MUC[]} rooms
 */
function tplRoomDomainGroupList(el, rooms) {
    // The rooms should stay sorted as they are iterated and added in order
    const grouped_rooms = new Map();
    for (const room of rooms) {
        const roomdomain = room.get('jid').split('@').at(-1).toLowerCase();
        if (grouped_rooms.has(roomdomain)) {
            grouped_rooms.get(roomdomain).push(room);
        } else {
            grouped_rooms.set(roomdomain, [room]);
        }
    }
    const sorted_domains = Array.from(grouped_rooms.keys());
    sorted_domains.sort();

    return sorted_domains.map((domain) => tplRoomDomainGroup(el, domain, grouped_rooms.get(domain)));
}

/**
 * @param {RoomsList} el
 */
export default (el) => {
    const group_by_domain = api.settings.get('muc_grouped_by_domain');
    const rooms = el.getRoomsToShow();
    const i18n_desc_rooms = __('Click to toggle the list of open groupchats');
    const i18n_heading_chatrooms = __('Groupchats');
    const i18n_title_new_room = __('Add a groupchat');
    const is_closed = el.model.get('toggle_state') === CLOSED;

    return html` ${tplListHeading({
            label: i18n_heading_chatrooms,
            title: i18n_desc_rooms,
            modifier: 'groupchats',
            toggle_class: 'open-rooms-toggle',
            is_closed,
            show_caret: !!rooms.length,
            color: 'var(--muc-color)',
            on_toggle: (ev) => el.toggleRoomsList(ev),
            action: tplIconButton({
                class: 'btn--transparent btn--standalone show-add-muc-modal',
                icon: 'fa fa-plus',
                color: 'var(--muc-color)',
                title: i18n_title_new_room,
                handler: (ev) => api.modal.show('converse-add-muc-modal', { 'model': el.model }, ev),
            }),
        })}

        <div class="list-container list-container--openrooms ${rooms.length ? '' : 'hidden'}">
            <ul class="items-list rooms-list open-rooms-list ${is_closed ? 'collapsed' : ''}">
                ${group_by_domain
                    ? tplRoomDomainGroupList(el, rooms)
                    : rooms.map(/** @param {MUC} room */ (room) => tplRoomItem(el, room))}
            </ul>
        </div>`;
};
