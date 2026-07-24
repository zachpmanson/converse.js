import { html, nothing } from 'lit';
import { _converse, api, converse, constants } from '@converse/headless';
import { __ } from 'i18n';
import { getChatStyle } from 'shared/chat/utils.js';
import 'shared/components/list-filter.js';
import tplSidebarFilter from './sidebar-filter.js';

const { Strophe } = converse.env;
const { ANONYMOUS } = constants;

/**
 * @param {import('../controlbox').default} el
 */
function whenNotConnected(el) {
    const is_fullscreen = api.settings.get('view_mode') === 'fullscreen';
    const connection_status = _converse.state.connfeedback.get('connection_status');
    const connecting = [Strophe.Status.RECONNECTING, Strophe.Status.CONNECTING, Strophe.Status.CONNECTED].includes(
        connection_status
    );
    const view_mode = api.settings.get('view_mode');
    const show_bg = api.settings.get('show_background');

    return html`
        ${show_bg && view_mode === 'fullscreen' ? html`<converse-bg></converse-bg>` : ''}
        <converse-controlbox-buttons class="controlbox-padded"></converse-controlbox-buttons>
        <div class="controlbox-pane d-flex flex-column justify-content-between">
            ${connecting
                ? html`<converse-spinner class="vertically-centered fade-in"></converse-spinner>`
                : el.model.get('active-form') === 'register'
                  ? html`${is_fullscreen ? html`<converse-controlbox-navbar></converse-controlbox-navbar>` : ''}
                        <converse-brand-logo></converse-brand-logo>
                        <converse-registration-form class="fade-in rounded"></converse-registration-form>
                        ${is_fullscreen ? html`<converse-footer></converse-footer>` : ''} `
                  : html`${is_fullscreen ? html`<converse-controlbox-navbar></converse-controlbox-navbar>` : ''}
                        <converse-brand-logo></converse-brand-logo>
                        <converse-login-form class="fade-in rounded"></converse-login-form>
                        ${is_fullscreen ? html`<converse-footer></converse-footer>` : ''} `}
        </div>
    `;
}

/**
 * @param {import('../controlbox').default} el
 */
export default (el) => {
    const style = getChatStyle(el.model);
    const is_overlayed = api.settings.get('view_mode') === 'overlayed';
    return html`<div class="flyout box-flyout" style="${style || nothing}">
        ${is_overlayed ? html`<converse-dragresize></converse-dragresize>` : ''}
        ${!is_overlayed
            ? html`<div
                  class="controlbox-resize-handle"
                  title="${__('Drag to resize')}"
                  @mousedown=${(/** @type {MouseEvent} */ ev) => el.onStartResize(ev)}
              ></div>`
            : ''}
        ${el.model.get('connected')
            ? html`<converse-user-profile></converse-user-profile>
                  <div class="controlbox-pane">
                      ${_converse.state.roster_filter
                          ? html`<converse-list-filter
                                class="controlbox-section sidebar-filter-container"
                                always_visible
                                .model=${_converse.state.roster_filter}
                                .items=${_converse.state.roster}
                                .template=${tplSidebarFilter}
                            ></converse-list-filter>`
                          : ''}
                      <converse-headlines-feeds-list class="controlbox-section"></converse-headlines-feeds-list>
                      <div id="chatrooms" class="controlbox-section"><converse-rooms-list></converse-rooms-list></div>
                      ${api.settings.get('authentication') === ANONYMOUS
                          ? ''
                          : html`<div id="converse-roster" class="controlbox-section"><converse-roster /></div>`}
                  </div>`
            : whenNotConnected(el)}
    </div>`;
};
