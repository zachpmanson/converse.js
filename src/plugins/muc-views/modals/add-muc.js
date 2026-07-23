import { _converse, api, converse, log, u } from '@converse/headless';
import BaseModal from 'plugins/modal/modal.js';
import tplAddMuc from './templates/add-muc.js';
import tplMUCDescription from '../templates/muc-description.js';
import tplSpinner from 'templates/spinner.js';
import { __ } from 'i18n';

import '../styles/add-muc-modal.scss';

const { Strophe, stx, sizzle } = converse.env;
const { getAttributes } = u;

// Wait this long after the last keystroke before browsing a typed-in server.
const BROWSE_DEBOUNCE = 350;

/**
 * Insert groupchat info (based on returned #disco IQ stanza)
 * @param {HTMLElement} el - The HTML DOM element that contains the info.
 * @param {Element} stanza - The IQ stanza containing the groupchat info.
 */
function insertRoomInfo(el, stanza) {
    // All MUC features found here: https://xmpp.org/registrar/disco-features.html
    el.querySelector('span.spinner').remove();
    el.querySelector('a.room-info').classList.add('selected');
    el.insertAdjacentHTML(
        'beforeend',
        u.getElementFromTemplateResult(
            tplMUCDescription({
                'jid': stanza.getAttribute('from'),
                'desc': sizzle('field[var="muc#roominfo_description"] value', stanza).shift()?.textContent,
                'occ': sizzle('field[var="muc#roominfo_occupants"] value', stanza).shift()?.textContent,
                'hidden': sizzle('feature[var="muc_hidden"]', stanza).length,
                'membersonly': sizzle('feature[var="muc_membersonly"]', stanza).length,
                'moderated': sizzle('feature[var="muc_moderated"]', stanza).length,
                'nonanonymous': sizzle('feature[var="muc_nonanonymous"]', stanza).length,
                'open': sizzle('feature[var="muc_open"]', stanza).length,
                'passwordprotected': sizzle('feature[var="muc_passwordprotected"]', stanza).length,
                'persistent': sizzle('feature[var="muc_persistent"]', stanza).length,
                'publicroom': sizzle('feature[var="muc_publicroom"]', stanza).length,
                'semianonymous': sizzle('feature[var="muc_semianonymous"]', stanza).length,
                'temporary': sizzle('feature[var="muc_temporary"]', stanza).length,
                'unmoderated': sizzle('feature[var="muc_unmoderated"]', stanza).length,
            }),
        ),
    );
}

/**
 * Show/hide extra information about a groupchat in a listing.
 * @param {Event} ev
 */
function toggleRoomInfo(ev) {
    const parent_el = u.ancestor(ev.target, '.room-item');
    const div_el = parent_el.querySelector('div.room-info');
    if (div_el) {
        u.slideIn(div_el).then(u.removeElement);
        parent_el.querySelector('a.room-info').classList.remove('selected');
    } else {
        parent_el.insertAdjacentElement('beforeend', u.getElementFromTemplateResult(tplSpinner()));
        api.disco
            .info(/** @type HTMLElement */ (ev.target).getAttribute('data-room-jid'), null)
            .then(/** @param {Element} stanza */ (stanza) => insertRoomInfo(parent_el, stanza))
            .catch(/** @param {Error} e */ (e) => log.error(e));
    }
}

/**
 * A single modal for adding/joining a groupchat by address as well as
 * browsing the public groupchats hosted on a server. Typing a bare domain
 * into the address field lists that server's rooms inline; typing a room
 * address (or picking a search result) and hitting "Join" opens it.
 */
export default class AddMUCModal extends BaseModal {
    /**
     * @typedef {import('shared/types').EventWithInputTarget} EventWithInputTarget
     */

    constructor(/** @type {import('@converse/skeletor').ModelOptions} */ options) {
        super(options);
        this.items = [];
        this.loading_items = false;
        this.feedback_text = '';
        this.rooms_cache = {};
        this.browse_timeout = null;
    }

    initialize() {
        super.initialize();
        this.requestUpdate();
        this.addEventListener(
            'converse-modal-shown',
            () => {
                /** @type {HTMLInputElement} */ (this.querySelector('input[name="chatroom"]'))?.focus();
                this.listDefaultRooms();
            },
            false,
        );
    }

    /**
     * When the modal opens, list the public groupchats on the default MUC
     * service (the configured `muc_domain`, or the one discovered on the
     * user's server) so the user can browse without having to know or type in
     * a server address.
     */
    async listDefaultRooms() {
        if (this.items.length || this.loading_items) return;
        const service = await u.muc.getDefaultMUCService();
        // Bail if a browse was kicked off (e.g. the user started typing) while
        // we were resolving the default service.
        if (!service || this.items.length || this.loading_items) return;
        this.browseServer(service);
    }

    renderModal() {
        return tplAddMuc(this);
    }

    getModalTitle() {
        return __('Add a Groupchat');
    }

    /**
     * @param {HTMLFormElement} form
     * @returns {{ jid: string, nick: string }}
     */
    parseRoomDataFromEvent(form) {
        const data = new FormData(form);
        const jid = u.getJIDFromURI(/** @type {string} */ (data.get('chatroom'))?.trim());
        let nick;
        if (api.settings.get('locked_muc_nickname')) {
            nick = _converse.exports.getDefaultMUCNickname();
            if (!nick) {
                throw new Error('Using locked_muc_nickname but no nickname found!');
            }
        } else {
            nick = /** @type {string} */ (data.get('nickname')).trim();
        }
        return { jid, nick };
    }

    /**
     * Takes a string and returns a normalized lowercase value representing the node (localpart) of a MUC JID.
     * Replaces all spaces with dashes, replaces diacritics with ASCII, and
     * removes all characters besides letters and numbers and dashes.
     * @param {string} s
     * @returns {string}
     */
    normalizeNode(s) {
        return s
            .trim()
            .replace(/\s+/g, '-')
            .replace(/\u0142/g, 'l')
            .replace(/[^\x00-\x7F]/g, (c) => c.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
            .replace(/[^a-zA-Z0-9-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/[^a-zA-Z0-9]$/g, '')
            .toLowerCase();
    }

    /**
     * @param {Event} ev
     */
    async openChatRoom(ev) {
        ev.preventDefault();

        const autocomplete_el = /** @type {import('shared/autocomplete/component').default} */ (
            this.querySelector('converse-autocomplete')
        );
        if ((await autocomplete_el.onChange()).error_message) return;

        const { escapeNode, getNodeFromJid, getDomainFromJid } = Strophe;
        const form = /** @type {HTMLFormElement} */ (ev.target);

        const data = this.parseRoomDataFromEvent(form);
        const settings = {
            nick: data.nick ?? undefined,
        };

        let jid;
        if (api.settings.get('locked_muc_domain') || !u.isValidJID(data.jid)) {
            const muc_service = await u.muc.getDefaultMUCService();
            if (muc_service) {
                let room_name = data.jid;
                const suffix = `@${muc_service}`;
                if (room_name.toLowerCase().endsWith(suffix.toLowerCase())) {
                    room_name = room_name.slice(0, -suffix.length);
                }
                settings.name = room_name;
                settings.auto_configure = true;
                settings.roomconfig = {
                    roomname: room_name,
                };
                jid = `${this.normalizeNode(room_name)}@${muc_service}`.toLowerCase();
            }
        }

        if (!jid) {
            jid = `${escapeNode(getNodeFromJid(data.jid))}@${getDomainFromJid(data.jid)}`.toLowerCase();
        }

        api.rooms.open(jid, { ...settings, jid }, true);
        form.reset();
        this.close();
    }

    /**
     * @param {string} jid
     * @return {Promise<string>}
     */
    async validateMUCJID(jid) {
        if (jid.length === 0) {
            return __('Invalid groupchat address, it cannot be empty.');
        }

        const num_slashes = jid.split('/').length - 1;
        if (num_slashes > 0) {
            return __('Invalid groupchat address, a forward slash is not allowed.');
        }

        const num_ats = jid.split('@').length - 1;
        if (num_ats > 1) {
            return __('Invalid groupchat address, more than one @ sign is not allowed.');
        }

        if (jid.startsWith('@') || jid.endsWith('@')) {
            return __('Invalid groupchat address, it cannot start or end with an @ sign.');
        }

        if (!jid.includes('@')) {
            const muc_service = await u.muc.getDefaultMUCService();
            if (!muc_service) {
                return __(
                    'No default groupchat service found. ' +
                        "You'll need to specify the full address, for example room@conference.example.org",
                );
            }
        }

        const policy = api.settings.get('muc_roomid_policy');
        if (policy && api.settings.get('muc_domain')) {
            const muc_domain = api.settings.get('muc_domain');
            if (api.settings.get('locked_muc_domain') || !u.isValidJID(jid)) {
                const domain_suffix = `@${muc_domain}`;
                if (jid.toLowerCase().endsWith(domain_suffix.toLowerCase())) {
                    jid = jid.slice(0, -domain_suffix.length);
                }
                jid = `${Strophe.escapeNode(jid)}@${muc_domain}`;
            }
            const muc_jid = Strophe.getNodeFromJid(jid);
            const jid_domain = Strophe.getDomainFromJid(jid);
            if (muc_domain === jid_domain && !policy.test(muc_jid)) {
                return __('Groupchat id is invalid.');
            }
        }
        return '';
    }

    /**
     * Whether the value typed into the address field is a bare server domain
     * (no localpart, no resource, looks like a hostname) that we can browse
     * for public groupchats, rather than a specific room address to join.
     * @param {string} value
     * @returns {boolean}
     */
    isBrowsableDomain(value) {
        const domain = value.trim();
        if (!domain || domain.includes('@') || domain.includes('/')) return false;
        // A hostname has at least one dot and no leading/trailing dot.
        return (/^[^.\s][^\s]*\.[^.\s][^\s]*$/).test(domain);
    }

    /**
     * Fired as the user types into the address field. When the value looks
     * like a bare server domain, browse that server's public groupchats
     * (debounced), otherwise clear any previous listing.
     * @param {EventWithInputTarget} ev
     */
    onAddressInput(ev) {
        if (api.settings.get('locked_muc_domain')) return;
        if (ev.target?.getAttribute?.('name') !== 'chatroom') return;
        const value = ev.target.value;
        clearTimeout(this.browse_timeout);
        if (this.isBrowsableDomain(value)) {
            this.browse_timeout = setTimeout(() => this.browseServer(value.trim()), BROWSE_DEBOUNCE);
        } else if (this.items.length || this.feedback_text) {
            this.items = [];
            this.feedback_text = '';
            this.requestUpdate();
        }
    }

    /**
     * Query a server for its public groupchats and render them inline.
     * @param {string} domain
     */
    browseServer(domain) {
        if (!domain) return;
        this.model.setDomain(domain);
        this.loading_items = true;
        this.feedback_text = '';
        this.requestUpdate();
        this.updateRoomsList(domain);
    }

    /**
     * @param {MouseEvent} ev
     */
    openRoom(ev) {
        ev.preventDefault();
        const el = /** @type {Element} */ (ev.target);
        const jid = el.getAttribute('data-room-jid');
        const name = el.getAttribute('data-room-name');
        this.close();
        api.rooms.open(jid, { name }, true);
    }

    /**
     * @param {MouseEvent} ev
     */
    toggleRoomInfo(ev) {
        ev.preventDefault();
        toggleRoomInfo(ev);
    }

    /**
     * Handle the IQ stanza returned from the server, containing
     * all its public groupchats.
     * @param {Element} [iq]
     */
    onRoomsFound(iq) {
        this.loading_items = false;
        const rooms = iq ? sizzle('query item', iq) : [];
        if (rooms.length) {
            this.feedback_text = __('Groupchats found');
            this.items = rooms.map(getAttributes);
        } else {
            this.items = [];
            this.feedback_text = __('No groupchats found');
        }
        this.requestUpdate();
        return true;
    }

    /**
     * Send an IQ stanza to the server asking for all its public groupchats.
     * @param {string} domain
     */
    updateRoomsList(domain) {
        const iq = stx`
            <iq to="${domain}"
                from="${api.connection.get().jid}"
                type="get"
                xmlns="jabber:client">
                <query xmlns="${Strophe.NS.DISCO_ITEMS}"></query>
            </iq>`;
        api.sendIQ(iq)
            .then(/** @param {Element} iq */ (iq) => this.onRoomsFound(iq))
            .catch(() => this.onRoomsFound());
    }
}

api.elements.define('converse-add-muc-modal', AddMUCModal);
