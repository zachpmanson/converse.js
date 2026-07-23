import DOMPurify from 'dompurify';
import { _converse, api } from '@converse/headless';
import { html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { getAutoCompleteList } from '../../search.js';
import tplSpinner from 'templates/spinner.js';
import { __ } from 'i18n';

const nickname_input = () => {
    const i18n_nickname = __('Nickname');
    const i18n_required_field = __('This field is required');
    return html`
        <div class="mb-3">
            <label for="nickname" class="form-label">${i18n_nickname}:</label>
            <input
                type="text"
                title="${i18n_required_field}"
                required
                name="nickname"
                value="${_converse.exports.getDefaultMUCNickname() || ''}"
                class="form-control"
            />
        </div>
    `;
};

/**
 * A single groupchat in the inline browse listing.
 * @param {import('../add-muc.js').default} el
 * @param {import('@converse/headless/types/shared/types').Attrs} item
 */
const tplRoomItem = (el, item) => {
    const i18n_info_title = __('Show more information on this groupchat');
    const i18n_open_title = __('Click to open this groupchat');
    return html`
        <li class="room-item list-group-item">
            <div class="available-chatroom d-flex flex-row">
                <a
                    class="open-room available-room w-100"
                    @click=${(/** @type {MouseEvent} */ ev) => el.openRoom(ev)}
                    data-room-jid="${item.jid}"
                    data-room-name="${item.name}"
                    title="${i18n_open_title}"
                    href="#"
                    >${item.name || item.jid}</a
                >
                <a
                    class="right room-info icon-room-info"
                    @click=${(/** @type {MouseEvent} */ ev) => el.toggleRoomInfo(ev)}
                    data-room-jid="${item.jid}"
                    title="${i18n_info_title}"
                    href="#"
                ></a>
            </div>
        </li>
    `;
};

/**
 * @param {import('../add-muc.js').default} el
 */
export default (el) => {
    const i18n_join = __('Join');
    let label_name;
    if (api.settings.get('locked_muc_domain')) {
        label_name = __('Groupchat name');
    } else {
        label_name = __('Groupchat name or address');
    }

    const policy_hint = api.settings.get('muc_roomid_policy_hint');
    const muc_search_service = api.settings.get('muc_search_service');
    const show_list = el.loading_items || el.feedback_text || el.items.length;

    return html` <form
        class="converse-form add-chatroom needs-validation"
        @submit=${(/** @type {Event} */ ev) => el.openChatRoom(ev)}
        novalidate
    >
        <div class="mb-3 add-muc-search ${show_list ? 'add-muc-search--listing' : ''}">
            <label for="chatroom" class="form-label">${label_name}:</label>
            <div class="input-group">
                ${muc_search_service
                    ? html` <converse-autocomplete
                          .getAutoCompleteList="${getAutoCompleteList}"
                          .validate="${/** @param {string} v */ (v) => el.validateMUCJID(v)}"
                          @input=${(/** @type {InputEvent} */ ev) => el.onAddressInput(ev)}
                          ?autofocus="${true}"
                          class="add-muc-autocomplete"
                          min_chars="3"
                          name="chatroom"
                          position="below"
                          required
                      ></converse-autocomplete>`
                    : ''}
            </div>
            ${show_list
                ? html`<ul class="available-chatrooms list-group">
                      ${el.loading_items ? html`<li class="list-group-item">${tplSpinner()}</li>` : ''}
                      ${el.feedback_text
                          ? html`<li class="list-group-item list-group-item--feedback">${el.feedback_text}</li>`
                          : ''}
                      ${repeat(
                          el.items,
                          /** @param {{ jid: string }} item */ (item) => item.jid,
                          /** @param {object} item */ (item) => tplRoomItem(el, item)
                      )}
                  </ul>`
                : ''}
            ${policy_hint
                ? html`<div class="mt-2">
                      ${unsafeHTML(DOMPurify.sanitize(policy_hint, { 'ALLOWED_TAGS': ['b', 'br', 'em'] }))}
                  </div>`
                : ''}
        </div>
        ${!api.settings.get('locked_muc_nickname') ? nickname_input() : ''}
        <input type="submit" class="btn btn-primary mt-3" name="join" value="${i18n_join || ''}" />
    </form>`;
};
