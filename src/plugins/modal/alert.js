import BaseModal from "plugins/modal/modal.js";
import tplAlertModal from "./templates/alert.js";
import { api } from "@converse/headless";


export default class Alert extends BaseModal {

    initialize () {
        super.initialize();
        this.addEventListener('converse-modal-closed', () => this.remove(), false);
    }

    renderModal () {
        return tplAlertModal(this.state.toJSON());
    }

    getModalTitle () {
        return this.state.get('title');
    }
}

api.elements.define('converse-alert-modal', Alert);
