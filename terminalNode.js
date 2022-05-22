// Copyright (c) 2019-2020 Jonathan Wood (www.softcircuits.com)
// Copyright (c) 2020 Ronald M. Clifford
// Licensed under the MIT license.

/**
 * @typedef {import("./types/index").INode} INode
 * @typedef {import("./types/index").TermForm} TermForm
 */

/**
 * Terminal (leaf) expression node class.
 */
class TerminalNode {
    /**
     * Constructor for TerminalNode.
     */
    constructor() {
        this.exclude = false;
        this.grouped = false;

        /** @type {string} */
        this.term = null;

        /** @type {TermForm} */
        this.termForm = null;
    }

    /**
     * @returns {string} The node represented as a string.
     */
    toString() {
        switch (this.termForm) {
            case "Inflectional":
                return `${this.exclude ? "NOT " : ""}FORMSOF(INFLECTIONAL, ${this.term})`;
            case "Thesaurus":
                return `${this.exclude ? "NOT " : ""}FORMSOF(THESAURUS, ${this.term})`;
            case "Literal":
                return `${this.exclude ? "NOT " : ""}"${this.term}"`;
            default:
                return "";
        }
    }
}

module.exports = TerminalNode;
