import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { Strophe, sizzle, u, stx } = converse.env;

/**
 * Simulate typing an address/domain into the unified "Add a Groupchat" modal.
 * @param {Element} modal
 * @param {string} value
 */
function typeAddress(modal, value) {
    const input = /** @type {HTMLInputElement} */ (modal.querySelector('input[name="chatroom"]'));
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return input;
}

const ROOMS_RESULT = (id) => stx`
    <iq from="chat.shakespeare.lit"
            to="romeo@montague.lit/pda"
            id="${id}"
            type="result"
            xmlns="jabber:client">
        <query>
            <item jid="heath@chat.shakespeare.lit" name="A Lonely Heath"/>
            <item jid="coven@chat.shakespeare.lit" name="A Dark Cave"/>
            <item jid="forres@chat.shakespeare.lit" name="The Palace"/>
            <item jid="inverness@chat.shakespeare.lit" name="Macbeth&apos;s Castle"/>
            <item jid="orchard@chat.shakespeare.lit" name="Capulet's Orchard"/>
            <item jid="friar@chat.shakespeare.lit" name="Friar Laurence's cell"/>
            <item jid="hall@chat.shakespeare.lit" name="Hall in Capulet's house"/>
            <item jid="chamber@chat.shakespeare.lit" name="Juliet's chamber"/>
            <item jid="public@chat.shakespeare.lit" name="A public place"/>
            <item jid="street@chat.shakespeare.lit" name="A street"/>
        </query>
    </iq>`;

/**
 * Wait for a disco#items query addressed to a specific server.
 * @param {any} _converse
 * @param {string} to
 */
function waitForDiscoItems(_converse, to) {
    const IQ_stanzas = _converse.api.connection.get().IQ_stanzas;
    return u.waitUntil(() =>
        IQ_stanzas
            .filter((s) => s.getAttribute('to') === to && sizzle(`query[xmlns="${Strophe.NS.DISCO_ITEMS}"]`, s).length)
            .pop(),
    );
}

describe('The "Add a Groupchat" modal', function () {
    it(
        "lists the default MUC service's groupchats when opened",
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            spyOn(u.muc, 'getDefaultMUCService').and.returnValue(Promise.resolve('chat.shakespeare.lit'));
            const modal = await mock.openAddMUCModal(_converse);
            spyOn(_converse.ChatRoom.prototype, 'getDiscoInfo').and.callFake(() => Promise.resolve());

            const sent_stanza = await waitForDiscoItems(_converse, 'chat.shakespeare.lit');
            const id = sent_stanza.getAttribute('id');
            expect(sent_stanza).toEqualStanza(stx`
                <iq from="romeo@montague.lit/orchard" id="${id}" to="chat.shakespeare.lit"
                    type="get" xmlns="jabber:client">
                <query xmlns="http://jabber.org/protocol/disco#items"/>
            </iq>`);

            _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, ROOMS_RESULT(id)));

            await u.waitUntil(() => modal.querySelectorAll('.available-chatrooms li').length === 11);
            const rooms = modal.querySelectorAll('.available-chatrooms li');
            expect(rooms[0].textContent.trim()).toBe('Groupchats found');
            expect(rooms[1].textContent.trim()).toBe('A Lonely Heath');
            expect(rooms[4].textContent.trim()).toBe("Macbeth's Castle");
            expect(rooms[10].textContent.trim()).toBe('A street');

            rooms[4].querySelector('.open-room').click();

            await mock.waitForMUCDiscoInfo(_converse, 'inverness@chat.shakespeare.lit');
            await mock.waitForReservedNick(_converse, 'inverness@chat.shakespeare.lit', 'romeo');
            await u.waitUntil(() => _converse.chatboxes.length > 1);

            expect(sizzle('.chatroom', _converse.el).filter(u.isVisible).length).toBe(1);
            const view = _converse.chatboxviews.get('inverness@chat.shakespeare.lit');
            expect(view.querySelector('.chatbox-title__text').textContent.trim()).toBe("Macbeth's Castle");
        }),
    );

    it(
        'browses a different server when its domain is entered',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            // No default service, so nothing is listed until a domain is typed.
            spyOn(u.muc, 'getDefaultMUCService').and.returnValue(Promise.resolve(undefined));
            const modal = await mock.openAddMUCModal(_converse);
            spyOn(_converse.ChatRoom.prototype, 'getDiscoInfo').and.callFake(() => Promise.resolve());

            expect(modal.querySelectorAll('.available-chatrooms li').length).toBe(0);

            typeAddress(modal, 'chat.shakespeare.lit');

            const sent_stanza = await waitForDiscoItems(_converse, 'chat.shakespeare.lit');
            const id = sent_stanza.getAttribute('id');
            _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, ROOMS_RESULT(id)));

            await u.waitUntil(() => modal.querySelectorAll('.available-chatrooms li').length === 11);
            const rooms = modal.querySelectorAll('.available-chatrooms li');
            expect(rooms[0].textContent.trim()).toBe('Groupchats found');
            expect(rooms[1].textContent.trim()).toBe('A Lonely Heath');
        }),
    );

    it(
        "doesn't browse when a specific room address is entered",
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            spyOn(u.muc, 'getDefaultMUCService').and.returnValue(Promise.resolve(undefined));
            const modal = await mock.openAddMUCModal(_converse);
            spyOn(_converse.ChatRoom.prototype, 'getDiscoInfo').and.callFake(() => Promise.resolve());

            typeAddress(modal, 'lounge@muc.montague.lit');

            // Give the debounced browse a chance to (not) fire.
            await new Promise((resolve) => setTimeout(resolve, 500));

            const IQ_stanzas = _converse.api.connection.get().IQ_stanzas;
            const disco_items = IQ_stanzas.filter((s) => sizzle(`query[xmlns="${Strophe.NS.DISCO_ITEMS}"]`, s).length);
            expect(disco_items.length).toBe(0);
            expect(modal.querySelectorAll('.available-chatrooms li').length).toBe(0);
        }),
    );

    it(
        "lists a locked MUC domain's groupchats automatically",
        mock.initConverse(
            converse,
            ['chatBoxesFetched'],
            { 'muc_domain': 'chat.shakespeare.lit', 'locked_muc_domain': true },
            async function (_converse) {
                const modal = await mock.openAddMUCModal(_converse);
                spyOn(_converse.ChatRoom.prototype, 'getDiscoInfo').and.callFake(() => Promise.resolve());

                // The domain is locked, so there's no server field to fill in.
                expect(modal.querySelector('input[name="server"]')).toBe(null);

                const sent_stanza = await waitForDiscoItems(_converse, 'chat.shakespeare.lit');
                expect(sent_stanza).toEqualStanza(stx`
                    <iq from="romeo@montague.lit/orchard" id="${sent_stanza.getAttribute('id')}"
                        to="chat.shakespeare.lit" type="get" xmlns="jabber:client">
                    <query xmlns="http://jabber.org/protocol/disco#items"/>
                </iq>`);
                const iq = stx`
                    <iq from="chat.shakespeare.lit"
                        to="romeo@montague.lit/pda"
                        id="${sent_stanza.getAttribute('id')}"
                        type="result"
                        xmlns="jabber:client">
                        <query>
                            <item jid="heath@chat.shakespeare.lit" name="A Lonely Heath"/>
                            <item jid="coven@chat.shakespeare.lit" name="A Dark Cave"/>
                            <item jid="forres@chat.shakespeare.lit" name="The Palace"/>
                        </query>
                    </iq>`;
                _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, iq));

                await u.waitUntil(() => modal.querySelectorAll('.available-chatrooms li').length === 4);
                const rooms = modal.querySelectorAll('.available-chatrooms li');
                expect(rooms[0].textContent.trim()).toBe('Groupchats found');
                expect(rooms[1].textContent.trim()).toBe('A Lonely Heath');
                expect(rooms[2].textContent.trim()).toBe('A Dark Cave');
                expect(rooms[3].textContent.trim()).toBe('The Palace');
            },
        ),
    );
});
