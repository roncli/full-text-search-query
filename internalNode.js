// Copyright (c) 2019-2021 Jonathan Wood (www.softcircuits.com)
// Copyright (c) 2020-2022 Ronald M. Clifford
// Licensed under the MIT license.

/**
 * @typedef {import("./types/index").ConjunctionType} ConjunctionType
 * @typedef {import("./types/index").INode} INode
 */

/**
 * Internal (non-leaf) expression node class.
 */
class InternalNode {
    /**
     * Constructor for InternalNode.
     */
    constructor() {
        this.exclude = false;
        this.grouped = false;

        /** @type {INode} */
        this.leftChild = null;

        /** @type {INode} */
        this.rightChild = null;

        /** @type {ConjunctionType} */
        this.conjunction = null;
    }

    /**
     * @returns {string} The node represented as a string.
     */
    toString() {
        if (!this.leftChild && !this.rightChild) {
            return "";
        }
        if (!this.leftChild) {
            return this.rightChild.toString();
        }
        if (!this.rightChild) {
            return this.leftChild.toString();
        }
        return `${this.grouped ? "(" : ""}${this.leftChild.toString()} ${this.conjunction ? `${this.conjunction.toUpperCase()} ` : ""}${this.rightChild.toString()}${this.grouped ? ")" : ""}`;
    }
}

module.exports = InternalNode;
