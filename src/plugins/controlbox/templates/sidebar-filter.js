/**
 * @typedef {import('shared/components/list-filter').default} ListFilter
 */
import { html } from 'lit';
import { __ } from 'i18n';

/**
 * A simple, always-visible text filter for the controlbox sidebar. Its text is
 * shared (via `_converse.state.roster_filter`) so it filters both the contacts
 * and groupchats lists at once.
 * @param {ListFilter} el
 */
export default (el) => {
    const i18n_placeholder = __('Filter');
    const filter_text = el.model.get('text');

    return html`<form
        class="controlbox-padded sidebar-filter items-filter-form input-button-group"
        role="search"
        @submit=${(/** @type {Event} */ ev) => el.submitFilter(ev)}
    >
        <div class="btn-group">
            <input
                type="text"
                .value="${filter_text || ''}"
                @keydown=${(/** @type {Event} */ ev) => el.liveFilter(ev)}
                class="items-filter form-control"
                placeholder="${i18n_placeholder}"
                aria-label="${i18n_placeholder}"
            />
            <converse-icon
                size="1em"
                class="fa fa-times clear-input ${!filter_text ? 'hidden' : ''}"
                @click=${(/** @type {Event} */ ev) => el.clearFilter(ev)}
            ></converse-icon>
        </div>
    </form>`;
};
