import {VisitorOption} from 'estraverse';
import * as estree from 'estree';

export type VisitResult = VisitorOption | void | null | undefined;

export interface Visitor {
  classDetected?: boolean;

  enterIdentifier?:
      (node: estree.Identifier, parent: estree.Node) => VisitResult;
  leaveIdentifier?:
      (node: estree.Identifier, parent: estree.Node) => VisitResult;

  enterLiteral?: (node: estree.Literal, parent: estree.Node) => VisitResult;
  leaveLiteral?: (node: estree.Literal, parent: estree.Node) => VisitResult;

  enterProgram?: (node: estree.Program, parent: estree.Node) => VisitResult;
  leaveProgram?: (node: estree.Program, parent: estree.Node) => VisitResult;

  enterExpressionStatement?:
      (node: estree.ExpressionStatement, parent: estree.Node) => VisitResult;
  leaveExpressionStatement?:
      (node: estree.ExpressionStatement, parent: estree.Node) => VisitResult;

  enterBlockStatement?:
      (node: estree.BlockStatement, parent: estree.Node) => VisitResult;
  leaveBlockStatement?:
      (node: estree.BlockStatement, parent: estree.Node) => VisitResult;

  enterEmptyStatement?:
      (node: estree.EmptyStatement, parent: estree.Node) => VisitResult;
  leaveEmptyStatement?:
      (node: estree.EmptyStatement, parent: estree.Node) => VisitResult;

  enterDebuggerStatement?:
      (node: estree.DebuggerStatement, parent: estree.Node) => VisitResult;
  leaveDebuggerStatement?:
      (node: estree.DebuggerStatement, parent: estree.Node) => VisitResult;

  enterWithStatement?:
      (node: estree.WithStatement, parent: estree.Node) => VisitResult;
  leaveWithStatement?:
      (node: estree.WithStatement, parent: estree.Node) => VisitResult;

  enterReturnStatement?:
      (node: estree.ReturnStatement, parent: estree.Node) => VisitResult;
  leaveReturnStatement?:
      (node: estree.ReturnStatement, parent: estree.Node) => VisitResult;

  enterLabeledStatement?:
      (node: estree.LabeledStatement, parent: estree.Node) => VisitResult;
  leaveLabeledStatement?:
      (node: estree.LabeledStatement, parent: estree.Node) => VisitResult;

  enterBreakStatement?:
      (node: estree.BreakStatement, parent: estree.Node) => VisitResult;
  leaveBreakStatement?:
      (node: estree.BreakStatement, parent: estree.Node) => VisitResult;

  enterContinueStatement?:
      (node: estree.ContinueStatement, parent: estree.Node) => VisitResult;
  leaveContinueStatement?:
      (node: estree.ContinueStatement, parent: estree.Node) => VisitResult;

  enterIfStatement?:
      (node: estree.IfStatement, parent: estree.Node) => VisitResult;
  leaveIfStatement?:
      (node: estree.IfStatement, parent: estree.Node) => VisitResult;

  enterSwitchStatement?:
      (node: estree.SwitchStatement, parent: estree.Node) => VisitResult;
  leaveSwitchStatement?:
      (node: estree.SwitchStatement, parent: estree.Node) => VisitResult;

  enterSwitchCase?:
      (node: estree.SwitchCase, parent: estree.Node) => VisitResult;
  leaveSwitchCase?:
      (node: estree.SwitchCase, parent: estree.Node) => VisitResult;

  enterThrowStatement?:
      (node: estree.ThrowStatement, parent: estree.Node) => VisitResult;
  leaveThrowStatement?:
      (node: estree.ThrowStatement, parent: estree.Node) => VisitResult;

  enterTryStatement?:
      (node: estree.TryStatement, parent: estree.Node) => VisitResult;
  leaveTryStatement?:
      (node: estree.TryStatement, parent: estree.Node) => VisitResult;

  enterCatchClause?:
      (node: estree.CatchClause, parent: estree.Node) => VisitResult;
  leaveCatchClause?:
      (node: estree.CatchClause, parent: estree.Node) => VisitResult;

  enterWhileStatement?:
      (node: estree.WhileStatement, parent: estree.Node) => VisitResult;
  leaveWhileStatement?:
      (node: estree.WhileStatement, parent: estree.Node) => VisitResult;

  enterDoWhileStatement?:
      (node: estree.DoWhileStatement, parent: estree.Node) => VisitResult;
  leaveDoWhileStatement?:
      (node: estree.DoWhileStatement, parent: estree.Node) => VisitResult;

  enterForStatement?:
      (node: estree.ForStatement, parent: estree.Node) => VisitResult;
  leaveForStatement?:
      (node: estree.ForStatement, parent: estree.Node) => VisitResult;

  enterForInStatement?:
      (node: estree.ForInStatement, parent: estree.Node) => VisitResult;
  leaveForInStatement?:
      (node: estree.ForInStatement, parent: estree.Node) => VisitResult;

  enterForOfStatement?:
      (node: estree.ForOfStatement, parent: estree.Node) => VisitResult;
  leaveForOfStatement?:
      (node: estree.ForOfStatement, parent: estree.Node) => VisitResult;

  enterFunctionDeclaration?:
      (node: estree.FunctionDeclaration, parent: estree.Node) => VisitResult;
  leaveFunctionDeclaration?:
      (node: estree.FunctionDeclaration, parent: estree.Node) => VisitResult;

  enterVariableDeclaration?:
      (node: estree.VariableDeclaration, parent: estree.Node) => VisitResult;
  leaveVariableDeclaration?:
      (node: estree.VariableDeclaration, parent: estree.Node) => VisitResult;

  enterVariableDeclarator?:
      (node: estree.VariableDeclarator, parent: estree.Node) => VisitResult;
  leaveVariableDeclarator?:
      (node: estree.VariableDeclarator, parent: estree.Node) => VisitResult;

  enterThisExpression?:
      (node: estree.ThisExpression, parent: estree.Node) => VisitResult;
  leaveThisExpression?:
      (node: estree.ThisExpression, parent: estree.Node) => VisitResult;

  enterArrayExpression?:
      (node: estree.ArrayExpression, parent: estree.Node) => VisitResult;
  leaveArrayExpression?:
      (node: estree.ArrayExpression, parent: estree.Node) => VisitResult;

  enterObjectExpression?:
      (node: estree.ObjectExpression, parent: estree.Node) => VisitResult;
  leaveObjectExpression?:
      (node: estree.ObjectExpression, parent: estree.Node) => VisitResult;

  enterProperty?: (node: estree.Property, parent: estree.Node) => VisitResult;
  leaveProperty?: (node: estree.Property, parent: estree.Node) => VisitResult;

  enterFunctionExpression?:
      (node: estree.FunctionExpression, parent: estree.Node) => VisitResult;
  leaveFunctionExpression?:
      (node: estree.FunctionExpression, parent: estree.Node) => VisitResult;

  enterArrowFunctionExpression?:
      (node: estree.ArrowFunctionExpression,
       parent: estree.Node) => VisitResult;
  leaveArrowFunctionExpression?:
      (node: estree.ArrowFunctionExpression,
       parent: estree.Node) => VisitResult;

  enterYieldExpression?:
      (node: estree.YieldExpression, parent: estree.Node) => VisitResult;
  leaveYieldExpression?:
      (node: estree.YieldExpression, parent: estree.Node) => VisitResult;

  enterSuper?: (node: estree.Super, parent: estree.Node) => VisitResult;
  leaveSuper?: (node: estree.Super, parent: estree.Node) => VisitResult;

  enterUnaryExpression?:
      (node: estree.UnaryExpression, parent: estree.Node) => VisitResult;
  leaveUnaryExpression?:
      (node: estree.UnaryExpression, parent: estree.Node) => VisitResult;

  enterUpdateExpression?:
      (node: estree.UpdateExpression, parent: estree.Node) => VisitResult;
  leaveUpdateExpression?:
      (node: estree.UpdateExpression, parent: estree.Node) => VisitResult;

  enterBinaryExpression?:
      (node: estree.BinaryExpression, parent: estree.Node) => VisitResult;
  leaveBinaryExpression?:
      (node: estree.BinaryExpression, parent: estree.Node) => VisitResult;

  enterAssignmentExpression?:
      (node: estree.AssignmentExpression, parent: estree.Node) => VisitResult;
  leaveAssignmentExpression?:
      (node: estree.AssignmentExpression, parent: estree.Node) => VisitResult;

  enterLogicalExpression?:
      (node: estree.LogicalExpression, parent: estree.Node) => VisitResult;
  leaveLogicalExpression?:
      (node: estree.LogicalExpression, parent: estree.Node) => VisitResult;

  enterMemberExpression?:
      (node: estree.MemberExpression, parent: estree.Node) => VisitResult;
  leaveMemberExpression?:
      (node: estree.MemberExpression, parent: estree.Node) => VisitResult;

  enterConditionalExpression?:
      (node: estree.ConditionalExpression, parent: estree.Node) => VisitResult;
  leaveConditionalExpression?:
      (node: estree.ConditionalExpression, parent: estree.Node) => VisitResult;

  enterCallExpression?:
      (node: estree.CallExpression, parent: estree.Node) => VisitResult;
  leaveCallExpression?:
      (node: estree.CallExpression, parent: estree.Node) => VisitResult;

  enterNewExpression?:
      (node: estree.NewExpression, parent: estree.Node) => VisitResult;
  leaveNewExpression?:
      (node: estree.NewExpression, parent: estree.Node) => VisitResult;

  enterSequenceExpression?:
      (node: estree.SequenceExpression, parent: estree.Node) => VisitResult;
  leaveSequenceExpression?:
      (node: estree.SequenceExpression, parent: estree.Node) => VisitResult;

  enterTemplateLiteral?:
      (node: estree.TemplateLiteral, parent: estree.Node) => VisitResult;
  leaveTemplateLiteral?:
      (node: estree.TemplateLiteral, parent: estree.Node) => VisitResult;

  enterTaggedTemplateExpression?:
      (node: estree.TaggedTemplateExpression,
       parent: estree.Node) => VisitResult;
  leaveTaggedTemplateExpression?:
      (node: estree.TaggedTemplateExpression,
       parent: estree.Node) => VisitResult;

  enterTemplateElement?:
      (node: estree.TemplateElement, parent: estree.Node) => VisitResult;
  leaveTemplateElement?:
      (node: estree.TemplateElement, parent: estree.Node) => VisitResult;

  enterSpreadElement?:
      (node: estree.SpreadElement, parent: estree.Node) => VisitResult;
  leaveSpreadElement?:
      (node: estree.SpreadElement, parent: estree.Node) => VisitResult;

  enterPattern?: (node: estree.Pattern, parent: estree.Node) => VisitResult;
  leavePattern?: (node: estree.Pattern, parent: estree.Node) => VisitResult;

  enterAssignmentProperty?:
      (node: estree.AssignmentProperty, parent: estree.Node) => VisitResult;
  leaveAssignmentProperty?:
      (node: estree.AssignmentProperty, parent: estree.Node) => VisitResult;

  enterObjectPattern?:
      (node: estree.ObjectPattern, parent: estree.Node) => VisitResult;
  leaveObjectPattern?:
      (node: estree.ObjectPattern, parent: estree.Node) => VisitResult;

  enterArrayPattern?:
      (node: estree.ArrayPattern, parent: estree.Node) => VisitResult;
  leaveArrayPattern?:
      (node: estree.ArrayPattern, parent: estree.Node) => VisitResult;

  enterRestElement?:
      (node: estree.RestElement, parent: estree.Node) => VisitResult;
  leaveRestElement?:
      (node: estree.RestElement, parent: estree.Node) => VisitResult;

  enterAssignmentPattern?:
      (node: estree.AssignmentPattern, parent: estree.Node) => VisitResult;
  leaveAssignmentPattern?:
      (node: estree.AssignmentPattern, parent: estree.Node) => VisitResult;

  enterMethodDefinition?:
      (node: estree.MethodDefinition, parent: estree.Node) => VisitResult;
  leaveMethodDefinition?:
      (node: estree.MethodDefinition, parent: estree.Node) => VisitResult;

  enterClassDeclaration?:
      (node: estree.ClassDeclaration, parent: estree.Node) => VisitResult;
  leaveClassDeclaration?:
      (node: estree.ClassDeclaration, parent: estree.Node) => VisitResult;

  enterClassExpression?:
      (node: estree.ClassExpression, parent: estree.Node) => VisitResult;
  leaveClassExpression?:
      (node: estree.ClassExpression, parent: estree.Node) => VisitResult;

  enterMetaProperty?:
      (node: estree.MetaProperty, parent: estree.Node) => VisitResult;
  leaveMetaProperty?:
      (node: estree.MetaProperty, parent: estree.Node) => VisitResult;

  enterModuleDeclaration?:
      (node: estree.ModuleDeclaration, parent: estree.Node) => VisitResult;
  leaveModuleDeclaration?:
      (node: estree.ModuleDeclaration, parent: estree.Node) => VisitResult;

  enterModuleSpecifier?:
      (node: estree.ModuleSpecifier, parent: estree.Node) => VisitResult;
  leaveModuleSpecifier?:
      (node: estree.ModuleSpecifier, parent: estree.Node) => VisitResult;

  enterImportDeclaration?:
      (node: estree.ImportDeclaration, parent: estree.Node) => VisitResult;
  leaveImportDeclaration?:
      (node: estree.ImportDeclaration, parent: estree.Node) => VisitResult;

  enterImportSpecifier?:
      (node: estree.ImportSpecifier, parent: estree.Node) => VisitResult;
  leaveImportSpecifier?:
      (node: estree.ImportSpecifier, parent: estree.Node) => VisitResult;

  enterImportDefaultSpecifier?:
      (node: estree.ImportDefaultSpecifier, parent: estree.Node) => VisitResult;
  leaveImportDefaultSpecifier?:
      (node: estree.ImportDefaultSpecifier, parent: estree.Node) => VisitResult;

  enterImportNamespaceSpecifier?:
      (node: estree.ImportNamespaceSpecifier,
       parent: estree.Node) => VisitResult;
  leaveImportNamespaceSpecifier?:
      (node: estree.ImportNamespaceSpecifier,
       parent: estree.Node) => VisitResult;

  enterExportNamedDeclaration?:
      (node: estree.ExportNamedDeclaration, parent: estree.Node) => VisitResult;
  leaveExportNamedDeclaration?:
      (node: estree.ExportNamedDeclaration, parent: estree.Node) => VisitResult;

  enterExportSpecifier?:
      (node: estree.ExportSpecifier, parent: estree.Node) => VisitResult;
  leaveExportSpecifier?:
      (node: estree.ExportSpecifier, parent: estree.Node) => VisitResult;

  enterExportDefaultDeclaration?:
      (node: estree.ExportDefaultDeclaration,
       parent: estree.Node) => VisitResult;
  leaveExportDefaultDeclaration?:
      (node: estree.ExportDefaultDeclaration,
       parent: estree.Node) => VisitResult;

  enterExportAllDeclaration?:
      (node: estree.ExportAllDeclaration, parent: estree.Node) => VisitResult;
  leaveExportAllDeclaration?:
      (node: estree.ExportAllDeclaration, parent: estree.Node) => VisitResult;
}
