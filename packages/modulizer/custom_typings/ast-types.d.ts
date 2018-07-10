
declare module 'ast-types' {
import * as estree from 'estree';
import {Node} from 'estree';
  export interface NodePath<N = Node> {
    node: N;
    parent?: NodePath;

    get<NKey extends keyof N>(name: NKey): NodePath<N[NKey]>|undefined;

    canBeFirstInStatement(): boolean;
    firstInStatement(): boolean;

    insertAt(index: number, node: Node): this;

    /** Remove this node from the AST. */
    prune(): void;
    insertBefore(node: Node): this;
    insertAfter(node: Node): this;
    replace<R extends Node>(replacement: R): NodePath<R>[];

    /**
     * The value encapsulated by this Path, generally equal to
     * parentPath.value[name] if we have a parentPath.
     */
    value: N;

    /** The immediate parent Path of this Path. */
    parentPath: NodePath;

    /**
     * The name of the property of parentPath.value through which this Path's
     * value was reached.
     */
    name?: string;
  }

  interface VisitorContext {
    abort(): void;
    traverse(nodePath: NodePath): void;
  }

  interface Visitor {
    visitNode?(this: VisitorContext, path: NodePath<estree.Node>): void|boolean;
    visitProgram?
        (this: VisitorContext, path: NodePath<estree.Program>): void|boolean;
    visitEmptyStatement?
        (this: VisitorContext, path: NodePath<estree.EmptyStatement>):
            void|boolean;
    visitCallExpression?
        (this: VisitorContext, path: NodePath<estree.CallExpression>):
            void|boolean;
    visitBlockStatement?
        (this: VisitorContext, path: NodePath<estree.BlockStatement>):
            void|boolean;
    visitExpressionStatement?
        (this: VisitorContext, path: NodePath<estree.ExpressionStatement>):
            void|boolean;
    visitIfStatement?(this: VisitorContext, path: NodePath<estree.IfStatement>):
        void|boolean;
    visitLabeledStatement?
        (this: VisitorContext, path: NodePath<estree.LabeledStatement>):
            void|boolean;
    visitBreakStatement?
        (this: VisitorContext, path: NodePath<estree.BreakStatement>):
            void|boolean;
    visitContinueStatement?
        (this: VisitorContext, path: NodePath<estree.ContinueStatement>):
            void|boolean;
    visitWithStatement?
        (this: VisitorContext, path: NodePath<estree.WithStatement>):
            void|boolean;
    visitSwitchStatement?
        (this: VisitorContext, path: NodePath<estree.SwitchStatement>):
            void|boolean;
    visitReturnStatement?
        (this: VisitorContext, path: NodePath<estree.ReturnStatement>):
            void|boolean;
    visitThrowStatement?
        (this: VisitorContext, path: NodePath<estree.ThrowStatement>):
            void|boolean;
    visitTryStatement?
        (this: VisitorContext, path: NodePath<estree.TryStatement>):
            void|boolean;
    visitWhileStatement?
        (this: VisitorContext, path: NodePath<estree.WhileStatement>):
            void|boolean;
    visitDoWhileStatement?
        (this: VisitorContext, path: NodePath<estree.DoWhileStatement>):
            void|boolean;
    visitForStatement?
        (this: VisitorContext, path: NodePath<estree.ForStatement>):
            void|boolean;
    visitForInStatement?
        (this: VisitorContext, path: NodePath<estree.ForInStatement>):
            void|boolean;
    visitDebuggerStatement?
        (this: VisitorContext, path: NodePath<estree.DebuggerStatement>):
            void|boolean;
    visitFunctionDeclaration?
        (this: VisitorContext, path: NodePath<estree.FunctionDeclaration>):
            void|boolean;
    visitVariableDeclaration?
        (this: VisitorContext, path: NodePath<estree.VariableDeclaration>):
            void|boolean;
    visitVariableDeclarator?
        (this: VisitorContext, path: NodePath<estree.VariableDeclarator>):
            void|boolean;
    visitThisExpression?
        (this: VisitorContext, path: NodePath<estree.ThisExpression>):
            void|boolean;
    visitArrayExpression?
        (this: VisitorContext, path: NodePath<estree.ArrayExpression>):
            void|boolean;
    visitObjectExpression?
        (this: VisitorContext, path: NodePath<estree.ObjectExpression>):
            void|boolean;
    visitProperty?
        (this: VisitorContext, path: NodePath<estree.Property>): void|boolean;
    visitFunctionExpression?
        (this: VisitorContext, path: NodePath<estree.FunctionExpression>):
            void|boolean;
    visitSequenceExpression?
        (this: VisitorContext, path: NodePath<estree.SequenceExpression>):
            void|boolean;
    visitUnaryExpression?
        (this: VisitorContext, path: NodePath<estree.UnaryExpression>):
            void|boolean;
    visitBinaryExpression?
        (this: VisitorContext, path: NodePath<estree.BinaryExpression>):
            void|boolean;
    visitAssignmentExpression?
        (this: VisitorContext, path: NodePath<estree.AssignmentExpression>):
            void|boolean;
    visitUpdateExpression?
        (this: VisitorContext, path: NodePath<estree.UpdateExpression>):
            void|boolean;
    visitLogicalExpression?
        (this: VisitorContext, path: NodePath<estree.LogicalExpression>):
            void|boolean;
    visitConditionalExpression?
        (this: VisitorContext, path: NodePath<estree.ConditionalExpression>):
            void|boolean;
    visitSimpleCallExpression?
        (this: VisitorContext, path: NodePath<estree.SimpleCallExpression>):
            void|boolean;
    visitNewExpression?
        (this: VisitorContext, path: NodePath<estree.NewExpression>):
            void|boolean;
    visitMemberExpression?
        (this: VisitorContext, path: NodePath<estree.MemberExpression>):
            void|boolean;
    visitSwitchCase?
        (this: VisitorContext, path: NodePath<estree.SwitchCase>): void|boolean;
    visitCatchClause?(this: VisitorContext, path: NodePath<estree.CatchClause>):
        void|boolean;
    visitIdentifier?
        (this: VisitorContext, path: NodePath<estree.Identifier>): void|boolean;
    visitLiteral?(this: VisitorContext, path: NodePath<estree.SimpleLiteral>):
        void|boolean;
    visitForOfStatement?
        (this: VisitorContext, path: NodePath<estree.ForOfStatement>):
            void|boolean;
    visitSuper?
        (this: VisitorContext, path: NodePath<estree.Super>): void|boolean;
    visitSpreadElement?
        (this: VisitorContext, path: NodePath<estree.SpreadElement>):
            void|boolean;
    visitArrowFunctionExpression?
        (this: VisitorContext, path: NodePath<estree.ArrowFunctionExpression>):
            void|boolean;
    visitYieldExpression?
        (this: VisitorContext, path: NodePath<estree.YieldExpression>):
            void|boolean;
    visitTemplateLiteral?
        (this: VisitorContext, path: NodePath<estree.TemplateLiteral>):
            void|boolean;
    visitTaggedTemplateExpression?
        (this: VisitorContext, path: NodePath<estree.TaggedTemplateExpression>):
            void|boolean;
    visitTemplateElement?
        (this: VisitorContext, path: NodePath<estree.TemplateElement>):
            void|boolean;
    visitAssignmentProperty?
        (this: VisitorContext, path: NodePath<estree.AssignmentProperty>):
            void|boolean;
    visitObjectPattern?
        (this: VisitorContext, path: NodePath<estree.ObjectPattern>):
            void|boolean;
    visitArrayPattern?
        (this: VisitorContext, path: NodePath<estree.ArrayPattern>):
            void|boolean;
    visitRestElement?(this: VisitorContext, path: NodePath<estree.RestElement>):
        void|boolean;
    visitAssignmentPattern?
        (this: VisitorContext, path: NodePath<estree.AssignmentPattern>):
            void|boolean;
    visitClassBody?
        (this: VisitorContext, path: NodePath<estree.ClassBody>): void|boolean;
    visitMethodDefinition?
        (this: VisitorContext, path: NodePath<estree.MethodDefinition>):
            void|boolean;
    visitClassDeclaration?
        (this: VisitorContext, path: NodePath<estree.ClassDeclaration>):
            void|boolean;
    visitClassExpression?
        (this: VisitorContext, path: NodePath<estree.ClassExpression>):
            void|boolean;
    visitMetaProperty?
        (this: VisitorContext, path: NodePath<estree.MetaProperty>):
            void|boolean;
    visitImportDeclaration?
        (this: VisitorContext, path: NodePath<estree.ImportDeclaration>):
            void|boolean;
    visitImportSpecifier?
        (this: VisitorContext, path: NodePath<estree.ImportSpecifier>):
            void|boolean;
    visitImportDefaultSpecifier?
        (this: VisitorContext, path: NodePath<estree.ImportDefaultSpecifier>):
            void|boolean;
    visitImportNamespaceSpecifier?
        (this: VisitorContext, path: NodePath<estree.ImportNamespaceSpecifier>):
            void|boolean;
    visitExportNamedDeclaration?
        (this: VisitorContext, path: NodePath<estree.ExportNamedDeclaration>):
            void|boolean;
    visitExportSpecifier?
        (this: VisitorContext, path: NodePath<estree.ExportSpecifier>):
            void|boolean;
    visitExportDefaultDeclaration?
        (this: VisitorContext, path: NodePath<estree.ExportDefaultDeclaration>):
            void|boolean;
    visitExportAllDeclaration?
        (this: VisitorContext, path: NodePath<estree.ExportAllDeclaration>):
            void|boolean;
    visitAwaitExpression?
        (this: VisitorContext, path: NodePath<estree.AwaitExpression>):
            void|boolean;
  }

  export function visit(node: Node, visitor: Visitor): void;
}
