import { html } from 'lit';
import { _converse, api, converse, log, u } from '@converse/headless';
import BaseModal from 'plugins/modal/modal.js';
import { modal_close_button } from 'plugins/modal/templates/buttons.js';
import tplNewChat from './templates/new-chat.js';
import { __ } from 'i18n';

const { Strophe } = converse.env;

export default class NewChatModal extends BaseModal {
    initialize() {
        super.initialize();
        this.listenTo(this.model, 'change', () => this.requestUpdate());
        this.requestUpdate();
        this.addEventListener(
            'converse-modal-shown',
            () => /** @type {HTMLInputElement} */ (this.querySelector('input[name="jid"]'))?.focus(),
            false,
        );
    }

    renderModal() {
        return tplNewChat(this);
    }

    renderModalFooter() {
        const i18n_start_chat = __('Start Chat');
        return html`<div class="modal-footer">
            <button type="submit" form="converse-new-chat-form" class="btn btn-primary">${i18n_start_chat}</button>
            ${modal_close_button(() => this.close())}
        </div>`;
    }

    getModalTitle() {
        return __('Start a new chat');
    }

    /**
     * @param {string} jid
     */
    validateSubmission(jid) {
        if (!u.isValidJIDInput(jid)) {
            this.model.set('error', __('Please enter a valid XMPP address'));
            return false;
        }
        this.model.set('error', null);
        return true;
    }

    /**
     * @param {HTMLFormElement} _form
     * @param {string} jid
     */
    async afterSubmission(_form, jid) {
        try {
            await api.chats.open(jid, {}, true);
        } catch (e) {
            log.error(e);
            this.model.set('error', __('Sorry, something went wrong'));
            return;
        }
        this.model.clear();
        this.close();
    }

    /**
     * @param {SubmitEvent} ev
     */
    async startChatFromForm(ev) {
        ev.preventDefault();
        const form = /** @type {HTMLFormElement} */ (ev.target);
        const data = new FormData(form);
        let jid = /** @type {string} */ (data.get('jid') || '').trim();

        // Append configured domain if user entered just a username
        jid = u.maybeAppendDomain(jid);

        if (this.validateSubmission(jid)) {
            this.afterSubmission(form, jid);
        }
    }
}

api.elements.define('converse-new-chat-modal', NewChatModal);
