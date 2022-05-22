// Copyright (c) 2019-2020 Jonathan Wood (www.softcircuits.com)
// Copyright (c) 2020 Ronald M. Clifford
// Licensed under the MIT license.

/**
 * @typedef {import("./types/index").ConjunctionType} ConjunctionType
 * @typedef {import("./types/index").INode} INode
 * @typedef {import("./types/index").TermForm} TermForm
 */

const InternalNode = require("./internalNode"),
    ParsingHelper = require("./parsingHelper"),
    StandardStopWords = require("./standardStopWords"),
    TerminalNode = require("./terminalNode"),

    andRegex = /^and$/i,
    nearRegex = /^near$/i,
    notRegex = /^not$/i,
    orRegex = /^or$/i;

/**
 * @type {string} Characters not allowed in unquoted search terms.
 */
const punctuation = "~\"`!@#$%^&*()-+=[]{}\\|;:,.<>?/";

/**
 * Class to convert user-friendly search term to SQL Server full-text search syntax.  Supports a Google-like syntax as described in the remarks.  No exceptions are thrown for badly formed input.  The code simply constructs the best query it can.
 * @example <caption>The following list shows how various syntaxes are interpreted.</caption>
 * abc                     Find inflectional forms of abc
 * ~abc                    Find thesaurus variations of abc
 * "abc"                   Find exact term abc
 * +abc                    Find exact term abc
 * "abc" near "def"        Find exact term abc near exact term def
 * abc*                    Finds words that start with abc
 * -abc def                Find inflectional forms of def but not inflectional forms of abc
 * abc def                 Find inflectional forms of both abc and def
 * abc or def              Find inflectional forms of either abc or def
 * <+abc +def>             Find exact term abc near exact term def
 * abc and (def or ghi)    Find inflectional forms of both abc and either def or ghi
 */
class FTSQuery {
    /**
     * Constructs an ftsQuery instance.
     * @param {boolean} [addStandardStopWords] If true, the standard list of stopwords are added to the stopword list.
     */
    constructor(addStandardStopWords) {
        /**
         * @type {string[]} Collection of stop words.  These words will not be included in the resulting query unless quoted.
         */
        this.stopWords = [];

        if (addStandardStopWords) {
            for (const word of StandardStopWords.StopWords) {
                this.stopWords.push(word);
            }
        }
    }

    /**
     * Determines if the given word has been identified as a stop word.
     * @param {string} word Word to test.
     * @returns {boolean} A boolean indicating if the word is a stop word.
     */
    isStopWord(word) {
        return this.stopWords.indexOf(word) !== -1;
    }

    /**
     * Converts a search expression to a valid SQL Server full-text search condition.
     *
     * This method takes a search query and converts it to a correctly formed full text search condition that can be passed to SQL Server constructs like CONTAINSTABLE.
     *
     * If the query contains invalid terms, the code will do what it can to return a valid search condition.  If no valid terms were found, this method returns an empty string.
     * @summary Converts a search expression to a valid SQL Server full-text search condition.
     * @param {string} query Search term to be converted.
     * @returns {string} A valid full-text search query condition or an empty string if a valid condition was not possible.
     */
    transform(query) {
        let node = this.parseNode(query, "And");

        node = this.fixUpExpressionTree(node, true);

        return node ? node.toString() : "";
    }

    /**
     * Parses a query segment and converts it to an expression tree.
     * @param {string} query Query segment to be converted.
     * @param {ConjunctionType} defaultConjunction Implicit conjunction type.
     * @returns {INode} Root node of expression tree
     */
    parseNode(query, defaultConjunction) {
        let conjunction = defaultConjunction,
            termExclude = false,
            resetState = true;

        /** @type {TermForm} */
        let termForm = "Inflectional";

        /** @type {INode} */
        let root;

        /** @type {INode} */
        let node;

        /** @type {string} */
        let term;

        const parser = new ParsingHelper(query);

        while (!parser.EndOfText) {
            if (resetState) {
                // Reset modifiers
                conjunction = defaultConjunction;
                termForm = "Inflectional";
                termExclude = false;
                resetState = false;
            }

            parser.skipWhitespace();
            if (parser.EndOfText) {
                break;
            }

            const ch = parser.peek();

            if (punctuation.indexOf(ch) === -1) {
                // Parse this query term
                term = parser.parseWhile((c) => punctuation.indexOf(c) === -1 && [" ", "\t", "\n", "\r"].indexOf(c) === -1);

                // Allow trailing wildcard
                if (parser.peek() === "*") {
                    term += parser.peek();
                    parser.moveAhead();
                    termForm = "Literal";
                }

                // Interpret term
                if (andRegex.test(term)) {
                    conjunction = "And";
                } else if (orRegex.test(term)) {
                    conjunction = "Or";
                } else if (nearRegex.test(term)) {
                    conjunction = "Near";
                } else if (notRegex.test(term)) {
                    termExclude = true;
                } else {
                    root = this.addNodeByString(root, term, termForm, termExclude, conjunction);
                    resetState = true;
                }
            } else {
                switch (ch) {
                    case "\"":
                    case "'":
                        termForm = "Literal";
                        parser.moveAhead();
                        term = parser.parseWhile((c) => c !== ch);
                        root = this.addNodeByString(root, term.trim(), termForm, termExclude, conjunction);
                        resetState = true;
                        break;
                    case "(":
                        // Parse parentheses block
                        term = this.extractBlock(parser, "(", ")");
                        node = this.parseNode(term, defaultConjunction);
                        root = this.addNode(root, node, conjunction, true);
                        resetState = true;
                        break;
                    case "<":
                        // Parse angle brackets block
                        term = this.extractBlock(parser, "<", ">");
                        node = this.parseNode(term, "Near");
                        root = this.addNode(root, node, conjunction);
                        resetState = true;
                        break;
                    case "-":
                        // Match when next term is not present
                        termExclude = true;
                        break;
                    case "+":
                        // Match next term exactly
                        termForm = "Literal";
                        break;
                    case "~":
                        // Match synonyms of next term
                        termForm = "Thesaurus";
                        break;
                    default:
                        break;
                }

                parser.moveAhead();
            }
        }

        return root;
    }


    /**
     * Fixes any portions of the expression tree that would produce an invalid SQL Server full-text query.
     * @example <caption>While our expression tree may be properly constructed, it may represent a query that is not supported by SQL Server.  This method traverses the expression tree and corrects problem expressions as described below.
     *
     * * This method converts all NEAR conjunctions to AND when either subexpression is not an InternalNode with the form TermForms.Literal.</caption>
     * NOT term1 AND term2         Subexpressions swapped.
     * NOT term1                   Expression discarded.
     * NOT term1 AND NOT term2     Expression discarded if node is grouped (parenthesized)
     *                             or is the root node; otherwise, the parent node may
     *                             contain another subexpression that will make this one
     *                             valid.
     * term1 OR NOT term2          Expression discarded.
     * term1 NEAR NOT term2        NEAR conjunction changed to AND. *
     * @param {INode} node Node to fix up
     * @param {boolean} [isRoot] True if node is the tree's root node
     * @returns {INode} The fixed up expression tree.
     */
    fixUpExpressionTree(node, isRoot) {
        if (!node) {
            return null;
        }

        if (node instanceof InternalNode) {
            // Fix up child nodes
            /** @type {InternalNode} */
            const internalNode = node;

            internalNode.leftChild = this.fixUpExpressionTree(internalNode.leftChild);
            internalNode.rightChild = this.fixUpExpressionTree(internalNode.rightChild);

            // Correct subexpressions incompatible with conjunction type
            if (internalNode.conjunction === "Near") {
                // If either subexpression is incompatible with NEAR conjunction then change to AND
                if (this.isInvalidWithNear(internalNode.leftChild) || this.isInvalidWithNear(internalNode.rightChild)) {
                    internalNode.conjunction = "And";
                }
            } else if (internalNode.conjunction === "Or") {
                // Eliminate subexpressions not valid with OR conjunction
                if (this.isInvalidWithOr(internalNode.leftChild)) {
                    internalNode.leftChild = null;
                }
                if (this.isInvalidWithOr(internalNode.rightChild)) {
                    internalNode.rightChild = null;
                }
            }

            // Handle eliminated child expressions
            if (!internalNode.leftChild && !internalNode.rightChild) {
                // Eliminate parent node if both child nodes were eliminated
                return null;
            } else if (!internalNode.leftChild) {
                // Child1 eliminated so return only Child2
                node = internalNode.rightChild;
            } else if (!internalNode.rightChild) { // eslint-disable-line no-negated-condition
                // Child2 eliminated so return only Child1
                node = internalNode.leftChild;
            } else {
                // Determine if entire expression is an exclude expression
                internalNode.exclude = internalNode.leftChild.exclude && internalNode.rightChild.exclude;
                // If only first child expression is an exclude expression,
                // then simply swap child expressions
                if (!internalNode.exclude && internalNode.leftChild.exclude) {
                    const temp = internalNode.leftChild;
                    internalNode.leftChild = internalNode.rightChild;
                    internalNode.rightChild = temp;
                }
            }
        }

        // Eliminate expression group if it contains only exclude expressions
        return (node.grouped || isRoot) && node.exclude ? null : node;
    }

    /**
     * Determines if the specified node is invalid on either side of a NEAR conjunction.
     * @param {INode} node Node to test
     * @returns {boolean} Whether the specified node is invalid.
     */
    isInvalidWithNear(node) {
        // NEAR is only valid with TerminalNodes with form TermForms.Literal
        return !(node instanceof TerminalNode) || node.termForm !== "Literal";
    }

    /**
     * Determines if the specified node is invalid on either side of an OR conjunction.
     * @param {INode} node Node to test
     * @returns {boolean} Whether the specified node is invalid.
     */
    isInvalidWithOr(node) {
        // OR is only valid with non-null, non-excluded (NOT) subexpressions
        return !node || node.exclude;
    }

    /**
     * Creates an expression node and adds it to the given tree.
     * @param {INode} root Root node of expression tree
     * @param {string} term Term for this node
     * @param {TermForm} termForm Indicates form of this term
     * @param {boolean} termExclude Indicates if this is an excluded term
     * @param {ConjunctionType} conjunction Conjunction used to join with other nodes
     * @returns {INode} The new root node
     */
    addNodeByString(root, term, termForm, termExclude, conjunction) {
        if (term.length > 0 && !this.isStopWord(term)) {
            const node = new TerminalNode();
            node.term = term;
            node.termForm = termForm;
            node.exclude = termExclude;
            root = this.addNode(root, node, conjunction);
        }
        return root;
    }

    /**
     * Adds an expression node to the given tree.
     * @param {INode} root Root node of expression tree
     * @param {INode} node Node to add
     * @param {ConjunctionType} conjunction Conjunction used to join with other nodes
     * @param {boolean} [group] Whether the node should be groupted
     * @returns {INode} The new root node.
     */
    addNode(root, node, conjunction, group) {
        if (node) {
            node.grouped = group;
            if (root) {
                const newRoot = new InternalNode();
                newRoot.leftChild = root;
                newRoot.rightChild = node;
                newRoot.conjunction = conjunction;
                root = newRoot;
            } else {
                root = node;
            }
        }

        return root;
    }

    /**
     * Extracts a block of text delimited by the specified open and close characters.  It is assumed the parser is positioned at an occurrence of the open character.  The open and closing characters are not included in the returned string.  On return, the parser is positioned at the closing character or at the end of the text if the closing character was not found.
     * @param {ParsingHelper} parser ParsingHelper object
     * @param {string} openChar Start-of-block delimiter
     * @param {string} closeChar End-of-block delimiter
     * @returns {string} The extracted text
     */
    extractBlock(parser, openChar, closeChar) {
        // Track delimiter depth
        let depth = 1;

        // Extract characters between delimiters
        parser.moveAhead();
        const start = parser.Index;
        while (!parser.EndOfText) {
            const ch = parser.peek();
            if (ch === openChar) {
                // Increase block depth
                depth++;
            } else if (ch === closeChar) {
                // Decrease block depth
                depth--;
                // Test for end of block
                if (depth === 0) {
                    break;
                }
            } else if (ch === "\"" || ch === "'") {
                // Don't count delimiters within quoted text
                parser.moveAhead();
                parser.skipWhile((c) => c !== ch);
            }
            // Move to next character
            parser.moveAhead();
        }
        return parser.extract(start, parser.Index);
    }
}

module.exports = FTSQuery;
