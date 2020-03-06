// Copyright (c) 2019-2020 Jonathan Wood (www.softcircuits.com)
// Copyright (c) 2020 Ronald M. Clifford
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
        this.leftChild = void 0;

        /** @type {INode} */
        this.rightChild = void 0;

        /** @type {ConjunctionType} */
        this.conjunction = void 0;
    }

    /**
     * @returns {string} The node represented as a string.
     */
    toString() {
        return `${this.grouped ? "(" : ""}${this.leftChild.toString()} ${this.conjunction ? `${this.conjunction.toUpperCase()} ` : ""}${this.rightChild.toString()}${this.grouped ? ")" : ""}`;
    }
}

module.exports = InternalNode;
