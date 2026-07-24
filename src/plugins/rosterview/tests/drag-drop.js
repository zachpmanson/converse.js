import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { u, sizzle } = converse.env;

describe('Roster group drag-and-drop', function () {
    /**
     * Set up a grouped roster and return the rendered roster container plus a
     * single-group current contact and a different group to drop it onto.
     * @param {any} _converse
     */
    async function setup(_converse) {
        await mock.openControlBox(_converse);
        await mock.waitForRoster(_converse, 'current');
        const rosterview = document.querySelector('converse-roster');
        const roster = rosterview.querySelector('.roster-contacts');
        await u.waitUntil(() => sizzle('.roster-group', roster).length > 1);

        const contact = _converse.roster.models.find((c) => (c.get('groups') || []).length === 1);
        const from_group = contact.get('groups')[0];
        const to_group = sizzle('.roster-group', roster)
            .map((el) => el.getAttribute('data-group'))
            .find((n) => n && n !== from_group && u.rosterview.isGroupDropTarget(n));
        return { roster, contact, from_group, to_group };
    }

    it(
        'moves a contact into the group it is dropped on',
        mock.initConverse(converse, [], { roster_groups: true }, async function (_converse) {
            const { roster, contact, from_group, to_group } = await setup(_converse);

            // The contact's row is draggable.
            const li = await u.waitUntil(() =>
                roster.querySelector(`.roster-group[data-group="${from_group}"] li`),
            );
            expect(li.getAttribute('draggable')).toBe('true');

            u.rosterview.moveContactToGroup(contact.get('jid'), from_group, to_group, false);

            await u.waitUntil(() => (contact.get('groups') || []).includes(to_group));
            // Moved: dropped into the target group, removed from the source.
            expect(contact.get('groups').includes(to_group)).toBe(true);
            expect(contact.get('groups').includes(from_group)).toBe(false);
            await u.waitUntil(() => roster.querySelector(`.roster-group[data-group="${to_group}"] li`));
        }),
    );

    it(
        'copies (keeps the source group) when the modifier key is held',
        mock.initConverse(converse, [], { roster_groups: true }, async function (_converse) {
            const { contact, from_group, to_group } = await setup(_converse);

            u.rosterview.moveContactToGroup(contact.get('jid'), from_group, to_group, /* copy= */ true);

            await u.waitUntil(() => (contact.get('groups') || []).includes(to_group));
            expect(contact.get('groups').includes(from_group)).toBe(true);
            expect(contact.get('groups').includes(to_group)).toBe(true);
        }),
    );

    it(
        'removes the contact from all groups when dropped onto "Ungrouped"',
        mock.initConverse(converse, [], { roster_groups: true }, async function (_converse) {
            const { contact, from_group } = await setup(_converse);

            u.rosterview.moveContactToGroup(contact.get('jid'), from_group, _converse.labels.HEADER_UNGROUPED, false);

            await u.waitUntil(() => (contact.get('groups') || []).length === 0);
            expect(contact.get('groups')).toEqual([]);
        }),
    );

    it(
        'is a no-op when dropped onto a special (non-droppable) group or its own group',
        mock.initConverse(converse, [], { roster_groups: true }, async function (_converse) {
            const { contact, from_group } = await setup(_converse);
            spyOn(contact, 'update').and.callThrough();

            // Same group → nothing happens.
            u.rosterview.moveContactToGroup(contact.get('jid'), from_group, from_group, false);
            // A computed pseudo-group is not a valid drop target.
            u.rosterview.moveContactToGroup(
                contact.get('jid'),
                from_group,
                _converse.labels.HEADER_PENDING_CONTACTS,
                false,
            );
            expect(u.rosterview.isGroupDropTarget(_converse.labels.HEADER_PENDING_CONTACTS)).toBe(false);
            expect(contact.update).not.toHaveBeenCalled();
        }),
    );
});
