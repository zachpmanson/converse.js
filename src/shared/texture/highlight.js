/**
 * @module shared/texture/highlight
 *
 * Thin wrapper around highlight.js. We import the ~30KB core and register only
 * a curated set of common languages (rather than the full ~900KB build), then
 * highlight fenced code blocks that carry a language annotation.
 */
import hljs from 'highlight.js/lib/core';
import DOMPurify from 'dompurify';

import bash from 'highlight.js/lib/languages/bash';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import css from 'highlight.js/lib/languages/css';
import diff from 'highlight.js/lib/languages/diff';
import go from 'highlight.js/lib/languages/go';
import ini from 'highlight.js/lib/languages/ini';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import kotlin from 'highlight.js/lib/languages/kotlin';
import lua from 'highlight.js/lib/languages/lua';
import markdown from 'highlight.js/lib/languages/markdown';
import php from 'highlight.js/lib/languages/php';
import python from 'highlight.js/lib/languages/python';
import ruby from 'highlight.js/lib/languages/ruby';
import rust from 'highlight.js/lib/languages/rust';
import scss from 'highlight.js/lib/languages/scss';
import shell from 'highlight.js/lib/languages/shell';
import sql from 'highlight.js/lib/languages/sql';
import swift from 'highlight.js/lib/languages/swift';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';

// registerLanguage also wires up each language's aliases (e.g. js, ts, py, sh).
const LANGUAGES = {
    bash,
    c,
    cpp,
    csharp,
    css,
    diff,
    go,
    ini,
    java,
    javascript,
    json,
    kotlin,
    lua,
    markdown,
    php,
    python,
    ruby,
    rust,
    scss,
    shell,
    sql,
    swift,
    typescript,
    xml,
    yaml,
};
for (const [name, lang] of Object.entries(LANGUAGES)) {
    hljs.registerLanguage(name, lang);
}

/**
 * Whether the given language annotation is one we can highlight.
 * @param {string} lang
 * @returns {boolean}
 */
export function canHighlight(lang) {
    return !!lang && !!hljs.getLanguage(lang);
}

/**
 * Syntax-highlight `code` as `lang`, returning sanitised HTML, or `null` if the
 * language isn't recognised or highlighting fails.
 * @param {string} code
 * @param {string} lang
 * @returns {string|null}
 */
export function highlightCode(code, lang) {
    if (!canHighlight(lang)) return null;
    try {
        const { value } = hljs.highlight(code, { language: lang, ignoreIllegals: true });
        // highlight.js already escapes the source; sanitise as defence-in-depth.
        return DOMPurify.sanitize(value);
    } catch (e) {
        console.error(e);
        return null;
    }
}
