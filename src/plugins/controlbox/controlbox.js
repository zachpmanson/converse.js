import { _converse, api, constants, u } from '@converse/headless';
import { CustomElement } from 'shared/components/element.js';
import { MOBILE_CUTOFF } from 'shared/constants.js';
import DragResizable from 'plugins/dragresize/mixin.js';
import tplControlbox from './templates/controlbox.js';
import './navbar.js';

const { LOGOUT } = constants;

/**
 * The ControlBox is the section of the chat that contains the open groupchats,
 * bookmarks and roster.
 *
 * In `overlayed` `view_mode` it's a box like the chat boxes, in `fullscreen`
 * `view_mode` it's a left-aligned sidebar.
 */
class ControlBoxView extends DragResizable(CustomElement) {
    initialize() {
        this.setModel();
        const { chatboxviews } = _converse.state;
        chatboxviews.add('controlbox', this);
        if (this.model.get('connected') && this.model.get('closed') === undefined) {
            this.model.set('closed', !api.settings.get('show_controlbox_by_default'));
        }
        this.viewportMediaQuery = window.matchMedia(`(max-width: ${MOBILE_CUTOFF}px)`);
        this.renderOnViewportChange = () => this.requestUpdate();
        /**
         * Triggered when the _converse.ControlBoxView has been initialized and therefore
         * exists. The controlbox contains the login and register forms when the user is
         * logged out and a list of the user's contacts and group chats when logged in.
         * @event _converse#controlBoxInitialized
         * @type {ControlBoxView}
         * @example _converse.api.listen.on('controlBoxInitialized', view => { ... });
         */
        api.trigger('controlBoxInitialized', this);
    }

    connectedCallback() {
        super.connectedCallback();
        this.viewportMediaQuery.addEventListener('change', this.renderOnViewportChange);
        this.restoreWidth();
    }

    /**
     * In fullscreen/embedded mode the controlbox is a fixed-width left sidebar
     * whose width the user can drag (see {@link #onStartResize}). Restore the
     * saved width on load.
     */
    async restoreWidth() {
        if (api.settings.get('view_mode') === 'overlayed') return;
        const width = await api.user.settings.get('controlbox_width');
        if (width) this.style.setProperty('--controlbox-width', `${width}px`);
    }

    /**
     * Drag-handler for the controlbox's right edge (fullscreen/embedded mode).
     * Live-updates the `--controlbox-width` custom property while dragging and
     * persists the final width to the user settings.
     * @param {MouseEvent} ev
     */
    onStartResize(ev) {
        ev.preventDefault();
        const start_x = ev.clientX;
        const start_width = this.offsetWidth;
        const min = 180;
        const max = Math.min(window.innerWidth * 0.6, 600);
        const onMove = (/** @type {MouseEvent} */ e) => {
            const width = Math.min(Math.max(start_width + (e.clientX - start_x), min), max);
            this.style.setProperty('--controlbox-width', `${width}px`);
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            document.body.style.userSelect = '';
            api.user.settings.set('controlbox_width', this.offsetWidth);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        document.body.style.userSelect = 'none';
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        _converse.state.chatboxviews.remove('controlbox', this);
        this.viewportMediaQuery.removeEventListener('change', this.renderOnViewportChange);
    }

    setModel() {
        this.model = _converse.state.chatboxes.get('controlbox');
        this.listenTo(_converse.state.connfeedback, 'change:connection_status', () => this.requestUpdate());
        this.listenTo(this.model, 'change:active-form', () => this.requestUpdate());
        this.listenTo(this.model, 'change:connected', () => this.requestUpdate());
        this.requestUpdate();
    }

    render() {
        if (api.settings.get('view_mode') === 'overlayed') {
            return this.model && !this.model.get('closed') ? tplControlbox(this) : '';
        }
        return tplControlbox(this);
    }

    close(ev) {
        ev?.preventDefault?.();
        const connection = api.connection.get();
        if (
            ev?.name === 'closeAllChatBoxes' &&
            (connection.disconnection_cause !== LOGOUT || api.settings.get('show_controlbox_by_default'))
        ) {
            return;
        }
        if (api.settings.get('sticky_controlbox') || api.settings.get('view_mode') !== 'overlayed') {
            return;
        }
        u.safeSave(this.model, { closed: true });
        api.trigger('controlBoxClosed', this);
        return this;
    }
}

api.elements.define('converse-controlbox', ControlBoxView);

export default ControlBoxView;
