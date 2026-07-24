import { html } from 'lit';
import { __ } from 'i18n';
import tplIconButton from 'shared/components/templates/icon-button.js';

/**
 * @param {EventListener} onClose - handler that closes the modal
 */
export const modal_close_button = (onClose) =>
    html`<button type="button" class="btn btn-secondary" @click=${onClose}>${__('Close')}</button>`;

/**
 * @param {EventListener} onClose - handler that closes the modal
 */
export const modal_header_close_button = (onClose) =>
    tplIconButton({
        icon: 'fa fa-times',
        size: '1.25em',
        label: __('Close'),
        handler: onClose,
    });
