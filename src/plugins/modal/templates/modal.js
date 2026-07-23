import { html } from 'lit';
import { modal_header_close_button } from './buttons.js';

/**
 * @param {string} type
 * @param {'danger'|'warning'|'info'} message
 */
function tplAlert(type, message) {
    return html`<div class="alert alert-${type}" role="alert">${message}</div>`;
}

/**
 * @param {import ('../modal').default} el
 */
export default (el) => {
    const alert = el.state?.get('alert');
    const level = el.state?.get('level') ?? '';
    const onClose = () => el.close();
    return html`
        <dialog
            class="modal"
            @close=${() => el.onDialogClose()}
            @click=${(/** @type {MouseEvent} */ ev) => el.onDialogClick(ev)}
        >
            <div class="modal-dialog" role="dialog" aria-modal="true">
                <div class="modal-content">
                    <div class="modal-header ${level}">
                        <h5 class="modal-title">${el.getModalTitle()}</h5>
                        ${modal_header_close_button(onClose)}
                    </div>
                    <div class="modal-body">${alert ? tplAlert(alert.type, alert.message) : ''} ${el.renderModal()}</div>
                    ${el.renderModalFooter()}
                </div>
            </div>
        </dialog>
    `;
};
