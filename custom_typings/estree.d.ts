// TODO(rictic): Upstream/merge with
// https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/estree/estree.d.ts

declare module 'estree' {
  interface BaseNode {
    // Every leaf interface that extends BaseNode must specify a type property.
    // The type property should be a string literal. For example, Identifier
    // has: `type: "Identifier"`
    leadingComments?: Comment[];
    trailingComments?: Comment[];
    loc?: SourceLocation;
  }
  export type Node = Identifier | Literal | Program | Function | SwitchCase |
      CatchClause | VariableDeclarator | Statement | Expression | Property |
      AssignmentProperty | Super | TemplateElement | SpreadElement | Pattern |
      ClassBody | ClassDeclaration | ClassExpression | MethodDefinition |
      ModuleDeclaration | ModuleSpecifier;
  export interface Comment { value: string; }
  export interface SourceLocation {
    source: string;
    start: Position;
    end: Position;
  }
  export interface Position {
    /** >= 1 */
    line: number;
    /** >= 0 */
    column: number;
  }
  export interface Identifier extends BaseNode {
    type: "Identifier";
    name: string;
  }
  // Literal extends expression?
  export interface Literal extends BaseNode, BaseExpression {
    type: 'Literal';
    value: string | boolean | number | RegExp;
    raw: string;
  }
  export interface RegExpLiteral extends Literal {
    regex: {pattern: string; flags: string;};
  }
  export interface Program extends BaseNode {
    type: 'Program';
    sourceType: string;  // "script" or "module"
    body: Statement[] | ModuleDeclaration[];
  }
  export type Function = FunctionDeclaration | FunctionExpression;
  interface BaseFunction extends BaseNode {
    id?: Identifier;
    params: Pattern[];
    body: BlockStatement;
    generator?: boolean;
  }
  export type Statement = ExpressionStatement | BlockStatement |
      EmptyStatement | DebuggerStatement | WithStatement | ReturnStatement |
      LabeledStatement | BreakStatement | ContinueStatement | IfStatement |
      SwitchStatement | ThrowStatement | TryStatement | WhileStatement |
      DoWhileStatement | ForStatement | ForInStatement | ForOfStatement |
      Declaration;
  interface BaseStatement extends BaseNode {}
  export interface ExpressionStatement extends BaseStatement {
    type: "ExpressionStatement";
    expression: Expression;
  }
  export interface BlockStatement extends BaseStatement {
    type: "BlockStatement";
    body: Statement[];
  }
  export interface EmptyStatement extends BaseStatement {
    type: "EmptyStatement";
  }
  export interface DebuggerStatement extends BaseStatement {
    type: "DebuggerStatement";
  }
  export interface WithStatement extends BaseStatement {
    type: "WithStatement";
    object: Expression;
    body: Statement;
  }

  export interface ReturnStatement extends BaseStatement {
    type: "ReturnStatement";
    argument?: Expression;
  }
  export interface LabeledStatement extends BaseStatement {
    type: "LabeledStatement";
    label: Identifier;
    body: Statement;
  }
  export interface BreakStatement extends BaseStatement {
    type: "BreakStatement";
    label?: Identifier;
  }
  export interface ContinueStatement extends BaseStatement {
    type: "ContinueStatement";
    label?: Identifier;
  }

  export interface IfStatement extends BaseStatement {
    type: "IfStatement";
    test: Expression;
    consequent: Statement;
    alternate?: Statement;
  }
  export interface SwitchStatement extends BaseStatement {
    type: "SwitchStatement";
    discriminant: Expression;
    cases: SwitchCase[];
  }
  export interface SwitchCase extends BaseNode {
    type: "SwitchCase";
    test?: Expression;
    consequent: Statement[];
  }

  export interface ThrowStatement extends BaseStatement {
    type: "ThrowStatement";
    argument: Expression;
  }
  export interface TryStatement extends BaseStatement {
    type: "TryStatement";
    block: BlockStatement;
    handler?: CatchClause;
    finalizer?: BlockStatement;
  }
  export interface CatchClause extends BaseNode {
    type: "CatchClause";
    param: Pattern;
    body: BlockStatement;
  }

  export interface WhileStatement extends BaseStatement {
    type: "WhileStatement";
    test: Expression;
    body: Statement;
  }
  export interface DoWhileStatement extends BaseStatement {
    type: "DoWhileStatement";
    body: Statement;
    test: Expression;
  }
  export interface ForStatement extends BaseStatement {
    type: "ForStatement";
    init?: VariableDeclaration | Expression;
    test?: Expression;
    update?: Expression;
    body: Statement;
  }
  interface ForXStatement extends BaseStatement {
    left: VariableDeclaration | Expression;
    right: Expression;
    body: Statement;
  }
  export interface ForInStatement extends ForXStatement {
    type: "ForInStatement";
  }
  export interface ForOfStatement extends ForXStatement {
    type: "ForOfStatement";
  }

  export type Declaration =
      FunctionDeclaration | VariableDeclaration | ClassDeclaration;
  interface BaseDeclaration extends BaseStatement {}
  export interface FunctionDeclaration extends BaseFunction, BaseDeclaration {
    type: "FunctionDeclaration";
    id: Identifier;
  }
  export interface VariableDeclaration extends BaseDeclaration {
    type: "VariableDeclaration";
    declarations: VariableDeclarator[];
    kind: "var" | "let" | "const";
  }
  export interface VariableDeclarator extends BaseNode {
    type: "VariableDeclarator";
    id: Pattern;
    init?: Expression;
  }

  type Expression = ThisExpression | ArrayExpression | ObjectExpression |
      FunctionExpression | ArrowFunctionExpression | YieldExpression | Literal |
      UnaryExpression | UpdateExpression | BinaryExpression |
      AssignmentExpression | LogicalExpression | MemberExpression |
      ConditionalExpression | CallExpression | NewExpression |
      SequenceExpression | TemplateLiteral | TaggedTemplateExpression |
      ClassExpression | MetaProperty | Identifier;
  export interface BaseExpression extends BaseNode {}
  export interface ThisExpression extends BaseExpression {
    type: "ThisExpression";
  }
  export interface ArrayExpression extends BaseExpression {
    type: "ArrayExpression";
    elements: (Expression | SpreadElement)[];
  }

  export interface ObjectExpression extends BaseExpression {
    type: "ObjectExpression";
    properties: Property[];
  }

  interface BaseProperty extends BaseNode {
    type: "Property";
    key: Expression;
    kind: "init" | "get" | "set";
    method: boolean;
    shorthand: boolean;
    computed: boolean;
  }
  export interface Property extends BaseProperty { value: Expression; }
  export interface FunctionExpression extends BaseFunction, BaseExpression {
    type: "FunctionExpression";
  }
  export interface ArrowFunctionExpression extends BaseExpression {
    type: "ArrowFunctionExpression";
    params: Pattern[];
    generator?: boolean;
    body: BlockStatement | Expression;
    expression: boolean;
  }
  export interface YieldExpression extends BaseExpression {
    type: "YieldExpression";
    argument?: Expression;
    delegate: boolean;
  }
  export interface Super extends BaseNode { type: "Super"; }


  export interface UnaryExpression extends BaseExpression {
    type: "UnaryExpression";
    operator: UnaryOperator;
    prefix: boolean;
    argument: Expression;
  }
  export type UnaryOperator =
      "-" | "+" | "!" | "~" | "typeof" | "void" | "delete";
  export interface UpdateExpression extends BaseExpression {
    type: "UpdateExpression";
    operator: UpdateOperator;
    argument: Expression;
    prefix: boolean;
  }
  export type UpdateOperator = "++" | "--";

  export interface BinaryExpression extends BaseExpression {
    type: "BinaryExpression";
    operator: BinaryOperator;
    left: Expression;
    right: Expression;
  }
  export type BinaryOperator = "==" | "!=" | "===" | "!==" | "<" | "<=" | ">" |
      ">=" | "<<" | ">>" | ">>>" | "+" | "-" | "*" | "/" | "%" | "|" | "^" |
      "&" | "in" | "instanceof";
  export interface AssignmentExpression extends BaseExpression {
    type: "AssignmentExpression";
    operator: AssignmentOperator;
    left: Pattern | MemberExpression;
    right: Expression;
  }
  export type AssignmentOperator = "=" | "+=" | "-=" | "*=" | "/=" | "%=" |
      "<<=" | ">>=" | ">>>=" | "|=" | "^=" | "&=";
  export interface LogicalExpression extends BaseExpression {
    type: "LogicalExpression";
    operator: LogicalOperator;
    left: Expression;
    right: Expression;
  }
  export type LogicalOperator = "||" | "&&";

  export interface MemberExpression extends BaseExpression, BasePattern {
    type: "MemberExpression";
    object: Expression | Super;
    property: Expression;
    computed: boolean;
  }
  export interface ConditionalExpression extends BaseExpression {
    type: "ConditionalExpression";
    test: Expression;
    alternate: Expression;
    consequent: Expression;
  }
  interface BaseCallExpression extends BaseExpression {
    callee: Expression | Super;
    arguments: (Expression | SpreadElement)[];
  }
  export interface CallExpression extends BaseCallExpression {
    type: "CallExpression";
  }
  export interface NewExpression extends BaseCallExpression {
    type: "NewExpression";
  }
  export interface SequenceExpression extends BaseExpression {
    type: "SequenceExpression";
    expressions: Expression[];
  }

  export interface TemplateLiteral extends BaseExpression {
    type: "TemplateLiteral";
    quasis: TemplateElement[];
    expressions: Expression[];
  }
  export interface TaggedTemplateExpression extends BaseExpression {
    type: "TaggedTemplateExpression";
    tag: Expression;
    quasi: TemplateLiteral;
  }
  export interface TemplateElement extends BaseNode {
    type: "TemplateElement";
    tail: boolean;
    value: {cooked: string; raw: string;};
  }

  export interface SpreadElement extends BaseNode {
    type: "SpreadElement";
    argument: Expression;
  }

  type Pattern = ObjectPattern | ArrayPattern | RestElement |
      AssignmentPattern | MemberExpression;
  export interface BasePattern extends BaseNode {}
  export interface AssignmentProperty extends BaseProperty {
    value: Pattern;
    kind: "init";
    // method: false;
  }

  export interface ObjectPattern extends BasePattern {
    type: "ObjectPattern";
    properties: AssignmentProperty[];
  }

  export interface ArrayPattern extends BasePattern {
    type: "ArrayPattern";
    elements: Pattern[];
  }
  export interface RestElement extends BasePattern {
    type: "RestElement";
    argument: Pattern;
  }
  export interface AssignmentPattern extends BasePattern {
    type: "AssignmentPattern";
    left: Pattern;
    right: Expression;
  }

  export interface Class extends BaseNode {
    // type ???
    id?: Identifier;
    superClass?: Expression;
    body: ClassBody;
  }
  export interface ClassBody extends BaseNode {
    type: "ClassBody";
    body: MethodDefinition[];
  }
  export interface MethodDefinition extends BaseNode {
    type: "MethodDefinition";
    key: Expression;
    value: FunctionExpression;
    kind: "constructor" | "method" | "get" | "set";
    computed: boolean;
    static: boolean;
  }
  export interface ClassDeclaration extends Class, BaseDeclaration {
    type: "ClassDeclaration";
    id: Identifier;
  }
  export interface ClassExpression extends Class, BaseExpression {
    type: "ClassExpression";
  }
  export interface MetaProperty extends BaseExpression {
    type: "MetaProperty";
    meta: Identifier;
    property: Identifier;
  }

  export type ModuleDeclaration = ImportDeclaration | ExportNamedDeclaration |
      ExportDefaultDeclaration | ExportAllDeclaration;
  interface BaseModuleDeclaration extends BaseNode {}
  export type ModuleSpecifier = ImportSpecifier | ImportDefaultSpecifier |
      ImportNamespaceSpecifier | ExportSpecifier;
  interface BaseModuleSpecifier extends BaseNode {
    local: Identifier;
  }

  export interface ImportDeclaration extends BaseModuleDeclaration {
    type: "ImportDeclaration";
    specifiers:
        (ImportSpecifier | ImportDefaultSpecifier | ImportNamespaceSpecifier)[];
    source: Literal;
  }
  export interface ImportSpecifier extends BaseModuleSpecifier {
    type: "ImportSpecifier";
    imported: Identifier;
  }
  export interface ImportDefaultSpecifier extends BaseModuleSpecifier {
    type: "ImportDefaultSpecifier";
  }
  export interface ImportNamespaceSpecifier extends BaseModuleSpecifier {
    type: "ImportNamespaceSpecifier";
  }
  export interface ExportNamedDeclaration extends BaseModuleDeclaration {
    type: "ExportNamedDeclaration";
    declaration?: Declaration;
    specifiers: ExportSpecifier[];
    source?: Literal;
  }
  export interface ExportSpecifier extends BaseModuleSpecifier {
    type: "ExportSpecifier";
    exported: Identifier;
  }
  export interface ExportDefaultDeclaration extends BaseModuleDeclaration {
    type: "ExportDefaultDeclaration";
    declaration: Declaration | Expression;
  }
  export interface ExportAllDeclaration extends BaseModuleDeclaration {
    type: "ExportAllDeclaration";
    source: Literal;
  }
}
