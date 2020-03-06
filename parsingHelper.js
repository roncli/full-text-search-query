// Copyright (c) 2019-2020 Jonathan Wood (www.softcircuits.com)
// Copyright (c) 2020 Ronald M. Clifford
// Licensed under the MIT license.

/**
 * @typedef {import("./types/index").Predicate} Predicate
 */

const nullChar = "\0";

/**
 * Helper class for parsing text.
 */
class ParsingHelper {
    /**
     * Constructs a TextParse instance.
     * @param {string} [text] Text to be parsed.
     */
    constructor(text) {
        /** @type {string} Returns the current text being parsed. */
        this.Text = void 0;

        /** @type {number} Returns the current position within the text being parsed. */
        this.Index = 0;

        this.reset(text);
    }

    /**
     * Sets the text to be parsed and resets the current position to the start of that text.
     * @param {string} text The text to be parsed.
     * @returns {void}
     */
    reset(text) {
        this.Text = text || "";
        this.Index = 0;
    }

    /**
     * Indicates if the current position is at the end of the text being parsed.
     * @returns {boolean} Whether the end of text has been reached.
     */
    get EndOfText() {
        return this.Index >= this.Text.length;
    }

    /**
     * Returns the character at the specified number of characters beyond the current position, or nullChar if the specified position is beyond the end of the text being parsed.
     * @param {number} [ahead] The number of characters beyond the current position.
     * @returns {string} The character at the specified position.
     */
    peek(ahead) {
        if (!ahead) {
            ahead = 0;
        }

        const pos = this.Index + ahead;

        return pos < this.Text.length ? this.Text.charAt(pos) : nullChar;
    }

    /**
     * Extracts a substring from the specified range of the text being parsed.
     * @param {number} start 0-based position of first character to extract.
     * @param {number} end 0-based position of the character that follows the last character to extract.
     * @returns {string} Returns the extracted string.
     */
    extract(start, end) {
        return this.Text.substr(start, end - start);
    }

    /**
     * Moves the current position ahead the specified number of characters.  The position will not be placed beyond the end of the text being parsed.
     * @param {number} [ahead] The number of characters to move ahead
     * @returns {void}
     */
    moveAhead(ahead) {
        if (ahead === void 0) {
            ahead = 1;
        }

        this.Index = Math.min(this.Index + ahead, this.Text.length);
    }

    /**
     * Moves the current position to the next character that is not a whitespace.
     * @returns {void}
     */
    skipWhitespace() {
        while ([" ", "\t", "\n", "\r"].indexOf(this.peek()) !== -1) {
            this.moveAhead();
        }
    }

    /**
     * Moves the current text position to the next character for which the given predicate returns false.
     * @param {Predicate} predicate Method that returns true if the character should be skipped.
     * @returns {void}
     */
    skipWhile(predicate) {
        while (predicate(this.peek()) && !this.EndOfText) {
            this.moveAhead();
        }
    }

    /**
     * Moves the current text position to the next character for which the given predicate returns false.  And returns a string with the characters that were skipped.
     * @param {Predicate} predicate Method that returns true if the character should be skipped.
     * @returns {string} A string with the characters that were skipped.
     */
    parseWhile(predicate) {
        const start = this.Index;
        while (predicate(this.peek()) && !this.EndOfText) {
            this.moveAhead();
        }

        return this.extract(start, this.Index);
    }
}

module.exports = ParsingHelper;
