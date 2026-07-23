import { html } from 'lit';
import { __ } from 'i18n';

/**
 * @param {EventListener} onClose - handler that closes the modal
 */
export const modal_close_button = (onClose) =>
    html`<button type="button" class="btn btn-secondary" @click=${onClose}>${__('Close')}</button>`;

/**
 * @param {EventListener} onClose - handler that closes the modal
 */
export const modal_header_close_button = (onClose) =>
    html`<button
        type="button"
        class="btn d-flex align-items-center justify-content-center"
        @click=${onClose}
        aria-label="${__('Close')}"
    >
        <converse-icon size="1.25em" class="fa fa-times"></converse-icon>
    </button>`;
