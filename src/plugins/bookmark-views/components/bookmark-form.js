import tplMUCBookmarkForm from './templates/form.js';
import { CustomElement } from 'shared/components/element.js';
import { _converse, api } from '@converse/headless';

class MUCBookmarkForm extends CustomElement {
    constructor() {
        super();
        this.jid = null;
    }

    static get properties() {
        return {
            'jid': { type: String },
        };
    }

    /**
     * @param {Map<PropertyKey, any>} changed_properties
     * @return {void}
     */
    willUpdate(changed_properties) {
        const { chatboxes, bookmarks } = _converse.state;
        if (changed_properties.has('jid')) {
            this.model = chatboxes.get(this.jid);
            this.bookmark = bookmarks.get(this.jid);
        }
    }

    render() {
        return tplMUCBookmarkForm(this);
    }

    /**
     * @param {Event} ev
     */
    onBookmarkFormSubmitted(ev) {
        ev.preventDefault();
        const { bookmarks } = _converse.state;
        const form = /** @type {HTMLFormElement} */ (ev.target);
        bookmarks.setBookmark({
            jid: this.jid,
            autojoin: /** @type {HTMLInputElement} */ (form.querySelector('input[name="autojoin"]'))?.checked || false,
            name: /** @type {HTMLInputElement} */ (form.querySelector('input[name=name]'))?.value,
            nick: /** @type {HTMLInputElement} */ (form.querySelector('input[name=nick]'))?.value,
            password: /** @type {HTMLInputElement} */ (form.querySelector('input[name=password]'))?.value,
        });
        this.closeBookmarkForm(ev);
    }

    /**
     * @param {Event} ev
     */
    removeBookmark(ev) {
        this.bookmark?.destroy();
        this.closeBookmarkForm(ev);
    }

    /**
     * @param {Event} ev
     */
    closeBookmarkForm(ev) {
        ev.preventDefault();
        // Close the containing modal (this component is rendered inside a
        // converse-bookmark-form-modal, which extends BaseModal).
        /** @type {import('plugins/modal/modal.js').default} */ (this.closest('.converse-modal'))?.close();
    }
}

api.elements.define('converse-muc-bookmark-form', MUCBookmarkForm);

export default MUCBookmarkForm;
