/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */

import * as ts from 'typescript';

export abstract class Visitor {
  visitNode(node: ts.Node) {
    switch (node.kind) {
      case ts.SyntaxKind.AnyKeyword:
        this.visitAnyKeyword(node);
        break;
      case ts.SyntaxKind.ArrayBindingPattern:
        this.visitBindingPattern(<ts.BindingPattern>node);
        break;
      case ts.SyntaxKind.ArrayLiteralExpression:
        this.visitArrayLiteralExpression(<ts.ArrayLiteralExpression>node);
        break;
      case ts.SyntaxKind.ArrayType:
        this.visitArrayType(<ts.ArrayTypeNode>node);
        break;
      case ts.SyntaxKind.ArrowFunction:
        this.visitArrowFunction(<ts.FunctionLikeDeclaration>node);
        break;
      case ts.SyntaxKind.BinaryExpression:
        this.visitBinaryExpression(<ts.BinaryExpression>node);
        break;
      case ts.SyntaxKind.BindingElement:
        this.visitBindingElement(<ts.BindingElement>node);
        break;
      case ts.SyntaxKind.Block:
        this.visitBlock(<ts.Block>node);
        break;
      case ts.SyntaxKind.BreakStatement:
        this.visitBreakStatement(<ts.BreakOrContinueStatement>node);
        break;
      case ts.SyntaxKind.CallExpression:
        this.visitCallExpression(<ts.CallExpression>node);
        break;
      case ts.SyntaxKind.CallSignature:
        this.visitCallSignature(<ts.SignatureDeclaration>node);
        break;
      case ts.SyntaxKind.CaseClause:
        this.visitCaseClause(<ts.CaseClause>node);
        break;
      case ts.SyntaxKind.ClassDeclaration:
        this.visitClassDeclaration(<ts.ClassDeclaration>node);
        break;
      case ts.SyntaxKind.ClassExpression:
        this.visitClassExpression(<ts.ClassExpression>node);
        break;
      case ts.SyntaxKind.CatchClause:
        this.visitCatchClause(<ts.CatchClause>node);
        break;
      case ts.SyntaxKind.ConditionalExpression:
        this.visitConditionalExpression(<ts.ConditionalExpression>node);
        break;
      case ts.SyntaxKind.ConstructSignature:
        this.visitConstructSignature(<ts.ConstructSignatureDeclaration>node);
        break;
      case ts.SyntaxKind.Constructor:
        this.visitConstructorDeclaration(<ts.ConstructorDeclaration>node);
        break;
      case ts.SyntaxKind.ConstructorType:
        this.visitConstructorType(<ts.FunctionOrConstructorTypeNode>node);
        break;
      case ts.SyntaxKind.ContinueStatement:
        this.visitContinueStatement(<ts.BreakOrContinueStatement>node);
        break;
      case ts.SyntaxKind.DebuggerStatement:
        this.visitDebuggerStatement(<ts.Statement>node);
        break;
      case ts.SyntaxKind.DefaultClause:
        this.visitDefaultClause(<ts.DefaultClause>node);
        break;
      case ts.SyntaxKind.DoStatement:
        this.visitDoStatement(<ts.DoStatement>node);
        break;
      case ts.SyntaxKind.ElementAccessExpression:
        this.visitElementAccessExpression(<ts.ElementAccessExpression>node);
        break;
      case ts.SyntaxKind.EnumDeclaration:
        this.visitEnumDeclaration(<ts.EnumDeclaration>node);
        break;
      case ts.SyntaxKind.ExportAssignment:
        this.visitExportAssignment(<ts.ExportAssignment>node);
        break;
      case ts.SyntaxKind.ExpressionStatement:
        this.visitExpressionStatement(<ts.ExpressionStatement>node);
        break;
      case ts.SyntaxKind.ForStatement:
        this.visitForStatement(<ts.ForStatement>node);
        break;
      case ts.SyntaxKind.ForInStatement:
        this.visitForInStatement(<ts.ForInStatement>node);
        break;
      case ts.SyntaxKind.ForOfStatement:
        this.visitForOfStatement(<ts.ForOfStatement>node);
        break;
      case ts.SyntaxKind.FunctionDeclaration:
        this.visitFunctionDeclaration(<ts.FunctionDeclaration>node);
        break;
      case ts.SyntaxKind.FunctionExpression:
        this.visitFunctionExpression(<ts.FunctionExpression>node);
        break;
      case ts.SyntaxKind.FunctionType:
        this.visitFunctionType(<ts.FunctionOrConstructorTypeNode>node);
        break;
      case ts.SyntaxKind.GetAccessor:
        this.visitGetAccessor(<ts.AccessorDeclaration>node);
        break;
      case ts.SyntaxKind.Identifier:
        this.visitIdentifier(<ts.Identifier>node);
        break;
      case ts.SyntaxKind.IfStatement:
        this.visitIfStatement(<ts.IfStatement>node);
        break;
      case ts.SyntaxKind.ImportDeclaration:
        this.visitImportDeclaration(<ts.ImportDeclaration>node);
        break;
      case ts.SyntaxKind.ImportEqualsDeclaration:
        this.visitImportEqualsDeclaration(<ts.ImportEqualsDeclaration>node);
        break;
      case ts.SyntaxKind.IndexSignature:
        this.visitIndexSignatureDeclaration(<ts.IndexSignatureDeclaration>node);
        break;
      case ts.SyntaxKind.InterfaceDeclaration:
        this.visitInterfaceDeclaration(<ts.InterfaceDeclaration>node);
        break;
      case ts.SyntaxKind.JsxAttribute:
        this.visitJsxAttribute(<ts.JsxAttribute>node);
        break;
      case ts.SyntaxKind.JsxElement:
        this.visitJsxElement(<ts.JsxElement>node);
        break;
      case ts.SyntaxKind.JsxExpression:
        this.visitJsxExpression(<ts.JsxExpression>node);
        break;
      case ts.SyntaxKind.JsxSelfClosingElement:
        this.visitJsxSelfClosingElement(<ts.JsxSelfClosingElement>node);
        break;
      case ts.SyntaxKind.JsxSpreadAttribute:
        this.visitJsxSpreadAttribute(<ts.JsxSpreadAttribute>node);
        break;
      case ts.SyntaxKind.LabeledStatement:
        this.visitLabeledStatement(<ts.LabeledStatement>node);
        break;
      case ts.SyntaxKind.MethodDeclaration:
        this.visitMethodDeclaration(<ts.MethodDeclaration>node);
        break;
      case ts.SyntaxKind.MethodSignature:
        this.visitMethodSignature(<ts.SignatureDeclaration>node);
        break;
      case ts.SyntaxKind.ModuleDeclaration:
        this.visitModuleDeclaration(<ts.ModuleDeclaration>node);
        break;
      case ts.SyntaxKind.NamedImports:
        this.visitNamedImports(<ts.NamedImports>node);
        break;
      case ts.SyntaxKind.NamespaceImport:
        this.visitNamespaceImport(<ts.NamespaceImport>node);
        break;
      case ts.SyntaxKind.NewExpression:
        this.visitNewExpression(<ts.NewExpression>node);
        break;
      case ts.SyntaxKind.ObjectBindingPattern:
        this.visitBindingPattern(<ts.BindingPattern>node);
        break;
      case ts.SyntaxKind.ObjectLiteralExpression:
        this.visitObjectLiteralExpression(<ts.ObjectLiteralExpression>node);
        break;
      case ts.SyntaxKind.Parameter:
        this.visitParameterDeclaration(<ts.ParameterDeclaration>node);
        break;
      case ts.SyntaxKind.PostfixUnaryExpression:
        this.visitPostfixUnaryExpression(<ts.PostfixUnaryExpression>node);
        break;
      case ts.SyntaxKind.PrefixUnaryExpression:
        this.visitPrefixUnaryExpression(<ts.PrefixUnaryExpression>node);
        break;
      case ts.SyntaxKind.PropertyAccessExpression:
        this.visitPropertyAccessExpression(<ts.PropertyAccessExpression>node);
        break;
      case ts.SyntaxKind.PropertyAssignment:
        this.visitPropertyAssignment(<ts.PropertyAssignment>node);
        break;
      case ts.SyntaxKind.PropertyDeclaration:
        this.visitPropertyDeclaration(<ts.PropertyDeclaration>node);
        break;
      case ts.SyntaxKind.PropertySignature:
        this.visitPropertySignature(node);
        break;
      case ts.SyntaxKind.RegularExpressionLiteral:
        this.visitRegularExpressionLiteral(node);
        break;
      case ts.SyntaxKind.ReturnStatement:
        this.visitReturnStatement(<ts.ReturnStatement>node);
        break;
      case ts.SyntaxKind.SetAccessor:
        this.visitSetAccessor(<ts.AccessorDeclaration>node);
        break;
      case ts.SyntaxKind.SourceFile:
        this.visitSourceFile(<ts.SourceFile>node);
        break;
      case ts.SyntaxKind.StringLiteral:
        this.visitStringLiteral(<ts.StringLiteral>node);
        break;
      case ts.SyntaxKind.SwitchStatement:
        this.visitSwitchStatement(<ts.SwitchStatement>node);
        break;
      case ts.SyntaxKind.TemplateExpression:
        this.visitTemplateExpression(<ts.TemplateExpression>node);
        break;
      case ts.SyntaxKind.ThrowStatement:
        this.visitThrowStatement(<ts.ThrowStatement>node);
        break;
      case ts.SyntaxKind.TryStatement:
        this.visitTryStatement(<ts.TryStatement>node);
        break;
      case ts.SyntaxKind.TupleType:
        this.visitTupleType(<ts.TupleTypeNode>node);
        break;
      case ts.SyntaxKind.TypeAliasDeclaration:
        this.visitTypeAliasDeclaration(<ts.TypeAliasDeclaration>node);
        break;
      case ts.SyntaxKind.TypeAssertionExpression:
        this.visitTypeAssertionExpression(<ts.TypeAssertion>node);
        break;
      case ts.SyntaxKind.TypeLiteral:
        this.visitTypeLiteral(<ts.TypeLiteralNode>node);
        break;
      case ts.SyntaxKind.TypeReference:
        this.visitTypeReference(<ts.TypeReferenceNode>node);
        break;
      case ts.SyntaxKind.VariableDeclaration:
        this.visitVariableDeclaration(<ts.VariableDeclaration>node);
        break;
      case ts.SyntaxKind.VariableStatement:
        this.visitVariableStatement(<ts.VariableStatement>node);
        break;
      case ts.SyntaxKind.WhileStatement:
        this.visitWhileStatement(<ts.WhileStatement>node);
        break;
      case ts.SyntaxKind.WithStatement:
        this.visitWithStatement(<ts.WithStatement>node);
        break;
      default:
        console.warn(`unknown node type: ${node}`);
        break;
    }
  }

  visitChildren(node: ts.Node): void {
    ts.forEachChild(node, (child) => this.visitNode(child));
  }

  visitAnyKeyword(node: ts.Node): void {
    this.visitChildren(node);
  }

  visitArrayLiteralExpression(node: ts.ArrayLiteralExpression): void {
    this.visitChildren(node);
  }

  visitArrayType(node: ts.ArrayTypeNode): void {
    this.visitChildren(node);
  }

  visitArrowFunction(node: ts.FunctionLikeDeclaration): void {
    this.visitChildren(node);
  }

  visitBinaryExpression(node: ts.BinaryExpression): void {
    this.visitChildren(node);
  }

  visitBindingElement(node: ts.BindingElement): void {
    this.visitChildren(node);
  }

  visitBindingPattern(node: ts.BindingPattern): void {
    this.visitChildren(node);
  }

  visitBlock(node: ts.Block): void {
    this.visitChildren(node);
  }

  visitBreakStatement(node: ts.BreakOrContinueStatement): void {
    this.visitChildren(node);
  }

  visitCallExpression(node: ts.CallExpression): void {
    this.visitChildren(node);
  }

  visitCallSignature(node: ts.SignatureDeclaration): void {
    this.visitChildren(node);
  }

  visitCaseClause(node: ts.CaseClause): void {
    this.visitChildren(node);
  }

  visitClassDeclaration(node: ts.ClassDeclaration): void {
    this.visitChildren(node);
  }

  visitClassExpression(node: ts.ClassExpression): void {
    this.visitChildren(node);
  }

  visitCatchClause(node: ts.CatchClause): void {
    this.visitChildren(node);
  }

  visitConditionalExpression(node: ts.ConditionalExpression): void {
    this.visitChildren(node);
  }

  visitConstructSignature(node: ts.ConstructSignatureDeclaration): void {
    this.visitChildren(node);
  }

  visitConstructorDeclaration(node: ts.ConstructorDeclaration): void {
    this.visitChildren(node);
  }

  visitConstructorType(node: ts.FunctionOrConstructorTypeNode): void {
    this.visitChildren(node);
  }

  visitContinueStatement(node: ts.BreakOrContinueStatement): void {
    this.visitChildren(node);
  }

  visitDebuggerStatement(node: ts.Statement): void {
    this.visitChildren(node);
  }

  visitDefaultClause(node: ts.DefaultClause): void {
    this.visitChildren(node);
  }

  visitDoStatement(node: ts.DoStatement): void {
    this.visitChildren(node);
  }

  visitElementAccessExpression(node: ts.ElementAccessExpression): void {
    this.visitChildren(node);
  }

  visitEnumDeclaration(node: ts.EnumDeclaration): void {
    this.visitChildren(node);
  }

  visitExportAssignment(node: ts.ExportAssignment): void {
    this.visitChildren(node);
  }

  visitExpressionStatement(node: ts.ExpressionStatement): void {
    this.visitChildren(node);
  }

  visitForStatement(node: ts.ForStatement): void {
    this.visitChildren(node);
  }

  visitForInStatement(node: ts.ForInStatement): void {
    this.visitChildren(node);
  }

  visitForOfStatement(node: ts.ForOfStatement): void {
    this.visitChildren(node);
  }

  visitFunctionDeclaration(node: ts.FunctionDeclaration): void {
    this.visitChildren(node);
  }

  visitFunctionExpression(node: ts.FunctionExpression): void {
    this.visitChildren(node);
  }

  visitFunctionType(node: ts.FunctionOrConstructorTypeNode): void {
    this.visitChildren(node);
  }

  visitGetAccessor(node: ts.AccessorDeclaration): void {
    this.visitChildren(node);
  }

  visitIdentifier(node: ts.Identifier): void {
    this.visitChildren(node);
  }

  visitIfStatement(node: ts.IfStatement): void {
    this.visitChildren(node);
  }

  visitImportDeclaration(node: ts.ImportDeclaration): void {
    this.visitChildren(node);
  }

  visitImportEqualsDeclaration(node: ts.ImportEqualsDeclaration): void {
    this.visitChildren(node);
  }

  visitIndexSignatureDeclaration(node: ts.IndexSignatureDeclaration): void {
    this.visitChildren(node);
  }

  visitInterfaceDeclaration(node: ts.InterfaceDeclaration): void {
    this.visitChildren(node);
  }

  visitJsxAttribute(node: ts.JsxAttribute): void {
    this.visitChildren(node);
  }

  visitJsxElement(node: ts.JsxElement): void {
    this.visitChildren(node);
  }

  visitJsxExpression(node: ts.JsxExpression): void {
    this.visitChildren(node);
  }

  visitJsxSelfClosingElement(node: ts.JsxSelfClosingElement): void {
    this.visitChildren(node);
  }

  visitJsxSpreadAttribute(node: ts.JsxSpreadAttribute): void {
    this.visitChildren(node);
  }

  visitLabeledStatement(node: ts.LabeledStatement): void {
    this.visitChildren(node);
  }

  visitMethodDeclaration(node: ts.MethodDeclaration): void {
    this.visitChildren(node);
  }

  visitMethodSignature(node: ts.SignatureDeclaration): void {
    this.visitChildren(node);
  }

  visitModuleDeclaration(node: ts.ModuleDeclaration): void {
    this.visitChildren(node);
  }

  visitNamedImports(node: ts.NamedImports): void {
    this.visitChildren(node);
  }

  visitNamespaceImport(node: ts.NamespaceImport): void {
    this.visitChildren(node);
  }

  visitNewExpression(node: ts.NewExpression): void {
    this.visitChildren(node);
  }

  visitObjectLiteralExpression(node: ts.ObjectLiteralExpression): void {
    this.visitChildren(node);
  }

  visitParameterDeclaration(node: ts.ParameterDeclaration): void {
    this.visitChildren(node);
  }

  visitPostfixUnaryExpression(node: ts.PostfixUnaryExpression): void {
    this.visitChildren(node);
  }

  visitPrefixUnaryExpression(node: ts.PrefixUnaryExpression): void {
    this.visitChildren(node);
  }

  visitPropertyAccessExpression(node: ts.PropertyAccessExpression): void {
    this.visitChildren(node);
  }

  visitPropertyAssignment(node: ts.PropertyAssignment): void {
    this.visitChildren(node);
  }

  visitPropertyDeclaration(node: ts.PropertyDeclaration): void {
    this.visitChildren(node);
  }

  visitPropertySignature(node: ts.Node): void {
    this.visitChildren(node);
  }

  visitRegularExpressionLiteral(node: ts.Node): void {
    this.visitChildren(node);
  }

  visitReturnStatement(node: ts.ReturnStatement): void {
    this.visitChildren(node);
  }

  visitSetAccessor(node: ts.AccessorDeclaration): void {
    this.visitChildren(node);
  }

  visitSourceFile(node: ts.SourceFile): void {
    this.visitChildren(node);
  }

  visitStringLiteral(node: ts.StringLiteral): void {
    this.visitChildren(node);
  }

  visitSwitchStatement(node: ts.SwitchStatement): void {
    this.visitChildren(node);
  }

  visitTemplateExpression(node: ts.TemplateExpression): void {
    this.visitChildren(node);
  }

  visitThrowStatement(node: ts.ThrowStatement): void {
    this.visitChildren(node);
  }

  visitTryStatement(node: ts.TryStatement): void {
    this.visitChildren(node);
  }

  visitTupleType(node: ts.TupleTypeNode): void {
    this.visitChildren(node);
  }

  visitTypeAliasDeclaration(node: ts.TypeAliasDeclaration): void {
    this.visitChildren(node);
  }

  visitTypeAssertionExpression(node: ts.TypeAssertion): void {
    this.visitChildren(node);
  }

  visitTypeLiteral(node: ts.TypeLiteralNode): void {
    this.visitChildren(node);
  }

  visitTypeReference(node: ts.TypeReferenceNode): void {
    this.visitChildren(node);
  }

  visitVariableDeclaration(node: ts.VariableDeclaration): void {
    this.visitChildren(node);
  }

  visitVariableStatement(node: ts.VariableStatement): void {
    this.visitChildren(node);
  }

  visitWhileStatement(node: ts.WhileStatement): void {
    this.visitChildren(node);
  }

  visitWithStatement(node: ts.WithStatement): void {
    this.visitChildren(node);
  }
}
