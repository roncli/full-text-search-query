// Copyright (c) 2019-2020 Jonathan Wood (www.softcircuits.com)
// Copyright (c) 2020 Ronald M. Clifford
// Licensed under the MIT license.

declare namespace Index {
    type ConjunctionType = "And" | "Or" | "Near"

    type Predicate = (string) => boolean

    type TermForm = "Inflectional" | "Thesaurus" | "Literal"

    interface INode {
        exclude: boolean
        grouped: boolean
        toString(): string
    }

    class InternalNode implements INode {
        exclude: boolean
        grouped: boolean

        leftChild: INode
        rightChild: INode
        conjunction: ConjunctionType

        toString(): string
    }

    class TerminalNode implements INode {
        exclude: boolean
        grouped: boolean

        term: string
        termForm: TermForm

        toString(): string
    }
}

export = Index
