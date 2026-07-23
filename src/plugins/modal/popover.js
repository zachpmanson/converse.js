import { createPopper } from '@popperjs/core';
import { html } from 'lit';
import { api, u } from '@converse/headless';
import { CustomElement } from 'shared/components/element.js';

import './styles/popover.scss';

/**
 * A small info popover: an icon button that toggles a popover with a title and
 * some text. Built on the native Popover API (`popover` / `popovertarget`),
 * which provides the top-layer rendering and light-dismiss (click-outside /
 * Escape) that Bootstrap's Popover JS used to give us. Placement relative to
 * the button uses `@popperjs/core` (already used by converse-dropdown).
 */
class Popover extends CustomElement {
    static get properties() {
        return {
            title: { type: String },
            text: { type: String },
        };
    }

    constructor() {
        super();
        this.title = null;
        this.text = null;
        this.popover_id = u.getUniqueId('converse-popover-');
    }

    /**
     * @param {import("lit").PropertyValues} changedProperties
     */
    firstUpdated(changedProperties) {
        super.firstUpdated(changedProperties);
        this.button = this.querySelector('button');
        this.popover = /** @type {HTMLElement} */ (this.querySelector('[popover]'));

        this._onToggle = /** @param {any} ev */ (ev) => {
            if (ev.newState === 'open') {
                this._popper = createPopper(this.button, this.popover, {
                    strategy: 'fixed',
                    placement: 'bottom',
                    modifiers: [
                        { name: 'offset', options: { offset: [0, 6] } },
                        { name: 'flip' },
                        { name: 'preventOverflow', options: { padding: 8 } },
                    ],
                });
            } else {
                this._popper?.destroy();
                this._popper = null;
            }
        };
        this.popover.addEventListener('toggle', this._onToggle);
    }

    disconnectedCallback() {
        this.popover?.removeEventListener('toggle', this._onToggle);
        this._popper?.destroy();
        super.disconnectedCallback();
    }

    render() {
        return html`<button
                type="button"
                class="btn p-0"
                popovertarget="${this.popover_id}"
                aria-label="${this.title ?? ''}"
            >
                <converse-icon class="fa fa-info-circle" size="1.2em"></converse-icon>
            </button>
            <div popover id="${this.popover_id}" class="converse-popover__content">
                ${this.title ? html`<div class="popover-header">${this.title}</div>` : ''}
                <div class="popover-body">${this.text}</div>
            </div>`;
    }
}

api.elements.define('converse-popover', Popover);

export default Popover;
