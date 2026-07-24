/**
 * @copyright 2025, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description A custom element to preview and manage files staged for upload
 */
import { api } from '@converse/headless';
import { CustomElement } from 'shared/components/element.js';
import { html, nothing } from 'lit';
import { __ } from 'i18n';

import './styles/file-upload-preview.scss';

/**
 * Displays the files currently staged on the chat model (via `stageFiles`),
 * letting the user review and remove them before pressing send. Image files
 * get a thumbnail; everything else gets a generic file icon.
 */
export default class FileUploadPreview extends CustomElement {
    static get properties() {
        return {
            model: { type: Object },
        };
    }

    constructor() {
        super();
        this.model = null;
        /** @type {Map<File, string>} */
        this.urls = new Map();
    }

    initialize() {
        this.listenTo(this.model, 'change:staged_files', () => this.requestUpdate());
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.revokeAll();
    }

    revokeAll() {
        for (const url of this.urls.values()) URL.revokeObjectURL(url);
        this.urls.clear();
    }

    /**
     * Lazily create (and cache) an object URL for previewing an image file.
     * @param {File} file
     * @returns {string}
     */
    getObjectURL(file) {
        if (!this.urls.has(file)) this.urls.set(file, URL.createObjectURL(file));
        return this.urls.get(file);
    }

    /**
     * Revoke object URLs for files that are no longer staged, to avoid leaks.
     * @param {File[]} files
     */
    pruneURLs(files) {
        for (const [file, url] of this.urls) {
            if (!files.includes(file)) {
                URL.revokeObjectURL(url);
                this.urls.delete(file);
            }
        }
    }

    /**
     * @param {number} bytes
     * @returns {string}
     */
    formatSize(bytes) {
        if (bytes < 1024) return `${bytes} B`;
        const units = ['KB', 'MB', 'GB'];
        let size = bytes / 1024;
        let i = 0;
        while (size >= 1024 && i < units.length - 1) {
            size /= 1024;
            i++;
        }
        return `${size.toFixed(1)} ${units[i]}`;
    }

    /**
     * @param {File} file
     * @param {number} index
     */
    renderFile(file, index) {
        const is_image = file.type.startsWith('image/');
        return html`<div class="file-upload-preview__item">
            ${is_image
                ? html`<img class="file-upload-preview__thumb" src=${this.getObjectURL(file)} alt=${file.name} />`
                : html`<div class="file-upload-preview__icon">
                      <converse-icon class="fa fa-file" size="1.5em"></converse-icon>
                  </div>`}
            <div class="file-upload-preview__meta">
                <span class="file-upload-preview__name" title=${file.name}>${file.name}</span>
                <span class="file-upload-preview__size">${this.formatSize(file.size)}</span>
            </div>
            <button
                type="button"
                class="file-upload-preview__remove"
                @click=${() => this.model.unstageFile(index)}
                title="${__('Remove file')}"
            >
                <converse-icon class="fa fa-times" size="1em"></converse-icon>
            </button>
        </div>`;
    }

    render() {
        const files = this.model.staged_files ?? [];
        this.pruneURLs(files);
        if (!files.length) return nothing;

        return html`<div class="file-upload-preview">
            ${files.map((file, index) => this.renderFile(file, index))}
        </div>`;
    }
}

api.elements.define('converse-file-upload-preview', FileUploadPreview);
