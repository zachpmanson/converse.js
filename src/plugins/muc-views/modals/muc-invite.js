import { html } from 'lit';
import { _converse, api, converse } from '@converse/headless';
import BaseModal from 'plugins/modal/modal.js';
import { modal_close_button } from 'plugins/modal/templates/buttons.js';
import 'shared/autocomplete/index.js';
import tplMUCInviteModal from './templates/muc-invite.js';
import { __ } from 'i18n';

const u = converse.env.utils;

export default class MUCInviteModal extends BaseModal {
    constructor(options) {
        super(options);
        this.id = 'converse-muc-invite-modal';
        this.muc = options.muc;
    }

    renderModal() {
        return tplMUCInviteModal(this);
    }

    renderModalFooter() {
        const i18n_invite = __('Invite');
        return html`<div class="modal-footer">
            <input type="submit" form="converse-muc-invite-form" class="btn btn-primary" value="${i18n_invite}" />
            ${modal_close_button(() => this.close())}
        </div>`;
    }

    getModalTitle() {
        return __('Invite someone to this groupchat');
    }

    getAutoCompleteList() {
        return _converse.state.roster.map((i) => ({ label: i.getDisplayName(), value: i.get('jid') }));
    }

    /**
     * @param {Event} ev
     */
    submitInviteForm(ev) {
        ev.preventDefault();
        // TODO: Add support for sending an invite to multiple JIDs
        const data = new FormData(/** @type {HTMLFormElement} */ (ev.target));
        const jid = /** @type {string} */ (data.get('invitee_jids'))?.trim();
        const reason = data.get('reason');
        if (u.isValidJID(jid)) {
            // TODO: Create and use API here
            this.muc.directInvite(jid, reason);
            this.close();
        } else {
            this.state.set({ invalid_invite_jid: true });
        }
    }
}

api.elements.define('converse-muc-invite-modal', MUCInviteModal);
