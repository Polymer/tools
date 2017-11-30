import * as babel from 'babel-types';
import {VisitorOption} from './estraverse-shim';

export type VisitResult = VisitorOption|void|null|undefined;

export interface Visitor {
  enter?: (node: babel.Node, parent: babel.Node) => VisitResult;
  leave?: (node: babel.Node, parent: babel.Node) => VisitResult;
  // TODO(usergenic): What is this fallback?  Look it up.  It's used in
  // javascript-document.ts for example.
  fallback?: 'iteration';
  enterIdentifier?: (node: babel.Identifier, parent: babel.Node) => VisitResult;
  leaveIdentifier?: (node: babel.Identifier, parent: babel.Node) => VisitResult;

  enterLiteral?: (node: babel.Literal, parent: babel.Node) => VisitResult;
  leaveLiteral?: (node: babel.Literal, parent: babel.Node) => VisitResult;

  enterProgram?: (node: babel.Program, parent: babel.Node) => VisitResult;
  leaveProgram?: (node: babel.Program, parent: babel.Node) => VisitResult;

  enterExpressionStatement?:
      (node: babel.ExpressionStatement, parent: babel.Node) => VisitResult;
  leaveExpressionStatement?:
      (node: babel.ExpressionStatement, parent: babel.Node) => VisitResult;

  enterBlockStatement?:
      (node: babel.BlockStatement, parent: babel.Node) => VisitResult;
  leaveBlockStatement?:
      (node: babel.BlockStatement, parent: babel.Node) => VisitResult;

  enterEmptyStatement?:
      (node: babel.EmptyStatement, parent: babel.Node) => VisitResult;
  leaveEmptyStatement?:
      (node: babel.EmptyStatement, parent: babel.Node) => VisitResult;

  enterDebuggerStatement?:
      (node: babel.DebuggerStatement, parent: babel.Node) => VisitResult;
  leaveDebuggerStatement?:
      (node: babel.DebuggerStatement, parent: babel.Node) => VisitResult;

  enterWithStatement?:
      (node: babel.WithStatement, parent: babel.Node) => VisitResult;
  leaveWithStatement?:
      (node: babel.WithStatement, parent: babel.Node) => VisitResult;

  enterReturnStatement?:
      (node: babel.ReturnStatement, parent: babel.Node) => VisitResult;
  leaveReturnStatement?:
      (node: babel.ReturnStatement, parent: babel.Node) => VisitResult;

  enterLabeledStatement?:
      (node: babel.LabeledStatement, parent: babel.Node) => VisitResult;
  leaveLabeledStatement?:
      (node: babel.LabeledStatement, parent: babel.Node) => VisitResult;

  enterBreakStatement?:
      (node: babel.BreakStatement, parent: babel.Node) => VisitResult;
  leaveBreakStatement?:
      (node: babel.BreakStatement, parent: babel.Node) => VisitResult;

  enterContinueStatement?:
      (node: babel.ContinueStatement, parent: babel.Node) => VisitResult;
  leaveContinueStatement?:
      (node: babel.ContinueStatement, parent: babel.Node) => VisitResult;

  enterIfStatement?:
      (node: babel.IfStatement, parent: babel.Node) => VisitResult;
  leaveIfStatement?:
      (node: babel.IfStatement, parent: babel.Node) => VisitResult;

  enterSwitchStatement?:
      (node: babel.SwitchStatement, parent: babel.Node) => VisitResult;
  leaveSwitchStatement?:
      (node: babel.SwitchStatement, parent: babel.Node) => VisitResult;

  enterSwitchCase?: (node: babel.SwitchCase, parent: babel.Node) => VisitResult;
  leaveSwitchCase?: (node: babel.SwitchCase, parent: babel.Node) => VisitResult;

  enterThrowStatement?:
      (node: babel.ThrowStatement, parent: babel.Node) => VisitResult;
  leaveThrowStatement?:
      (node: babel.ThrowStatement, parent: babel.Node) => VisitResult;

  enterTryStatement?:
      (node: babel.TryStatement, parent: babel.Node) => VisitResult;
  leaveTryStatement?:
      (node: babel.TryStatement, parent: babel.Node) => VisitResult;

  enterCatchClause?:
      (node: babel.CatchClause, parent: babel.Node) => VisitResult;
  leaveCatchClause?:
      (node: babel.CatchClause, parent: babel.Node) => VisitResult;

  enterWhileStatement?:
      (node: babel.WhileStatement, parent: babel.Node) => VisitResult;
  leaveWhileStatement?:
      (node: babel.WhileStatement, parent: babel.Node) => VisitResult;

  enterDoWhileStatement?:
      (node: babel.DoWhileStatement, parent: babel.Node) => VisitResult;
  leaveDoWhileStatement?:
      (node: babel.DoWhileStatement, parent: babel.Node) => VisitResult;

  enterForStatement?:
      (node: babel.ForStatement, parent: babel.Node) => VisitResult;
  leaveForStatement?:
      (node: babel.ForStatement, parent: babel.Node) => VisitResult;

  enterForInStatement?:
      (node: babel.ForInStatement, parent: babel.Node) => VisitResult;
  leaveForInStatement?:
      (node: babel.ForInStatement, parent: babel.Node) => VisitResult;

  enterForOfStatement?:
      (node: babel.ForOfStatement, parent: babel.Node) => VisitResult;
  leaveForOfStatement?:
      (node: babel.ForOfStatement, parent: babel.Node) => VisitResult;

  enterFunctionDeclaration?:
      (node: babel.FunctionDeclaration, parent: babel.Node) => VisitResult;
  leaveFunctionDeclaration?:
      (node: babel.FunctionDeclaration, parent: babel.Node) => VisitResult;

  enterVariableDeclaration?:
      (node: babel.VariableDeclaration, parent: babel.Node) => VisitResult;
  leaveVariableDeclaration?:
      (node: babel.VariableDeclaration, parent: babel.Node) => VisitResult;

  enterVariableDeclarator?:
      (node: babel.VariableDeclarator, parent: babel.Node) => VisitResult;
  leaveVariableDeclarator?:
      (node: babel.VariableDeclarator, parent: babel.Node) => VisitResult;

  enterThisExpression?:
      (node: babel.ThisExpression, parent: babel.Node) => VisitResult;
  leaveThisExpression?:
      (node: babel.ThisExpression, parent: babel.Node) => VisitResult;

  enterArrayExpression?:
      (node: babel.ArrayExpression, parent: babel.Node) => VisitResult;
  leaveArrayExpression?:
      (node: babel.ArrayExpression, parent: babel.Node) => VisitResult;

  enterObjectExpression?:
      (node: babel.ObjectExpression, parent: babel.Node) => VisitResult;
  leaveObjectExpression?:
      (node: babel.ObjectExpression, parent: babel.Node) => VisitResult;

  enterProperty?: (node: babel.Property, parent: babel.Node) => VisitResult;
  leaveProperty?: (node: babel.Property, parent: babel.Node) => VisitResult;

  enterFunctionExpression?:
      (node: babel.FunctionExpression, parent: babel.Node) => VisitResult;
  leaveFunctionExpression?:
      (node: babel.FunctionExpression, parent: babel.Node) => VisitResult;

  enterArrowFunctionExpression?:
      (node: babel.ArrowFunctionExpression, parent: babel.Node) => VisitResult;
  leaveArrowFunctionExpression?:
      (node: babel.ArrowFunctionExpression, parent: babel.Node) => VisitResult;

  enterYieldExpression?:
      (node: babel.YieldExpression, parent: babel.Node) => VisitResult;
  leaveYieldExpression?:
      (node: babel.YieldExpression, parent: babel.Node) => VisitResult;

  enterSuper?: (node: babel.Super, parent: babel.Node) => VisitResult;
  leaveSuper?: (node: babel.Super, parent: babel.Node) => VisitResult;

  enterUnaryExpression?:
      (node: babel.UnaryExpression, parent: babel.Node) => VisitResult;
  leaveUnaryExpression?:
      (node: babel.UnaryExpression, parent: babel.Node) => VisitResult;

  enterUpdateExpression?:
      (node: babel.UpdateExpression, parent: babel.Node) => VisitResult;
  leaveUpdateExpression?:
      (node: babel.UpdateExpression, parent: babel.Node) => VisitResult;

  enterBinaryExpression?:
      (node: babel.BinaryExpression, parent: babel.Node) => VisitResult;
  leaveBinaryExpression?:
      (node: babel.BinaryExpression, parent: babel.Node) => VisitResult;

  enterAssignmentExpression?:
      (node: babel.AssignmentExpression, parent: babel.Node) => VisitResult;
  leaveAssignmentExpression?:
      (node: babel.AssignmentExpression, parent: babel.Node) => VisitResult;

  enterLogicalExpression?:
      (node: babel.LogicalExpression, parent: babel.Node) => VisitResult;
  leaveLogicalExpression?:
      (node: babel.LogicalExpression, parent: babel.Node) => VisitResult;

  enterMemberExpression?:
      (node: babel.MemberExpression, parent: babel.Node) => VisitResult;
  leaveMemberExpression?:
      (node: babel.MemberExpression, parent: babel.Node) => VisitResult;

  enterConditionalExpression?:
      (node: babel.ConditionalExpression, parent: babel.Node) => VisitResult;
  leaveConditionalExpression?:
      (node: babel.ConditionalExpression, parent: babel.Node) => VisitResult;

  enterCallExpression?:
      (node: babel.CallExpression, parent: babel.Node) => VisitResult;
  leaveCallExpression?:
      (node: babel.CallExpression, parent: babel.Node) => VisitResult;

  enterNewExpression?:
      (node: babel.NewExpression, parent: babel.Node) => VisitResult;
  leaveNewExpression?:
      (node: babel.NewExpression, parent: babel.Node) => VisitResult;

  enterSequenceExpression?:
      (node: babel.SequenceExpression, parent: babel.Node) => VisitResult;
  leaveSequenceExpression?:
      (node: babel.SequenceExpression, parent: babel.Node) => VisitResult;

  enterTemplateLiteral?:
      (node: babel.TemplateLiteral, parent: babel.Node) => VisitResult;
  leaveTemplateLiteral?:
      (node: babel.TemplateLiteral, parent: babel.Node) => VisitResult;

  enterTaggedTemplateExpression?:
      (node: babel.TaggedTemplateExpression, parent: babel.Node) => VisitResult;
  leaveTaggedTemplateExpression?:
      (node: babel.TaggedTemplateExpression, parent: babel.Node) => VisitResult;

  enterTemplateElement?:
      (node: babel.TemplateElement, parent: babel.Node) => VisitResult;
  leaveTemplateElement?:
      (node: babel.TemplateElement, parent: babel.Node) => VisitResult;

  enterSpreadElement?:
      (node: babel.SpreadElement, parent: babel.Node) => VisitResult;
  leaveSpreadElement?:
      (node: babel.SpreadElement, parent: babel.Node) => VisitResult;

  enterPattern?: (node: babel.Pattern, parent: babel.Node) => VisitResult;
  leavePattern?: (node: babel.Pattern, parent: babel.Node) => VisitResult;

  enterAssignmentProperty?:
      (node: babel.AssignmentProperty, parent: babel.Node) => VisitResult;
  leaveAssignmentProperty?:
      (node: babel.AssignmentProperty, parent: babel.Node) => VisitResult;

  enterObjectPattern?:
      (node: babel.ObjectPattern, parent: babel.Node) => VisitResult;
  leaveObjectPattern?:
      (node: babel.ObjectPattern, parent: babel.Node) => VisitResult;

  enterObjectMethod?:
      (node: babel.ObjectMethod, parent: babel.Node) => VisitResult;
  leaveObjectMethod?:
      (node: babel.ObjectMethod, parent: babel.Node) => VisitResult;

  enterObjectProperty?:
      (node: babel.ObjectProperty, parent: babel.Node) => VisitResult;
  leaveObjectProperty?:
      (node: babel.ObjectProperty, parent: babel.Node) => VisitResult;

  enterArrayPattern?:
      (node: babel.ArrayPattern, parent: babel.Node) => VisitResult;
  leaveArrayPattern?:
      (node: babel.ArrayPattern, parent: babel.Node) => VisitResult;

  enterRestElement?:
      (node: babel.RestElement, parent: babel.Node) => VisitResult;
  leaveRestElement?:
      (node: babel.RestElement, parent: babel.Node) => VisitResult;

  enterAssignmentPattern?:
      (node: babel.AssignmentPattern, parent: babel.Node) => VisitResult;
  leaveAssignmentPattern?:
      (node: babel.AssignmentPattern, parent: babel.Node) => VisitResult;

  enterMethod?: (node: babel.Method, parent: babel.Node) => VisitResult;
  leaveMethod?: (node: babel.Method, parent: babel.Node) => VisitResult;

  enterClassMethod?:
      (node: babel.ClassMethod, parent: babel.Node) => VisitResult;
  leaveClassMethod?:
      (node: babel.ClassMethod, parent: babel.Node) => VisitResult;

  enterClassDeclaration?:
      (node: babel.ClassDeclaration, parent: babel.Node) => VisitResult;
  leaveClassDeclaration?:
      (node: babel.ClassDeclaration, parent: babel.Node) => VisitResult;

  enterClassExpression?:
      (node: babel.ClassExpression, parent: babel.Node) => VisitResult;
  leaveClassExpression?:
      (node: babel.ClassExpression, parent: babel.Node) => VisitResult;

  enterMetaProperty?:
      (node: babel.MetaProperty, parent: babel.Node) => VisitResult;
  leaveMetaProperty?:
      (node: babel.MetaProperty, parent: babel.Node) => VisitResult;

  enterModuleDeclaration?:
      (node: babel.ModuleDeclaration, parent: babel.Node) => VisitResult;
  leaveModuleDeclaration?:
      (node: babel.ModuleDeclaration, parent: babel.Node) => VisitResult;

  enterModuleSpecifier?:
      (node: babel.ModuleSpecifier, parent: babel.Node) => VisitResult;
  leaveModuleSpecifier?:
      (node: babel.ModuleSpecifier, parent: babel.Node) => VisitResult;

  enterImportDeclaration?:
      (node: babel.ImportDeclaration, parent: babel.Node) => VisitResult;
  leaveImportDeclaration?:
      (node: babel.ImportDeclaration, parent: babel.Node) => VisitResult;

  enterImportSpecifier?:
      (node: babel.ImportSpecifier, parent: babel.Node) => VisitResult;
  leaveImportSpecifier?:
      (node: babel.ImportSpecifier, parent: babel.Node) => VisitResult;

  enterImportDefaultSpecifier?:
      (node: babel.ImportDefaultSpecifier, parent: babel.Node) => VisitResult;
  leaveImportDefaultSpecifier?:
      (node: babel.ImportDefaultSpecifier, parent: babel.Node) => VisitResult;

  enterImportNamespaceSpecifier?:
      (node: babel.ImportNamespaceSpecifier, parent: babel.Node) => VisitResult;
  leaveImportNamespaceSpecifier?:
      (node: babel.ImportNamespaceSpecifier, parent: babel.Node) => VisitResult;

  enterExportNamedDeclaration?:
      (node: babel.ExportNamedDeclaration, parent: babel.Node) => VisitResult;
  leaveExportNamedDeclaration?:
      (node: babel.ExportNamedDeclaration, parent: babel.Node) => VisitResult;

  enterExportSpecifier?:
      (node: babel.ExportSpecifier, parent: babel.Node) => VisitResult;
  leaveExportSpecifier?:
      (node: babel.ExportSpecifier, parent: babel.Node) => VisitResult;

  enterExportDefaultDeclaration?:
      (node: babel.ExportDefaultDeclaration, parent: babel.Node) => VisitResult;
  leaveExportDefaultDeclaration?:
      (node: babel.ExportDefaultDeclaration, parent: babel.Node) => VisitResult;

  enterExportAllDeclaration?:
      (node: babel.ExportAllDeclaration, parent: babel.Node) => VisitResult;
  leaveExportAllDeclaration?:
      (node: babel.ExportAllDeclaration, parent: babel.Node) => VisitResult;
}
