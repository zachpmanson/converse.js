import { createPopper } from '@popperjs/core';
import log from '@converse/log';
import { CustomElement } from './element.js';

export default class DropdownBase extends CustomElement {
    /**
     * @param {import('lit').PropertyValues} changed
     */
    firstUpdated(changed) {
        super.firstUpdated(changed);
        this.menu = /** @type { HTMLElement|null} */ (this.querySelector('.dropdown-menu'));
        this.button = /** @type {HTMLButtonElement} */ (this.querySelector('button'));

        /** @param {MouseEvent} ev */
        this._onButtonClick = (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            this.toggle();
        };
        this.button.addEventListener('click', this._onButtonClick);

        // Close the menu once an action item is chosen (e.g. Copy), like a
        // normal dropdown. Runs after the item's own click handler (bubbling).
        this._onMenuItemClick = /** @param {MouseEvent} ev */ (ev) => {
            if (/** @type {Element} */ (ev.target)?.closest?.('.dropdown-item')) this.hide();
        };
        this.menu?.addEventListener('click', this._onMenuItemClick);
    }

    connectedCallback() {
        super.connectedCallback();
        this.registerEvents();
    }

    disconnectedCallback() {
        this.unregisterEvents();
        if (this._onButtonClick) {
            this.button?.removeEventListener('click', this._onButtonClick);
        }
        if (this._onMenuItemClick) {
            this.menu?.removeEventListener('click', this._onMenuItemClick);
        }
        if (this._onDocumentClick) {
            document.removeEventListener('click', this._onDocumentClick);
            document.removeEventListener('contextmenu', this._onDocumentClick);
        }
        this._popper?.destroy();
        super.disconnectedCallback();
    }

    /**
     * Override in subclass to register event listeners.
     * Called automatically from connectedCallback().
     */
    registerEvents() {}

    /**
     * Override in subclass to unregister event listeners.
     * Called automatically from disconnectedCallback().
     */
    unregisterEvents() {}

    /** Toggle the dropdown's visibility */
    toggle() {
        if (!this.menu) {
            log.error('DropdownBase.toggle called but this.menu is not set');
            return;
        }
        return this.menu.classList.contains('show') ? this.hide() : this.show();
    }

    /** Show the dropdown, anchored to its toggle button */
    show() {
        const menu = this.menu;
        if (!menu) {
            log.error('DropdownBase.show called but this.menu is not set');
            return;
        }
        if (menu.classList.contains('show')) return;

        this.button?.classList.add('show');
        this.button?.setAttribute('aria-expanded', 'true');
        menu.classList.add('show');

        this._popper = this._createButtonPopper();
        this._afterShow();
    }

    /**
     * Show the dropdown anchored at a viewport coordinate (e.g. a right-click
     * position) rather than at its toggle button. The toggle button is left
     * untouched, so this coexists with the normal button-triggered {@link show}.
     * @param {number} x - viewport clientX
     * @param {number} y - viewport clientY
     */
    showAt(x, y) {
        const menu = this.menu;
        if (!menu) {
            log.error('DropdownBase.showAt called but this.menu is not set');
            return;
        }

        if (menu.classList.contains('show')) {
            // Already open — re-anchor at the new cursor position.
            this._popper?.destroy();
            this._popper = this._createCursorPopper(x, y);
            return;
        }

        this.button?.setAttribute('aria-expanded', 'true');
        menu.classList.add('show');
        this._popper = this._createCursorPopper(x, y);
        this._afterShow();

        // Focus the menu itself (not the first item) so Escape / arrow-key
        // navigation (handled by the Dropdown subclass) work immediately,
        // without first clicking the menu. Focusing the menu rather than an
        // item avoids visually pre-highlighting the first `.dropdown-item` via
        // its `:focus` style; the Dropdown subclass moves focus onto the first
        // item on the first arrow-key press.
        menu.setAttribute('tabindex', '-1');
        menu.focus?.();
    }

    /** @returns {import('@popperjs/core').Instance} */
    _createButtonPopper() {
        if (this.classList.contains('dropstart')) {
            return createPopper(this.button, this.menu, {
                strategy: 'fixed',
                placement: 'left-start',
            });
        }
        return createPopper(this.button, this.menu, {
            placement: 'bottom-start',
            modifiers: [{ name: 'flip' }, { name: 'offset', options: { offset: [0, 4] } }],
        });
    }

    /**
     * @param {number} x
     * @param {number} y
     * @returns {import('@popperjs/core').Instance}
     */
    _createCursorPopper(x, y) {
        // Popper virtual element: a zero-size reference at the cursor. `fixed`
        // strategy makes the menu `position: fixed` so it escapes the overflow
        // clipping of ancestors like `.chat-msg__body` / the scroll container.
        const ref = {
            getBoundingClientRect: () =>
                /** @type {DOMRect} */ ({
                    width: 0,
                    height: 0,
                    top: y,
                    bottom: y,
                    left: x,
                    right: x,
                    x,
                    y,
                    toJSON() {
                        return this;
                    },
                }),
        };
        return createPopper(/** @type {any} */ (ref), this.menu, {
            strategy: 'fixed',
            placement: 'bottom-start',
            modifiers: [
                { name: 'flip', options: { fallbackPlacements: ['top-start', 'bottom-end', 'top-end'] } },
                { name: 'preventOverflow', options: { padding: 8 } },
            ],
        });
    }

    /** Shared tail for {@link show} / {@link showAt}: outside-close + event. */
    _afterShow() {
        this._onDocumentClick = /** @param {MouseEvent} ev */ (ev) => {
            if (!this.contains(/** @type {Node} */ (ev.target))) {
                this.hide();
            }
        };
        // A right-click doesn't emit `click`, so close on an outside contextmenu
        // too (otherwise a menu opened via right-click wouldn't close on another).
        document.addEventListener('click', this._onDocumentClick);
        document.addEventListener('contextmenu', this._onDocumentClick);

        this.dispatchEvent(new CustomEvent('converse:dropdown:show', { bubbles: true }));
    }

    /** Hide the dropdown */
    hide() {
        const menu = this.menu;
        if (!menu) {
            log.error('DropdownBase.hide called but this.menu is not set');
            return;
        }
        if (!menu.classList.contains('show')) return;

        this.button?.setAttribute('aria-expanded', 'false');
        this.button?.classList.remove('show');
        menu.classList.remove('show');

        this._popper?.destroy();
        this._popper = null;

        if (this._onDocumentClick) {
            document.removeEventListener('click', this._onDocumentClick);
            document.removeEventListener('contextmenu', this._onDocumentClick);
            this._onDocumentClick = null;
        }

        this.dispatchEvent(new CustomEvent('converse:dropdown:hide', { bubbles: true }));
    }
}
