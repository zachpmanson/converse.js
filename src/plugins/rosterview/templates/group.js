import { html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { _converse, api, u } from '@converse/headless';
import 'shared/components/icons.js';
import { __ } from 'i18n';
import {
    isGroupDropTarget,
    onRosterContactDragEnd,
    onRosterContactDragStart,
    onRosterGroupDragLeave,
    onRosterGroupDragOver,
    onRosterGroupDrop,
    toggleGroup,
} from '../utils.js';

const { isUniView } = u;

/**
 * @param {import('@converse/headless/types/plugins/roster/contact').default} contact
 * @param {string} group_name - The group this contact is being rendered under.
 */
function renderContact(contact, group_name) {
    const jid = contact.get('jid');
    const extra_classes = [];
    if (isUniView()) {
        const chatbox = _converse.state.chatboxes.get(jid);
        if (chatbox && !chatbox.get('hidden')) {
            extra_classes.push('open');
        }
    }
    const ask = contact.get('ask');
    const requesting = contact.get('requesting');
    const subscription = contact.get('subscription');
    if (ask === 'subscribe' || subscription === 'from') {
        /* ask === 'subscribe'
         *      Means we have asked to subscribe to them.
         *
         * subscription === 'from'
         *      They are subscribed to us, but not vice versa.
         *      We assume that there is a pending subscription
         *      from us to them (otherwise we're in a state not
         *      supported by converse.js).
         *
         *  So in both cases the user is a "pending" contact.
         */
        extra_classes.push('pending-xmpp-contact');
    } else if (requesting === true) {
        extra_classes.push('requesting-xmpp-contact');
    } else if (subscription === 'both' || subscription === 'to' || u.isSameBareJID(jid, api.connection.get().jid)) {
        extra_classes.push('current-xmpp-contact');
        extra_classes.push(subscription);
        extra_classes.push(contact.getStatus());
    }
    // Only genuine ("current") contacts have groups they can be dragged between.
    const is_draggable =
        api.settings.get('roster_groups') &&
        !requesting &&
        ask !== 'subscribe' &&
        (subscription === 'both' || subscription === 'to');
    return html` <li
        class="list-item d-flex controlbox-padded ${extra_classes.join(' ')}"
        data-status="${contact.getStatus()}"
        draggable="${is_draggable ? 'true' : 'false'}"
        @dragstart=${is_draggable
            ? (/** @type {DragEvent} */ ev) => onRosterContactDragStart(ev, contact, group_name)
            : null}
        @dragend=${is_draggable ? onRosterContactDragEnd : null}
    >
        <converse-roster-contact .model=${contact}></converse-roster-contact>
    </li>`;
}

export default (o) => {
    const i18n_title = __('Click to hide these contacts');
    const collapsed = _converse.state.roster.state.get('collapsed_groups');
    // The "Ungrouped" pseudo-group has no meaningful label — its contacts just
    // sit at the roster's top level, beneath the labelled groups. Render it
    // without a group-toggle header (and therefore without collapse behaviour).
    const is_ungrouped = o.name === _converse.labels.HEADER_UNGROUPED;
    const is_collapsed = !is_ungrouped && collapsed.includes(o.name);
    const is_drop_target = isGroupDropTarget(o.name);
    return html`<div
        class="roster-group ${is_ungrouped ? 'roster-group--ungrouped' : ''}"
        data-group="${o.name}"
        @dragover=${is_drop_target ? onRosterGroupDragOver : null}
        @dragleave=${is_drop_target ? onRosterGroupDragLeave : null}
        @drop=${is_drop_target ? (/** @type {DragEvent} */ ev) => onRosterGroupDrop(ev, o.name) : null}
    >
        ${is_ungrouped
            ? ''
            : html`<a
                  href="#"
                  class="list-toggle group-toggle controlbox-padded"
                  title="${i18n_title}"
                  @click=${(/** @type {Event} */ ev) => toggleGroup(ev, o.name)}
              >
                  <converse-icon
                      color="var(--chat-color)"
                      size="1em"
                      class="fa ${is_collapsed ? 'fa-caret-right' : 'fa-caret-down'}"
                  ></converse-icon>
                  ${o.name}&nbsp;
                  ${o.contacts[0].get('requesting')
                      ? html`<converse-icon
                            color="var(--chat-color)"
                            size="1.2em"
                            class="fa fa-bell-alt"
                        ></converse-icon>`
                      : ``}
              </a>`}
        <ul
            class="items-list roster-group-contacts ${is_collapsed ? 'roster-group-contacts--collapsed' : ''}"
            data-group="${o.name}"
        >
            ${repeat(
                o.contacts,
                (c) => c.get('jid'),
                (c) => renderContact(c, o.name)
            )}
        </ul>
    </div>`;
};
