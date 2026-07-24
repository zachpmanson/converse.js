import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { u } = converse.env;

describe('The Markdown ("formatted") message view', function () {
    /**
     * Send `text` from `contact_jid` and return the last rendered message body.
     * @param {any} _converse
     * @param {any} view
     * @param {string} contact_jid
     * @param {string} text
     * @param {number} count - Expected number of rendered messages so far.
     */
    async function sendAndGet(_converse, view, contact_jid, text, count) {
        const msg = mock.createChatMessage(_converse, contact_jid, text);
        await _converse.handleMessageStanza(msg);
        await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === count);
        return Array.from(view.querySelectorAll('converse-chat-message-body')).pop();
    }

    /** @param {Element} el */
    const strip = (el) => el.innerHTML.replace(/<!-.*?->/g, '').trim();

    it(
        'renders inline styling without the directive characters',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);

            // Markdown emphasis: **/__ is strong, single */_ is emphasis.
            let el = await sendAndGet(_converse, view, contact_jid, 'This is **bold** and *italic* and _also_', 1);
            await u.waitUntil(
                () => strip(el) === 'This is <strong>bold</strong> and <em>italic</em> and <em>also</em>',
            );
            // No directive characters visible in the formatted view
            expect(el.querySelector('.styling-directive')).toBe(null);
            // No stray asterisks left behind by **bold**
            expect(el.textContent).toBe('This is bold and italic and also');

            el = await sendAndGet(_converse, view, contact_jid, "A ~~strike~~ and `code` bit", 2);
            await u.waitUntil(() => strip(el) === 'A <del>strike</del> and <code>code</code> bit');

            // snake_case is left alone (underscores only emphasise at word boundaries)
            el = await sendAndGet(_converse, view, contact_jid, 'call some_func_here now', 3);
            await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 3);
            expect(el.querySelector('em')).toBe(null);
            expect(el.textContent).toBe('call some_func_here now');
        }),
    );

    it(
        'renders [label](url) links and rejects unsafe schemes',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);

            let el = await sendAndGet(_converse, view, contact_jid, 'see [the site](https://conversejs.org) ok', 1);
            const link = await u.waitUntil(() => el.querySelector('a[href="https://conversejs.org/"]'));
            expect(link.textContent).toBe('the site');
            expect(link.getAttribute('target')).toBe('_blank');
            expect(link.getAttribute('rel')).toBe('noopener');
            // The [label](url) markup itself is gone
            expect(el.textContent).toBe('see the site ok');

            // Inline styling works inside the label
            el = await sendAndGet(_converse, view, contact_jid, '[**bold** link](https://conversejs.org)', 2);
            await u.waitUntil(() => el.querySelector('a strong'));
            expect(el.querySelector('a strong').textContent).toBe('bold');

            // A javascript: URL is NOT turned into a link
            el = await sendAndGet(_converse, view, contact_jid, '[x](javascript:alert(1))', 3);
            await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 3);
            expect(el.querySelector('a[href^="javascript"]')).toBe(null);
        }),
    );

    it(
        'renders ATX headings',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);

            const el = await sendAndGet(_converse, view, contact_jid, '# Big title\n## Smaller', 1);
            await u.waitUntil(() => el.querySelector('h1.chat-msg__md-heading'));
            expect(el.querySelector('h1.chat-msg__md-heading').textContent).toBe('Big title');
            expect(el.querySelector('h2.chat-msg__md-heading').textContent).toBe('Smaller');
        }),
    );

    it(
        'renders ordered and unordered lists',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);

            let el = await sendAndGet(_converse, view, contact_jid, '- one\n- two\n- three', 1);
            await u.waitUntil(() => el.querySelector('ul.chat-msg__md-list'));
            let items = el.querySelectorAll('ul.chat-msg__md-list > li');
            expect(items.length).toBe(3);
            expect(items[0].textContent).toBe('one');
            expect(items[2].textContent).toBe('three');

            el = await sendAndGet(_converse, view, contact_jid, '1. first\n2. second', 2);
            await u.waitUntil(() => el.querySelector('ol.chat-msg__md-list'));
            items = el.querySelectorAll('ol.chat-msg__md-list > li');
            expect(items.length).toBe(2);
            expect(items[1].textContent).toBe('second');

            // Inline styling still works inside list items
            el = await sendAndGet(_converse, view, contact_jid, '- a **bold** item', 3);
            await u.waitUntil(() => el.querySelector('ul.chat-msg__md-list li strong'));
            expect(el.querySelector('ul.chat-msg__md-list li strong').textContent).toBe('bold');
        }),
    );

    it(
        'renders GFM tables inside a horizontally-scrollable wrapper',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);

            const table = '| Name | Age |\n| :--- | ---: |\n| Alice | 30 |\n| Bob | 25 |';
            const el = await sendAndGet(_converse, view, contact_jid, table, 1);
            await u.waitUntil(() => el.querySelector('table.chat-msg__md-table'));

            expect(el.querySelector('.chat-msg__md-table-wrap')).not.toBe(null);
            const headers = el.querySelectorAll('thead th');
            expect(headers.length).toBe(2);
            expect(headers[0].textContent).toBe('Name');
            expect(headers[1].getAttribute('style')).toBe('text-align:right');

            const rows = el.querySelectorAll('tbody tr');
            expect(rows.length).toBe(2);
            expect(rows[0].querySelectorAll('td')[0].textContent).toBe('Alice');
            expect(rows[1].querySelectorAll('td')[1].textContent).toBe('25');
        }),
    );

    it(
        'can be toggled to the raw (XEP-0393) view via the overflow menu',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);

            const el = await sendAndGet(_converse, view, contact_jid, 'Some *italic* text', 1);
            await u.waitUntil(() => strip(el) === 'Some <em>italic</em> text');

            // The overflow menu offers a "Show raw message" toggle.
            let toggle = await u.waitUntil(() => view.querySelector('.chat-msg__action-markdown'));
            expect(toggle.textContent.trim()).toBe('Show raw message');

            // No raw-mode indicator while in the formatted view.
            expect(view.querySelector('.chat-msg__raw-indicator')).toBe(null);

            // Clicking it switches to the XEP-0393 rendering, where the
            // directive characters are visible again (and a single `*` is bold).
            toggle.click();
            await u.waitUntil(() => el.querySelector('.styling-directive'));
            // A raw-mode indicator now appears (beside the receipt tick).
            await u.waitUntil(() => view.querySelector('.chat-msg__raw-indicator'));
            await u.waitUntil(
                () =>
                    strip(el) ===
                    'Some <span class="styling-directive">*</span><b>italic</b><span class="styling-directive">*</span> text',
            );

            // The toggle now offers switching back to the formatted view.
            toggle = await u.waitUntil(() => {
                const t = view.querySelector('.chat-msg__action-markdown');
                return t?.textContent.trim() === 'Show formatted message' ? t : null;
            });
            toggle.click();
            await u.waitUntil(() => strip(el) === 'Some <em>italic</em> text');
            // Indicator gone again after switching back to formatted.
            await u.waitUntil(() => view.querySelector('.chat-msg__raw-indicator') === null);
        }),
    );

    it(
        'offers no Raw/Formatted toggle for a message without styling',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);

            const el = await sendAndGet(_converse, view, contact_jid, 'just plain text', 1);
            await u.waitUntil(() => view.querySelector('.chat-msg__action-copy'));
            expect(el.querySelector('.chat-msg__action-markdown')).toBe(null);
            expect(view.querySelector('.chat-msg__action-markdown')).toBe(null);
        }),
    );
});
