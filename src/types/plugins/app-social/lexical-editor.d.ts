/**
 * Attach a Lexical rich-text editor to `rootEl` and return a small handle.
 * @param {HTMLElement} rootEl - A `contenteditable` host element.
 * @param {object} [opts]
 * @param {() => void} [opts.onChange] - Called after each edit (e.g. to toggle a
 *      disabled Post button). Kept optional so the caller can avoid per-keystroke
 *      re-renders.
 * @returns {{
 *   editor: import('lexical').LexicalEditor,
 *   getMarkdown: () => string,
 *   getHtml: () => string,
 *   isEmpty: () => boolean,
 *   insertText: (text: string) => void,
 *   format: (type: import('lexical').TextFormatType) => boolean,
 *   clear: () => void,
 *   focus: () => void,
 *   destroy: () => void,
 * }}
 */
export function createSocialEditor(rootEl: HTMLElement, { onChange }?: {
    onChange?: () => void;
}): {
    editor: import("lexical").LexicalEditor;
    getMarkdown: () => string;
    getHtml: () => string;
    isEmpty: () => boolean;
    insertText: (text: string) => void;
    format: (type: import("lexical").TextFormatType) => boolean;
    clear: () => void;
    focus: () => void;
    destroy: () => void;
};
//# sourceMappingURL=lexical-editor.d.ts.map