/**
 * Attach a Lexical rich-text editor to `rootEl` and return a small handle.
 * @param {HTMLElement} rootEl - A `contenteditable` host element.
 * @param {object} [opts]
 * @param {() => void} [opts.onChange] - Called after each edit (e.g. to toggle a
 *      disabled Post button). Kept optional so the caller can avoid per-keystroke
 *      re-renders.
 * @returns {import('./types').SocialEditor}
 */
export function createSocialEditor(rootEl: HTMLElement, { onChange }?: {
    onChange?: () => void;
}): import("./types").SocialEditor;
//# sourceMappingURL=lexical-editor.d.ts.map