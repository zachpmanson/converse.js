import { html } from "lit";
import { until } from "lit/directives/until.js";
import { _converse, constants } from "@converse/headless";
import { __ } from "i18n";
import { getStandaloneButtons, getDropdownButtons, openDropdownAt } from "shared/chat/utils.js";

const { HEADLINES_TYPE } = constants;

/**
 * @param {import('../heading').default} el
 * @returns {import('lit').TemplateResult}
 */
export default (el) => {
    const { jid, status, type } = el.model.attributes;
    const heading_buttons_promise = el.getHeadingButtons();
    const showUserDetailsModal = /** @param {Event} ev */ (ev) => el.showUserDetailsModal(ev);

    const i18n_profile = __("The User's Profile Image");
    const display_name = el.model.getDisplayName();

    // Presence state (online/away/busy/…) of the person we're chatting with,
    // shown as a small line beneath their name. Only for 1:1 chats where we
    // have a roster contact — headlines and the self-profile have no presence.
    const contact = el.model.contact;
    const chat_status = type !== HEADLINES_TYPE ? contact?.getStatus?.() : null;
    const i18n_status = {
        online: __("Online"),
        chat: __("Available"),
        away: __("Away"),
        xa: __("Away"),
        dnd: __("Busy"),
        offline: __("Offline"),
    };
    // Prefer the custom status message the contact set (e.g. "In a meeting"),
    // falling back to the generic presence label. The dot still reflects the
    // actual presence state either way.
    const status_message = type !== HEADLINES_TYPE ? contact?.get("status")?.trim() : null;
    const chat_status_text =
        status_message || (chat_status ? (i18n_status[chat_status] ?? chat_status) : null);
    const avatar = html`<span title="${i18n_profile}">
        <converse-avatar
            .model=${el.model.contact || el.model}
            class="avatar chat-msg__avatar"
            name="${display_name}"
            nonce=${el.model.contact?.vcard?.get("vcard_updated")}
            height="40"
            width="40"
        ></converse-avatar
    ></span>`;

    return html`
        <div
            class="chatbox-title ${status ? "" : "chatbox-title--no-desc"}"
            @contextmenu=${(/** @type {MouseEvent} */ ev) => openDropdownAt(ev, el)}
        >
            <div class="chatbox-title--row">
                ${!_converse.api.settings.get("singleton")
                    ? html`<converse-controlbox-navback jid="${jid}"></converse-controlbox-navback>`
                    : ""}
                ${type !== HEADLINES_TYPE
                    ? html`<a class="show-msg-author-modal" @click=${showUserDetailsModal}>${avatar}</a>`
                    : ""}
                <div class="chatbox-title__text" title="${jid}" role="heading" aria-level="2">
                    ${type !== HEADLINES_TYPE
                        ? html`<a class="user show-msg-author-modal" @click=${showUserDetailsModal}>${display_name}</a>`
                        : display_name}
                    ${chat_status_text
                        ? html`<span class="chat-head__status chat-head__status--${chat_status}">${chat_status_text}</span>`
                        : ""}
                </div>
            </div>
            <div class="chatbox-title__buttons btn-toolbar g-0">
                ${until(getStandaloneButtons(heading_buttons_promise), "")}
                ${until(getDropdownButtons(heading_buttons_promise), "")}
            </div>
        </div>
        ${status ? html`<p class="chat-head__desc">${status}</p>` : ""}
    `;
};
