/**
 * @module shared/texture/markdown
 *
 * Pure (lit-free) parsers for the block-level Markdown constructs that
 * XEP-0393 "Message Styling" doesn't cover: ATX headings, ordered/unordered
 * lists and GFM tables.
 *
 * These functions operate on the raw message text and return plain data
 * (character ranges + inner-content offsets). The actual lit rendering — and
 * the recursion back into the {@link Texture} pipeline that keeps mentions,
 * emojis and hyperlinks working inside these blocks — lives in `texture.js`.
 *
 * Inline constructs (`*bold*`, `_italic_`, `` `code` ``, `~strike~`, `>` quotes
 * and ``` ``` ``` fenced blocks) are still handled by the XEP-0393 directive
 * scanner; in Markdown mode they're simply rendered without the visible
 * directive characters.
 */
import { containsDirectives } from './utils.js';

/**
 * The index of the end of the line starting at `i` (i.e. the index of the
 * next `\n`, or the length of the text if there is none).
 * @param {string} text
 * @param {number} i
 * @returns {number}
 */
function lineEnd(text, i) {
    const nl = text.indexOf('\n', i);
    return nl === -1 ? text.length : nl;
}

/**
 * @typedef {Object} HeadingMatch
 * @property {number} level - The heading level (1-6).
 * @property {number} contentStart - Index (within `text`) where the heading text starts.
 * @property {number} contentEnd - Index (within `text`) where the heading text ends.
 * @property {number} end - Index (within `text`) at which the block has been fully consumed.
 */

/**
 * Try to parse an ATX heading (`# Foo` … `###### Foo`) starting at index `i`,
 * which is assumed to be at the start of a line.
 * @param {string} text
 * @param {number} i
 * @returns {HeadingMatch|null}
 */
export function parseHeading(text, i) {
    const le = lineEnd(text, i);
    const line = text.slice(i, le);
    const m = (/^(#{1,6})[ \t]+(\S.*?)[ \t]*$/).exec(line);
    if (!m) return null;
    const level = m[1].length;
    const contentStart = i + (line.length - line.slice(m[1].length).replace(/^[ \t]+/, '').length);
    const contentEnd = contentStart + m[2].length;
    // Consume the trailing newline too, so the block element doesn't leave an
    // extra blank line behind it.
    const end = le < text.length ? le + 1 : le;
    return { level, contentStart, contentEnd, end };
}

/**
 * @typedef {Object} ListItem
 * @property {number} begin - Index (within `text`) where the item's content starts.
 * @property {number} end - Index (within `text`) where the item's content ends.
 */

/**
 * @typedef {Object} ListMatch
 * @property {boolean} ordered - Whether this is an ordered (numbered) list.
 * @property {number} start - The starting number for an ordered list.
 * @property {ListItem[]} items
 * @property {number} end - Index (within `text`) at which the block has been fully consumed.
 */

/**
 * Match a single list-item line starting at index `i`.
 * @param {string} text
 * @param {number} i
 */
function matchListItem(text, i) {
    const le = lineEnd(text, i);
    const line = text.slice(i, le);
    const m = (/^[ \t]*(?:([-*+])|(\d+)[.)])[ \t]+(\S.*)$/).exec(line);
    if (!m) return null;
    const ordered = m[2] !== undefined;
    const contentStart = i + (line.length - m[3].length);
    return { ordered, start: ordered ? parseInt(m[2], 10) : 1, contentStart, contentEnd: le, end: le };
}

/**
 * Try to parse a list (ordered or unordered) starting at index `i`, which is
 * assumed to be at the start of a line. Consecutive list-item lines of the
 * same kind (ordered/unordered) are grouped into a single list.
 * @param {string} text
 * @param {number} i
 * @returns {ListMatch|null}
 */
export function parseList(text, i) {
    const first = matchListItem(text, i);
    if (!first) return null;

    const ordered = first.ordered;
    const items = [];
    let cur = i;
    while (cur < text.length) {
        if (cur !== 0 && text[cur - 1] !== '\n') break;
        const m = matchListItem(text, cur);
        if (!m || m.ordered !== ordered) break;
        items.push({ begin: m.contentStart, end: m.contentEnd });
        cur = m.end < text.length ? m.end + 1 : text.length;
    }
    if (!items.length) return null;
    return { ordered, start: first.start, items, end: cur };
}

/**
 * @typedef {Object} TableCell
 * @property {string} text - The trimmed cell content.
 * @property {number} offset - Index (within `text`) where the trimmed content starts.
 */

/**
 * @typedef {Object} TableMatch
 * @property {TableCell[]} header
 * @property {Array<'left'|'center'|'right'|null>} aligns
 * @property {TableCell[][]} rows
 * @property {number} end - Index (within `text`) at which the block has been fully consumed.
 */

/**
 * Split a single table row into cells, computing the absolute offset of each
 * cell's trimmed content (so mentions/emojis inside a cell still line up).
 * @param {string} line - The row's text.
 * @param {number} base - The index (within the message text) at which `line` starts.
 * @returns {TableCell[]}
 */
function splitRow(line, base) {
    /** @type {{raw: string, start: number}[]} */
    const parts = [];
    let start = 0;
    for (let k = 0; k <= line.length; k++) {
        if (k === line.length || line[k] === '|') {
            parts.push({ raw: line.slice(start, k), start });
            start = k + 1;
        }
    }
    // Drop the empty leading/trailing cells produced by the outer `|` pipes.
    if (parts.length && parts[0].raw.trim() === '') parts.shift();
    if (parts.length && parts[parts.length - 1].raw.trim() === '') parts.pop();

    return parts.map((p) => {
        const lead = p.raw.length - p.raw.replace(/^[ \t]+/, '').length;
        return { text: p.raw.trim(), offset: base + p.start + lead };
    });
}

/**
 * Try to parse a GFM table starting at index `i` (assumed to be at the start
 * of a line). A table is a header row containing at least one `|`, immediately
 * followed by a delimiter row (`---`, `:--`, `:-:`, `--:` cells), followed by
 * zero or more body rows.
 * @param {string} text
 * @param {number} i
 * @returns {TableMatch|null}
 */
export function parseTable(text, i) {
    const l1e = lineEnd(text, i);
    if (l1e >= text.length) return null; // Need at least a delimiter row after the header.
    const headerLine = text.slice(i, l1e);
    if (!headerLine.includes('|')) return null;

    const l2s = l1e + 1;
    const l2e = lineEnd(text, l2s);
    const delimCells = splitRow(text.slice(l2s, l2e), 0);
    if (!delimCells.length || !delimCells.every((c) => (/^:?-+:?$/).test(c.text))) return null;

    const aligns = delimCells.map((c) => {
        const left = c.text.startsWith(':');
        const right = c.text.endsWith(':');
        return left && right ? 'center' : right ? 'right' : left ? 'left' : null;
    });

    const header = splitRow(headerLine, i);
    if (!header.length) return null;

    /** @type {TableCell[][]} */
    const rows = [];
    let cur = l2e < text.length ? l2e + 1 : text.length;
    while (cur < text.length) {
        const le = lineEnd(text, cur);
        const line = text.slice(cur, le);
        if (line.trim() === '' || !line.includes('|')) break;
        rows.push(splitRow(line, cur));
        cur = le < text.length ? le + 1 : text.length;
    }
    return { header, aligns, rows, end: cur };
}

/**
 * @param {string} ch
 * @returns {boolean}
 */
function isWordChar(ch) {
    return (/[\p{L}\p{N}]/u).test(ch);
}

/**
 * @typedef {Object} EmphasisMatch
 * @property {'emphasis'|'strong'|'strike'} kind
 * @property {number} contentStart - Index (within `text`) where the inner content starts.
 * @property {number} contentEnd - Index (within `text`) where the inner content ends.
 * @property {number} end - Index (within `text`) at which the run has been fully consumed.
 */

/**
 * Try to parse a Markdown inline-emphasis run at index `i`. Unlike XEP-0393
 * (which uses a single `*` for bold), this follows Markdown/GFM: `**`/`__` →
 * strong, single `*`/`_` → emphasis, `~~`/`~` → strikethrough.
 *
 * Basic CommonMark flanking rules are applied so word-internal and
 * whitespace-adjacent markers don't spuriously emphasise: the opening marker
 * can't be followed by whitespace, the closing marker can't be preceded by
 * whitespace, `_` only works at word boundaries (so `snake_case` is left
 * alone), and a run never crosses a line break.
 * @param {string} text
 * @param {number} i
 * @returns {EmphasisMatch|null}
 */
export function parseEmphasis(text, i) {
    const c = text[i];
    if (c !== '*' && c !== '_' && c !== '~') return null;

    let n = 0;
    while (text[i + n] === c) n++;
    // GFM strikethrough requires a double `~~`; a lone `~` is literal.
    if (c === '~' && n < 2) return null;
    const markers = n >= 2 ? 2 : 1;
    const kind = c === '~' ? 'strike' : markers === 2 ? 'strong' : 'emphasis';

    const contentStart = i + markers;
    if (contentStart >= text.length || (/\s/).test(text[contentStart])) return null;
    // Underscores only open at a left word boundary.
    if (c === '_' && i > 0 && isWordChar(text[i - 1])) return null;

    let j = contentStart;
    while (j < text.length) {
        const ch = text[j];
        if (ch === '\n') return null; // Emphasis runs don't cross lines.
        if (ch === c && !(/\s/).test(text[j - 1])) {
            let m = 0;
            while (text[j + m] === c) m++;
            if (m >= markers) {
                const after = text[j + markers];
                // Underscores only close at a right word boundary.
                if (!(c === '_' && after !== undefined && isWordChar(after))) {
                    return { kind, contentStart, contentEnd: j, end: j + markers };
                }
            }
        }
        j++;
    }
    return null;
}

/**
 * Whether the given message text contains any Markdown/XEP-0393 styling that
 * would render differently in the formatted vs. raw view. Used to decide
 * whether to offer the per-message Raw/Formatted toggle.
 * @param {string} text
 * @returns {boolean}
 */
export function containsMarkdown(text) {
    if (!text) return false;
    if (containsDirectives(text)) return true;
    // Headings and list items.
    const block_re = /(^|\n)[ \t]*(#{1,6}[ \t]+\S|(?:[-*+]|\d+[.)])[ \t]+\S)/;
    if (block_re.test(text)) return true;
    // A table: a row with a pipe immediately followed by a delimiter row.
    const table_re = /(^|\n)[^\n]*\|[^\n]*\n[ \t]*\|?[ \t]*:?-+:?[ \t]*(\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*(\n|$)/;
    if (table_re.test(text)) return true;
    return false;
}
