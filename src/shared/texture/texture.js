import { html } from 'lit';
import { until } from 'lit/directives/until.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { Directive, directive } from 'lit/directive.js';
import { api, u } from '@converse/headless';
import tplAudio from './templates/audio.js';
import tplGif from './templates/gif.js';
import tplImage from './templates/image.js';
import tplVideo from './templates/video.js';
import tplSpotify from './templates/spotify.js';
import { getEmojiMarkup } from '../chat/utils.js';
import { getHyperlinkTemplate } from '../../utils/html.js';
import { shouldRenderMediaFromURL, filterQueryParamsFromURL } from 'utils/url.js';
import {
    collapseLineBreaks,
    containsDirectives,
    getDirectiveAndLength,
    getURLRanges,
    isQuoteDirective,
    isSpotifyTrack,
    isString,
    tplMention,
    tplMentionWithNick,
} from './utils.js';
import { parseEmphasis, parseHeading, parseLink, parseList, parseTable } from './markdown.js';
import { styling_map } from './constants.js';

const { addMediaURLsOffset, getMediaURLsMetadata } = u;

/**
 * @class Texture
 * A String subclass that is used to render rich text (i.e. text that contains
 * hyperlinks, images, mentions, styling etc.).
 *
 * The "rich" parts of the text is represented by lit TemplateResult
 * objects which are added via the {@link Texture.addTemplateResult}
 * method and saved as metadata.
 *
 * By default Converse adds TemplateResults to support emojis, hyperlinks,
 * images, map URIs and mentions.
 *
 * 3rd party plugins can listen for the `beforeMessageBodyTransformed`
 * and/or `afterMessageBodyTransformed` events and then call
 * `addTemplateResult` on the Texture instance in order to add their own
 * rich features.
 */
export class Texture extends String {
    /**
     * @typedef {import('@converse/headless/types/utils/types').MediaURLMetadata} MediaURLMetadata
     */

    /**
     * Create a new {@link Texture} instance.
     * @param {string} text - The text to be annotated
     * @param {number} offset - The offset of this particular piece of text
     *  from the start of the original message text. This is necessary because
     *  Texture instances can be nested when templates call directives
     *  which create new Texture instances (as happens with XEP-393 styling directives).
     * @param {Object} [options]
     * @param {string} [options.nick] - The current user's nickname (only relevant if the message is in a XEP-0045 MUC)
     * @param {boolean} [options.render_styling] - Whether XEP-0393 message styling should be applied to the message
     * @param {boolean} [options.render_markdown] - Whether the message should be rendered as Markdown (formatted view).
     *  When set, the directive characters are removed and headings/lists/tables are supported. Supersedes `render_styling`.
     * @param {boolean} [options.embed_audio] - Whether audio URLs should be rendered as <audio> elements.
     *  If set to `true`, then audio files will always be rendered with an
     *  audio player. If set to `false`, they won't, and if not defined, then the `embed_audio` setting
     *  is used to determine whether they should be rendered as playable audio or as hyperlinks.
     * @param {boolean} [options.embed_videos] - Whether video URLs should be rendered as <video> elements.
     *  If set to `true`, then videos will always be rendered with a video
     *  player. If set to `false`, they won't, and if not defined, then the `embed_videos` setting
     *  is used to determine whether they should be rendered as videos or as hyperlinks.
     * @param {import('./types').Mention[]} [options.mentions] - An array of mention references
     * @param {MediaURLMetadata[]} [options.media_urls] - An array of {@link MediaURLMetadata} objects,
     *  used to render media such as images, videos and audio. It might not be
     *  possible to have the media metadata available, so if this value is
     *  `undefined` then the passed-in `text` will be parsed for URLs. If you
     *  don't want this parsing to happen, pass in an empty array for this
     *  option.
     * @param {boolean} [options.show_images] - Whether image URLs should be rendered as <img> elements.
     * @param {boolean} [options.show_me_message] - Whether /me messages should be rendered differently
     * @param {Function} [options.onImgClick] - Callback for when an inline rendered image has been clicked
     * @param {Function} [options.onImgLoad] - Callback for when an inline rendered image has been loaded
     * @param {boolean} [options.hide_media_urls] - Callback for when an inline rendered image has been loaded
     */
    constructor(text, offset = 0, options = {}) {
        super(text);
        this.embed_audio = options?.embed_audio;
        this.embed_videos = options?.embed_videos;
        this.mentions = options?.mentions || [];
        this.media_urls = options?.media_urls;
        this.nick = options?.nick;
        this.offset = offset;
        this.onImgClick = options?.onImgClick;
        this.onImgLoad = options?.onImgLoad;
        this.options = options;
        this.payload = [];
        this.references = [];
        this.render_markdown = options?.render_markdown;
        this.render_styling = options?.render_styling;
        this.show_images = options?.show_images;
        this.hide_media_urls = options?.hide_media_urls;
    }

    /**
     * @param {string} url - The URL to be checked
     * @param {'audio'|'image'|'video'} type - The type of media
     */
    shouldRenderMedia(url, type) {
        let override;
        if (type === 'image') {
            override = this.show_images;
        } else if (type === 'audio') {
            override = this.embed_audio;
        } else if (type === 'video') {
            override = this.embed_videos;
        }
        if (typeof override === 'boolean') {
            return override;
        }
        return shouldRenderMediaFromURL(url, type);
    }

    /**
     * Look for `http` URIs and return templates that render them as URL links
     * @param {MediaURLMetadata} url_obj
     * @returns {Promise<string|import('lit').TemplateResult>}
     */
    async addHyperlinkTemplate(url_obj) {
        const { url } = url_obj;
        const filtered_url = filterQueryParamsFromURL(url);
        let template;
        if (url_obj.is_gif && this.shouldRenderMedia(url, 'image')) {
            template = tplGif(filtered_url, this.hide_media_urls);
        } else if (url_obj.is_image && this.shouldRenderMedia(url, 'image')) {
            template = tplImage({
                src: filtered_url,
                // XXX: bit of an abuse of `hide_media_urls`, might want a dedicated option here
                href: this.hide_media_urls ? null : filtered_url,
                onClick: this.onImgClick,
                onLoad: this.onImgLoad,
            });
        } else if (url_obj.is_video && this.shouldRenderMedia(url, 'video')) {
            template = tplVideo(filtered_url, this.hide_media_urls);
        } else if (url_obj.is_audio && this.shouldRenderMedia(url, 'audio')) {
            template = tplAudio(filtered_url, this.hide_media_urls);
        } else if (api.settings.get('embed_3rd_party_media_players') && isSpotifyTrack(url)) {
            const song_id = url.split('/track/')[1];
            template = tplSpotify(song_id, url, this.hide_media_urls);
        }
        return template || getHyperlinkTemplate(filtered_url);
    }

    /**
     * Look for `http` URIs and return templates that render them as URL links
     * @param {string} text
     * @param {number} local_offset - The index of the passed in text relative to
     *  the start of this Texture instance (which is not necessarily the same as the
     *  offset from the start of the original message stanza's body text).
     */
    async addHyperlinks(text, local_offset) {
        const full_offset = local_offset + this.offset;
        const urls_meta = this.media_urls || (await getMediaURLsMetadata(text, local_offset)).media_urls || [];
        const media_urls = addMediaURLsOffset(urls_meta, text, full_offset);
        await Promise.all(
            media_urls
                .filter((o) => !o.is_encrypted)
                .map(async (o) => {
                    const template = await this.addHyperlinkTemplate(o);
                    this.addTemplateResult(o.start + local_offset, o.end + local_offset, template);
                }),
        );
    }

    /**
     * Look for `geo` URIs and return templates that render them as URL links
     * @param {String} text
     * @param {number} offset - The index of the passed in text relative to
     *  the start of the message body text.
     */
    addMapURLs(text, offset) {
        const regex = /geo:([\-0-9.]+),([\-0-9.]+)(?:,([\-0-9.]+))?(?:\?(.*))?/g;
        const matches = text.matchAll(regex);
        for (const m of matches) {
            this.addTemplateResult(
                m.index + offset,
                m.index + m[0].length + offset,
                getHyperlinkTemplate(m[0].replace(regex, api.settings.get('geouri_replacement'))),
            );
        }
    }

    /**
     * Look for emojis (shortnames or unicode) and add templates for rendering them.
     * @param {String} text
     * @param {number} offset - The index of the passed in text relative to
     *  the start of the message body text.
     */
    addEmojis(text, offset) {
        const references = [
            ...u.emojis.getShortnameReferences(text.toString()),
            ...u.emojis.getCodePointReferences(text.toString()),
        ];
        references.forEach((e) => {
            this.addTemplateResult(e.begin + offset, e.end + offset, getEmojiMarkup(e, { add_title_wrapper: true }));
        });
    }

    /**
     * Look for mentions included as XEP-0372 references and add templates for
     * rendering them.
     * @param {String} text
     * @param {number} local_offset - The index of the passed in text relative to
     *  the start of this Texture instance (which is not necessarily the same as the
     *  offset from the start of the original message stanza's body text).
     */
    addMentions(text, local_offset) {
        const full_offset = local_offset + this.offset;
        this.mentions?.forEach((ref) => {
            const begin = Number(ref.begin) - full_offset;
            if (begin < 0 || begin >= full_offset + text.length) {
                return;
            }
            const end = Number(ref.end) - full_offset;
            const mention = text.slice(begin, end);
            if (mention === this.nick) {
                this.addTemplateResult(
                    begin + local_offset,
                    end + local_offset,
                    tplMentionWithNick({ ...ref, mention }),
                );
            } else {
                this.addTemplateResult(begin + local_offset, end + local_offset, tplMention({ ...ref, mention }));
            }
        });
    }

    /**
     * Look for XEP-0393 styling directives and add templates for rendering them.
     */
    addStyling() {
        if (!containsDirectives(this)) {
            return;
        }

        const references = [];
        const text_str = this.toString();
        const mention_ranges = this.mentions.map((m) =>
            Array.from({ length: Number(m.end) }, (_, i) => Number(m.begin) + i),
        );

        // Pre-detect URL ranges so that styling directives (e.g. underscores)
        // inside URLs are not mistakenly treated as emphasis markers.
        // See https://github.com/conversejs/converse.js/issues/2857
        const url_ranges = getURLRanges(text_str);

        let i = 0;
        while (i < this.length) {
            if (mention_ranges.filter((r) => r.includes(i)).length) {
                // eslint-disable-line no-loop-func
                // Don't treat potential directives if they fall within a
                // declared XEP-0372 reference
                i++;
                continue;
            }
            if (url_ranges.some(([start, end]) => i >= start && i < end)) {
                // Don't treat potential directives if they fall within a URL
                i++;
                continue;
            }
            const { d, length } = getDirectiveAndLength(this, i);
            if (d && length) {
                const is_quote = isQuoteDirective(d);
                const end = i + length;
                const slice_end = is_quote ? end : end - d.length;
                let slice_begin = d === '```' ? i + d.length + 1 : i + d.length;
                if (is_quote && this[slice_begin] === ' ') {
                    // Trim leading space inside codeblock
                    slice_begin += 1;
                }
                const offset = slice_begin;
                const text = this.slice(slice_begin, slice_end);
                references.push({
                    begin: i,
                    template: getDirectiveTemplate(d, text, offset, this.options),
                    end,
                });
                i = end;
            }
            i++;
        }
        references.forEach((ref) => this.addTemplateResult(ref.begin, ref.end, ref.template));
    }

    /**
     * Render the text as Markdown (the "formatted" view).
     *
     * This reuses the XEP-0393 inline directive scanner — but renders the
     * directives *without* their literal marker characters — and additionally
     * recognises the block-level constructs XEP-0393 lacks: ATX headings,
     * ordered/unordered lists and GFM tables. Block constructs are detected at
     * the start of a line and take precedence over inline directives; their
     * inner text is rendered recursively so mentions, emojis and hyperlinks
     * keep working inside them.
     */
    addMarkdown() {
        const text_str = this.toString();
        // Indices covered by an XEP-0372 mention, so we don't treat directive
        // characters inside a mention as styling markers.
        const mention_idx = new Set();
        this.mentions.forEach((m) => {
            for (let k = Number(m.begin); k < Number(m.end); k++) mention_idx.add(k);
        });
        // As with addStyling, pre-detect URLs so directive characters inside
        // them aren't mistaken for styling markers.
        const url_ranges = getURLRanges(text_str);

        const references = [];
        let i = 0;
        while (i < this.length) {
            if (mention_idx.has(i)) {
                i++;
                continue;
            }
            if (inAnyRange(url_ranges, i)) {
                i++;
                continue;
            }

            if (i === 0 || this[i - 1] === '\n') {
                // Block-level constructs are only valid at the start of a line.
                // Fenced code blocks and quotes (`` ``` `` / `>`) are consumed by
                // the inline directive scanner below, which means their interior
                // lines are never reached here — so block markers inside them are
                // correctly left alone.
                const heading = parseHeading(text_str, i);
                if (heading) {
                    const txt = this.slice(heading.contentStart, heading.contentEnd);
                    references.push({
                        begin: i,
                        end: heading.end,
                        template: tplMarkdownHeading(heading.level, txt, heading.contentStart, this.options),
                    });
                    i = heading.end;
                    continue;
                }
                const table = parseTable(text_str, i);
                if (table) {
                    references.push({
                        begin: i,
                        end: table.end,
                        template: tplMarkdownTable(table.header, table.aligns, table.rows, this.options),
                    });
                    i = table.end;
                    continue;
                }
                const list = parseList(text_str, i);
                if (list) {
                    references.push({
                        begin: i,
                        end: list.end,
                        template: tplMarkdownList(list, this.slice.bind(this), this.options),
                    });
                    i = list.end;
                    continue;
                }
            }

            // Markdown [label](url) links. Rendered only when the URL scheme
            // is approved (http/https/xmpp/mailto), so `[x](javascript:…)`
            // falls through to plain text.
            if (this[i] === '[') {
                const link = parseLink(text_str, i);
                const uri = link && safeLinkURI(link.url);
                if (uri) {
                    const label = this.slice(link.labelStart, link.labelEnd);
                    references.push({
                        begin: i,
                        end: link.end,
                        template: tplMarkdownLink(uri, label, link.labelStart, this.options),
                    });
                    i = link.end;
                    continue;
                }
                i++;
                continue;
            }

            // Inline emphasis follows Markdown semantics (`**`/`__` strong,
            // single `*`/`_` emphasis, `~~`/`~` strike) rather than XEP-0393's
            // single-`*`-is-bold rule.
            const ch = this[i];
            if (ch === '*' || ch === '_' || ch === '~') {
                const emph = parseEmphasis(text_str, i);
                if (emph) {
                    const inner = this.slice(emph.contentStart, emph.contentEnd);
                    references.push({
                        begin: i,
                        end: emph.end,
                        template: markdown_templates[emph.kind](inner, emph.contentStart, this.options),
                    });
                    i = emph.end;
                    continue;
                }
                i++;
                continue;
            }

            // Everything else still comes from the XEP-0393 directive scanner:
            // code spans/blocks (`` ` ``, ``` ``` ```) and quotes (`>`).
            const { d, length } = getDirectiveAndLength(this, i);
            if (d && length) {
                const is_quote = isQuoteDirective(d);
                const end = i + length;
                const slice_end = is_quote ? end : end - d.length;
                let slice_begin = d === '```' ? i + d.length + 1 : i + d.length;
                if (is_quote && this[slice_begin] === ' ') {
                    slice_begin += 1;
                }
                const offset = slice_begin;
                const text = this.slice(slice_begin, slice_end);
                references.push({
                    begin: i,
                    template: getMarkdownDirectiveTemplate(d, text, offset, this.options),
                    end,
                });
                i = end;
            }
            i++;
        }
        references.forEach((ref) => this.addTemplateResult(ref.begin, ref.end, ref.template));
    }

    trimMeMessage() {
        if (this.offset === 0) {
            // Subtract `/me ` from 3rd person messages
            if (this.isMeCommand()) {
                this.payload[0] = this.payload[0].substring(4);
            }
        }
    }

    /**
     * Look for plaintext (i.e. non-templated) sections of this Texture
     * instance and add references via the passed in function.
     * @param {Function} func
     */
    async addAnnotations(func) {
        const payload = this.marshall();
        let idx = 0; // The text index of the element in the payload
        for (const text of payload) {
            if (!text) {
                continue;
            } else if (isString(text)) {
                await func.call(this, text, idx);
                idx += text.length;
            } else {
                idx = text.end;
            }
        }
    }

    /**
     * Parse the text and add template references for rendering the "rich" parts.
     **/
    async addTemplates() {
        /**
         * Synchronous event which provides a hook for transforming a chat message's body text
         * before the default transformations have been applied.
         * @event _converse#beforeMessageBodyTransformed
         * @param {Texture} text - A {@link Texture } instance. You
         *  can call {@link Texture#addTemplateResult } on it in order to
         *  add TemplateResult objects meant to render rich parts of the message.
         * @example _converse.api.listen.on('beforeMessageBodyTransformed', (texture) => { ... });
         */
        await api.trigger('beforeMessageBodyTransformed', this, { synchronous: true });

        if (this.render_markdown) this.addMarkdown();
        else if (this.render_styling) this.addStyling();

        await this.addAnnotations(this.addMentions);
        await this.addAnnotations(this.addHyperlinks);
        await this.addAnnotations(this.addMapURLs);

        if (api.emojis) {
            await api.emojis.initialize();
            await this.addAnnotations(this.addEmojis);
        }

        /**
         * Synchronous event which provides a hook for transforming a chat message's body text
         * after the default transformations have been applied.
         * @event _converse#afterMessageBodyTransformed
         * @param { Texture } text - A {@link Texture } instance. You
         *  can call {@link Texture#addTemplateResult} on it in order to
         *  add TemplateResult objects meant to render rich parts of the message.
         * @example _converse.api.listen.on('afterMessageBodyTransformed', (texture) => { ... });
         */
        await api.trigger('afterMessageBodyTransformed', this, { synchronous: true });

        this.payload = this.marshall();
        if (this.options.show_me_message) this.trimMeMessage();
        this.payload = this.payload.map((item) => (isString(item) ? item : item.template));
    }

    /**
     * The "rich" markup parts of a chat message are represented by lit
     * TemplateResult objects.
     *
     * This method can be used to add new template results to this message's
     * text.
     *
     * @method Texture.addTemplateResult
     * @param {Number} begin - The starting index of the plain message text
     * which is being replaced with markup.
     * @param {Number} end - The ending index of the plain message text
     * which is being replaced with markup.
     * @param {Object} template - The lit TemplateResult instance
     */
    addTemplateResult(begin, end, template) {
        this.references.push({ begin, end, template });
    }

    isMeCommand() {
        const text = this.toString();
        if (!text) {
            return false;
        }
        return text.startsWith('/me ');
    }

    /**
     * Take the annotations and return an array of text and TemplateResult
     * instances to be rendered to the DOM.
     * @method Texture#marshall
     */
    marshall() {
        let list = [this.toString()];
        this.references
            .sort((a, b) => b.begin - a.begin)
            .forEach((ref) => {
                const text = list.shift();
                list = [text.slice(0, ref.begin), ref, text.slice(ref.end), ...list];
            });
        return list.reduce(
            (acc, i) => (isString(i) ? [...acc, u.emojis.convertASCII2Emoji(collapseLineBreaks(i))] : [...acc, i]),
            [],
        );
    }
}

// Kept here to avoid circular dependencies
class StylingDirective extends Directive {
    /**
     * @param {Texture} t
     */
    static async transform(t) {
        try {
            await t.addTemplates();
        } catch (e) {
            console.error(e);
        }
        return t.payload;
    }

    /**
     * @param {string} txt
     * @param {number} offset
     * @param {object} options
     */
    render(txt, offset, options) {
        const t = new Texture(
            txt,
            offset,
            Object.assign(options, { 'show_images': false, 'embed_videos': false, 'embed_audio': false }),
        );
        return html`${until(StylingDirective.transform(t), html`${t}`)}`;
    }
}

const renderStyling = directive(StylingDirective);

// Kept here (like StylingDirective) to avoid circular dependencies
class MarkdownDirective extends Directive {
    /**
     * @param {Texture} t
     */
    static async transform(t) {
        try {
            await t.addTemplates();
        } catch (e) {
            console.error(e);
        }
        return t.payload;
    }

    /**
     * @param {string} txt
     * @param {number} offset
     * @param {object} options
     */
    render(txt, offset, options) {
        const t = new Texture(
            txt,
            offset,
            Object.assign({}, options, {
                'render_markdown': true,
                'render_styling': false,
                'show_images': false,
                'embed_videos': false,
                'embed_audio': false,
            }),
        );
        return html`${until(MarkdownDirective.transform(t), html`${t}`)}`;
    }
}

const renderMarkdown = directive(MarkdownDirective);

// prettier-ignore
/* eslint-disable max-len */
const styling_templates = {
    // m is the chatbox model
    // i is the offset of this directive relative to the start of the original message
    emphasis: /** @param {string} txt @param {number} i @param {object} options */ (txt, i, options) => html`<span class="styling-directive">_</span><i>${renderStyling(txt, i, options)}</i><span class="styling-directive">_</span>`,
    preformatted: /** @param {string} txt */ (txt) => html`<span class="styling-directive">\`</span><code>${txt}</code><span class="styling-directive">\`</span>`,
    preformatted_block: /** @param {string} txt */ (txt) => html`<div class="styling-directive">\`\`\`</div><pre><code class="block">${txt}</code></pre><div class="styling-directive">\`\`\`</div>`,
    quote: /** @param {string} txt @param {number} i @param {object} options */ (txt, i, options) => html`<blockquote>${renderStyling(txt, i, options)}</blockquote>`,
    strike: /** @param {string} txt @param {number} i @param {object} options */ (txt, i, options) => html`<span class="styling-directive">~</span><del>${renderStyling(txt, i, options)}</del><span class="styling-directive">~</span>`,
    strong: /** @param {string} txt @param {number} i @param {object} options */ (txt, i, options) => html`<span class="styling-directive">*</span><b>${renderStyling(txt, i, options)}</b><span class="styling-directive">*</span>`,
};

/**
 * @param {string} d
 * @param {string} text
 * @param {number} offset
 * @param {object} options
 */
export function getDirectiveTemplate(d, text, offset, options) {
    const template = styling_templates[/** @type {{name: string, type: string}} */ (styling_map[d]).name];
    if (isQuoteDirective(d)) {
        const newtext = text
            // Don't show the directive itself
            // This big [] corresponds to \s without newlines, to avoid issues when the > is the last character of the line
            .replace(
                /\n\u200B*>[ \f\r\t\v\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]?/g,
                (m) => `\n${'\u200B'.repeat(m.length - 1)}`,
            )
            .replace(/\n$/, ''); // Trim line-break at the end
        return template(newtext, offset, options);
    } else {
        return template(text, offset, options);
    }
}

// prettier-ignore
/* eslint-disable max-len */
// Markdown variants of the inline directives: same constructs as XEP-0393, but
// the literal directive characters are removed from the rendered output.
const markdown_templates = {
    emphasis: /** @param {string} txt @param {number} i @param {object} options */ (txt, i, options) => html`<em>${renderMarkdown(txt, i, options)}</em>`,
    preformatted: /** @param {string} txt */ (txt) => html`<code>${txt}</code>`,
    preformatted_block: /** @param {string} txt */ (txt) => html`<pre><code class="block">${txt}</code></pre>`,
    quote: /** @param {string} txt @param {number} i @param {object} options */ (txt, i, options) => html`<blockquote>${renderMarkdown(txt, i, options)}</blockquote>`,
    strike: /** @param {string} txt @param {number} i @param {object} options */ (txt, i, options) => html`<del>${renderMarkdown(txt, i, options)}</del>`,
    strong: /** @param {string} txt @param {number} i @param {object} options */ (txt, i, options) => html`<strong>${renderMarkdown(txt, i, options)}</strong>`,
};
/* eslint-enable max-len */

/**
 * Like {@link getDirectiveTemplate}, but renders the inline directive without
 * its literal marker characters (the "formatted"/Markdown view).
 * @param {string} d
 * @param {string} text
 * @param {number} offset
 * @param {object} options
 */
export function getMarkdownDirectiveTemplate(d, text, offset, options) {
    const template = markdown_templates[/** @type {{name: string}} */ (styling_map[d]).name];
    if (isQuoteDirective(d)) {
        const newtext = text
            .replace(
                /\n\u200B*>[ \f\r\t\v\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]?/g,
                (m) => `\n${'\u200B'.repeat(m.length - 1)}`,
            )
            .replace(/\n$/, '');
        return template(newtext, offset, options);
    }
    return template(text, offset, options);
}

/**
 * Whether index `i` falls within any of the given `[start, end)` ranges.
 * @param {Array<[number, number]>} ranges
 * @param {number} i
 * @returns {boolean}
 */
function inAnyRange(ranges, i) {
    return ranges.some(([start, end]) => i >= start && i < end);
}

const APPROVED_MARKDOWN_LINK_PROTOCOLS = ['http:', 'https:', 'xmpp:', 'mailto:'];

/**
 * Validate a Markdown link URL and return its parsed {@link URL} if the scheme
 * is approved, otherwise `null` (so it won't be turned into a link).
 * @param {string} url
 * @returns {URL|null}
 */
function safeLinkURI(url) {
    const http_url = (/^w{3}\./i).test(url) ? `http://${url}` : url;
    try {
        const uri = u.getURL(http_url);
        return APPROVED_MARKDOWN_LINK_PROTOCOLS.includes(uri.protocol) ? uri : null;
    } catch {
        return null;
    }
}

/**
 * @param {URL} uri
 * @param {string} label
 * @param {number} offset
 * @param {object} options
 */
function tplMarkdownLink(uri, label, offset, options) {
    return html`<a target="_blank" rel="noopener" href="${uri.href}">${renderMarkdown(label, offset, options)}</a>`;
}

const markdown_headings = {
    1: /** @param {any} c */ (c) => html`<h1 class="chat-msg__md-heading">${c}</h1>`,
    2: /** @param {any} c */ (c) => html`<h2 class="chat-msg__md-heading">${c}</h2>`,
    3: /** @param {any} c */ (c) => html`<h3 class="chat-msg__md-heading">${c}</h3>`,
    4: /** @param {any} c */ (c) => html`<h4 class="chat-msg__md-heading">${c}</h4>`,
    5: /** @param {any} c */ (c) => html`<h5 class="chat-msg__md-heading">${c}</h5>`,
    6: /** @param {any} c */ (c) => html`<h6 class="chat-msg__md-heading">${c}</h6>`,
};

/**
 * @param {number} level
 * @param {string} txt
 * @param {number} offset
 * @param {object} options
 */
function tplMarkdownHeading(level, txt, offset, options) {
    return (markdown_headings[level] ?? markdown_headings[6])(renderMarkdown(txt, offset, options));
}

/**
 * Render a (possibly nested) Markdown list. Each item's content is sliced from
 * the original text via `slice` and run through the Markdown pass; nested
 * sub-lists recurse.
 * @param {import('./markdown').ListMatch} node
 * @param {(begin: number, end: number) => string} slice
 * @param {object} options
 * @returns {import('lit').TemplateResult}
 */
function tplMarkdownList(node, slice, options) {
    const lis = node.items.map((it) => {
        const nested = it.children.map((child) => tplMarkdownList(child, slice, options));
        return html`<li>${renderMarkdown(slice(it.begin, it.end), it.begin, options)}${nested}</li>`;
    });
    return node.ordered
        ? html`<ol class="chat-msg__md-list" start="${node.start}">${lis}</ol>`
        : html`<ul class="chat-msg__md-list">${lis}</ul>`;
}

/**
 * @param {'th'|'td'} tag
 * @param {import('./markdown').TableCell} cell
 * @param {'left'|'center'|'right'|null} align
 * @param {object} options
 */
function tplMarkdownCell(tag, cell, align, options) {
    const style = align ? `text-align:${align}` : undefined;
    const content = renderMarkdown(cell.text, cell.offset, options);
    return tag === 'th'
        ? html`<th style="${ifDefined(style)}">${content}</th>`
        : html`<td style="${ifDefined(style)}">${content}</td>`;
}

/**
 * @param {import('./markdown').TableCell[]} header
 * @param {Array<'left'|'center'|'right'|null>} aligns
 * @param {import('./markdown').TableCell[][]} rows
 * @param {object} options
 */
function tplMarkdownTable(header, aligns, rows, options) {
    return html`<div class="chat-msg__md-table-wrap">
        <table class="chat-msg__md-table">
            <thead>
                <tr>
                    ${header.map((c, idx) => tplMarkdownCell('th', c, aligns[idx], options))}
                </tr>
            </thead>
            <tbody>
                ${rows.map(
                    (r) => html`<tr>
                        ${r.map((c, idx) => tplMarkdownCell('td', c, aligns[idx], options))}
                    </tr>`,
                )}
            </tbody>
        </table>
    </div>`;
}
