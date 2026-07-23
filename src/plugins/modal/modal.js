import { html } from 'lit';
import { getOpenPromise } from '@converse/openpromise';
import { CustomElement } from 'shared/components/element.js';
import { api, Model, log } from '@converse/headless';
import { modal_close_button } from './templates/buttons.js';
import tplModal from './templates/modal.js';

import './styles/_modal.scss';

/**
 * Base class for all modals, backed by a native `<dialog>` element (rendered
 * by {@link tplModal}) instead of Bootstrap's Modal JS. `<dialog>.showModal()`
 * natively provides the top-layer rendering, `::backdrop`, focus-trap and
 * Escape-to-close behaviour we previously got from Bootstrap.
 *
 * Lifecycle events dispatched on the host element:
 * - `converse-modal-shown`  — after the dialog has been opened
 * - `converse-modal-closed` — after the dialog has closed (any reason)
 */
class BaseModal extends CustomElement {
    /**
     * @typedef {import('lit').TemplateResult} TemplateResult
     */

    static get properties() {
        return {
            model: { type: Model },
        };
    }

    /**
     * @param {Object} options
     */
    constructor(options) {
        super();
        this.model = null;
        this.state = new Model();
        this.listenTo(this.state, 'change', () => this.requestUpdate());

        // `converse-modal` is what the stylesheet keys off (the host is only
        // shown while its <dialog> is open — see _modal.scss `:has(dialog[open])`).
        // `modal` is kept for backwards compatibility: callers/tests select the
        // host as e.g. `converse-confirm-modal.modal`.
        this.className = 'converse-modal modal';
        // Reflects the open state on the host (flipped to 'false' in show()).
        this.ariaHidden = 'true';

        this.initialized = getOpenPromise();

        // Allow properties to be set via passed in options
        Object.assign(this, options);
        setTimeout(() => this.insertIntoDOM());
    }

    /** @returns {HTMLDialogElement} */
    get dialog() {
        return /** @type {HTMLDialogElement} */ (this.querySelector('dialog'));
    }

    initialize() {
        this.requestUpdate();
        this.initialized.resolve();
    }

    /**
     * @returns {TemplateResult|string}
     */
    renderModal() {
        return '';
    }

    /**
     * @returns {TemplateResult|string}
     */
    renderModalFooter() {
        return html`<div class="modal-footer">${modal_close_button(() => this.close())}</div>`;
    }

    render() {
        return tplModal(this);
    }

    /**
     * @returns {string|TemplateResult}
     */
    getModalTitle() {
        // Intended to be overwritten
        return '';
    }

    /**
     * @param {Event} [ev]
     */
    switchTab(ev) {
        ev?.stopPropagation();
        ev?.preventDefault();
        this.tab = /** @type {HTMLElement} */ (ev.target).getAttribute('data-name');
        this.requestUpdate();
    }

    /**
     * Close on a click that lands on the `<dialog>` itself (i.e. the backdrop
     * area outside `.modal-dialog`), matching Bootstrap's click-outside dismiss.
     * @param {MouseEvent} ev
     */
    onDialogClick(ev) {
        if (ev.target === this.dialog) {
            this.close();
        }
    }

    /**
     * Handler for the native `<dialog>` `close` event.
     */
    onDialogClose() {
        this.ariaHidden = 'true';
        this.dispatchEvent(new CustomEvent('converse-modal-closed'));
        // Remove THIS instance (not "whatever is registered under this name" —
        // a newer instance may already own that slot).
        api.modal.remove(this);
    }

    close() {
        this.dialog?.close();
    }

    insertIntoDOM() {
        if (this.isConnected) return;
        const container_el = document.querySelector('#converse-modals');
        if (!container_el) {
            log.debug('BaseModal.insertIntoDOM: #converse-modals not found, skipping insertion');
            return;
        }
        container_el.insertAdjacentElement('beforeend', this);
    }

    /**
     * @param {string|null} [message]
     * @param {'info'|'primary'|'secondary'|'danger'} type
     * @param {boolean} [is_ephemeral=true]
     */
    alert(message, type = 'primary', is_ephemeral = true) {
        this.state.set('alert', { message, type });
        if (is_ephemeral) {
            if (this.alertTimeout) {
                clearTimeout(this.alertTimeout);
            }
            this.alertTimeout = setTimeout(() => {
                this.state.set('alert', undefined);
            }, 5000);
        }
    }

    async show() {
        await this.initialized;
        this.requestUpdate();
        await this.updateComplete;
        const dialog = this.dialog;
        if (dialog && !dialog.open) {
            dialog.showModal();
            this.ariaHidden = 'false';
            this.dispatchEvent(new CustomEvent('converse-modal-shown'));
        }
    }
}

export default BaseModal;
