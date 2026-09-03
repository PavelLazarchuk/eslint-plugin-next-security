export interface Position {
    line: number;
    column: number;
}

export interface SourceLocation {
    start: Position;
    end: Position;
}

export interface AstNode {
    type: string;
    loc?: SourceLocation | null;
    range?: [number, number];
    parent?: AstNode | null;
    [key: string]: unknown;
}

export type FunctionNode = AstNode;

export type ServerActionKind = 'file' | 'inline';

export interface ServerAction {
    node: FunctionNode;
    name: string | null;
    kind: ServerActionKind;
    exported: boolean;
    passedAsProp: boolean;
    wrapperCalls: AstNode[];
}
