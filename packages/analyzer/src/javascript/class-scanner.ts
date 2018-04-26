/**
 * @license
 * Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
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

import generate from '@babel/generator';
import {NodePath} from '@babel/traverse';
import * as babel from '@babel/types';
import * as doctrine from 'doctrine';

import {Result} from '../model/analysis';
import {MapWithDefault, MethodParam, ScannedClass, ScannedFeature, ScannedMethod, ScannedProperty, ScannedReference, Severity, SourceRange, Warning} from '../model/model';
import {extractObservers} from '../polymer/declaration-property-handlers';
import {mergePropertyDeclarations, Observer, ScannedPolymerElement} from '../polymer/polymer-element';
import {ScannedPolymerElementMixin} from '../polymer/polymer-element-mixin';
import {getIsValue, getPolymerProperties, getStaticGetterValue} from '../polymer/polymer2-config';
import {MixinVisitor} from '../polymer/polymer2-mixin-scanner';

import * as astValue from './ast-value';
import {getIdentifierName, getNamespacedIdentifier} from './ast-value';
import {Visitor} from './estree-visitor';
import * as esutil from './esutil';
import {getClosureType, getMethods, getOrInferPrivacy, getReturnFromAnnotation, getStaticMethods, inferReturnFromBody, toMethodParam} from './esutil';
import {JavaScriptDocument} from './javascript-document';
import {JavaScriptScanner} from './javascript-scanner';
import * as jsdoc from './jsdoc';


/**
 * Represents the first argument of a call to customElements.define.
 */
type TagNameExpression = ClassDotIsExpression|StringLiteralExpression;

/** The tagname was the `is` property on an class, like `MyElem.is` */
interface ClassDotIsExpression {
  type: 'is';
  className: string;
  classNameSourceRange: SourceRange;
}
/** The tag name was just a string literal. */
interface StringLiteralExpression {
  type: 'string-literal';
  value: string;
  sourceRange: SourceRange;
}


export interface ScannedAttribute extends ScannedFeature {
  name: string;
  type?: string;
}

/**
 * Find and classify classes from source code.
 *
 * Currently this has a bunch of Polymer stuff baked in that shouldn't be here
 * in order to support generating only one feature for stuff that's essentially
 * more specific kinds of classes, like Elements, PolymerElements, Mixins, etc.
 *
 * In a future change we'll add a mechanism whereby plugins can claim and
 * specialize classes.
 */
export class ClassScanner implements JavaScriptScanner {
  async scan(
      document: JavaScriptDocument,
      visit: (visitor: Visitor) => Promise<void>) {
    const classFinder = new ClassFinder(document);
    const mixinFinder = new MixinVisitor(document);
    const elementDefinitionFinder =
        new CustomElementsDefineCallFinder(document);
    const prototypeMemberFinder = new PrototypeMemberFinder(document);
    // Find all classes and all calls to customElements.define()
    await Promise.all([
      visit(classFinder),
      visit(elementDefinitionFinder),
      visit(mixinFinder),
      visit(prototypeMemberFinder),
    ]);
    const mixins = mixinFinder.mixins;

    const elementDefinitionsByClassName = new Map<string, ElementDefineCall>();
    // For classes that show up as expressions in the second argument position
    // of a customElements.define call.
    const elementDefinitionsByClassExpression =
        new Map<babel.ClassExpression, ElementDefineCall>();

    for (const defineCall of elementDefinitionFinder.calls) {
      // MaybeChainedIdentifier is invented below. It's like Identifier, but it
      // includes 'Polymer.Element' as a name.
      if (defineCall.class_.type === 'MaybeChainedIdentifier') {
        elementDefinitionsByClassName.set(defineCall.class_.name, defineCall);
      } else {
        elementDefinitionsByClassExpression.set(defineCall.class_, defineCall);
      }
    }
    // TODO(rictic): emit ElementDefineCallFeatures for define calls that don't
    //     map to any local classes?

    const mixinClassExpressions = new Set<babel.Node>();
    for (const mixin of mixins) {
      if (mixin.classAstNode) {
        mixinClassExpressions.add(mixin.classAstNode);
      }
    }

    // Next we want to distinguish custom elements from other classes.
    const customElements: CustomElementDefinition[] = [];
    const normalClasses = [];
    const classMap = new Map<string, ScannedClass>();

    for (const class_ of classFinder.classes) {
      if (class_.astNode.language === 'js' &&
          mixinClassExpressions.has(class_.astNode.node)) {
        // This class is a mixin and has already been handled as such.
        continue;
      }
      if (class_.name) {
        classMap.set(class_.name, class_);
      }
      // Class expressions inside the customElements.define call
      if (babel.isClassExpression(class_.astNode.node)) {
        const definition =
            elementDefinitionsByClassExpression.get(class_.astNode.node);
        if (definition) {
          customElements.push({class_, definition});
          continue;
        }
      }
      // Classes whose names are referenced in a same-file customElements.define
      const definition = elementDefinitionsByClassName.get(class_.name!) ||
          elementDefinitionsByClassName.get(class_.localName!);
      if (definition) {
        customElements.push({class_, definition});
        continue;
      }
      // Classes explicitly defined as elements in their jsdoc tags.
      // TODO(justinfagnani): remove @polymerElement support
      if (jsdoc.hasTag(class_.jsdoc, 'customElement') ||
          jsdoc.hasTag(class_.jsdoc, 'polymerElement')) {
        customElements.push({class_});
        continue;
      }
      // Classes that aren't custom elements, or at least, aren't obviously.
      normalClasses.push(class_);
    }

    for (const [name, members] of prototypeMemberFinder.members) {
      if (classMap.has(name)) {
        const cls = classMap.get(name)!;
        cls.finishInitialization(members.methods, members.properties);
      }
    }

    const scannedFeatures: (ScannedPolymerElement|ScannedClass|
                            ScannedPolymerElementMixin)[] = [];
    for (const element of customElements) {
      scannedFeatures.push(this._makeElementFeature(element, document));
    }
    for (const scannedClass of normalClasses) {
      scannedFeatures.push(scannedClass);
    }
    for (const mixin of mixins) {
      scannedFeatures.push(mixin);
    }

    return {
      features: scannedFeatures,
      warnings: [
        ...elementDefinitionFinder.warnings,
        ...classFinder.warnings,
        ...mixinFinder.warnings,
      ]
    };
  }

  private _makeElementFeature(
      element: CustomElementDefinition,
      document: JavaScriptDocument): ScannedPolymerElement {
    const class_ = element.class_;
    const astNode = element.class_.astNode;
    const docs = element.class_.jsdoc;
    const customElementTag = jsdoc.getTag(class_.jsdoc, 'customElement');
    let tagName: string|undefined = undefined;
    if (element.definition &&
        element.definition.tagName.type === 'string-literal') {
      tagName = element.definition.tagName.value;
    } else if (customElementTag && customElementTag.description) {
      tagName = customElementTag.description;
    } else if (
        babel.isClassExpression(astNode.node) ||
        babel.isClassDeclaration(astNode.node)) {
      tagName = getIsValue(astNode.node);
    }
    let warnings: Warning[] = [];

    let scannedElement: ScannedPolymerElement;
    let methods = new Map<string, ScannedMethod>();
    let staticMethods = new Map<string, ScannedMethod>();
    let observers: Observer[] = [];

    // This will cover almost all classes, except those defined only by
    // applying a mixin. e.g.   const MyElem = Mixin(HTMLElement)
    if (babel.isClassExpression(astNode.node) ||
        babel.isClassDeclaration(astNode.node)) {
      const observersResult = this._getObservers(astNode.node, document);
      observers = [];
      if (observersResult) {
        observers = observersResult.observers;
        warnings = warnings.concat(observersResult.warnings);
      }
      const polymerProps = getPolymerProperties(astNode.node, document);
      for (const prop of polymerProps) {
        const constructorProp = class_.properties.get(prop.name);
        let finalProp;
        if (constructorProp) {
          finalProp = mergePropertyDeclarations(constructorProp, prop);
        } else {
          finalProp = prop;
        }
        class_.properties.set(prop.name, finalProp);
      }
      methods = getMethods(astNode.node, document);
      staticMethods = getStaticMethods(astNode.node, document);
    }

    const extendsTag = jsdoc.getTag(docs, 'extends');
    const extends_ = extendsTag !== undefined ? extendsTag.name : undefined;
    // TODO(justinfagnani): Infer mixin applications and superclass from AST.
    scannedElement = new ScannedPolymerElement({
      className: class_.name,
      tagName,
      astNode,
      statementAst: class_.statementAst,
      properties: [...class_.properties.values()],
      methods,
      staticMethods,
      observers,
      events: astNode.language === 'js' ?
          esutil.getEventComments(astNode.node) :
          new Map(),
      attributes: new Map(),
      behaviors: [],
      extends: extends_,
      listeners: [],

      description: class_.description,
      sourceRange: class_.sourceRange,
      superClass: class_.superClass,
      jsdoc: class_.jsdoc,
      abstract: class_.abstract,
      mixins: class_.mixins,
      privacy: class_.privacy
    });

    if (babel.isClassExpression(astNode.node) ||
        babel.isClassDeclaration(astNode.node)) {
      const observedAttributes =
          this._getObservedAttributes(astNode.node, document);

      if (observedAttributes != null) {
        // If a class defines observedAttributes, it overrides what the base
        // classes defined.
        // TODO(justinfagnani): define and handle composition patterns.
        scannedElement.attributes.clear();
        for (const attr of observedAttributes) {
          scannedElement.attributes.set(attr.name, attr);
        }
      }
    }

    warnings.forEach((w) => scannedElement.warnings.push(w));

    return scannedElement;
  }

  private _getObservers(
      node: babel.ClassDeclaration|babel.ClassExpression,
      document: JavaScriptDocument) {
    const returnedValue = getStaticGetterValue(node, 'observers');
    if (returnedValue) {
      return extractObservers(returnedValue, document);
    }
  }

  private _getObservedAttributes(
      node: babel.ClassDeclaration|babel.ClassExpression,
      document: JavaScriptDocument) {
    const returnedValue = getStaticGetterValue(node, 'observedAttributes');
    if (returnedValue && babel.isArrayExpression(returnedValue)) {
      return this._extractAttributesFromObservedAttributes(
          returnedValue, document);
    }
  }

  /**
   * Extract attributes from the array expression inside a static
   * observedAttributes method.
   *
   * e.g.
   *     static get observedAttributes() {
   *       return [
   *         /** @type {boolean} When given the element is totally inactive *\/
   *         'disabled',
   *         /** @type {boolean} When given the element is expanded *\/
   *         'open'
   *       ];
   *     }
   */
  private _extractAttributesFromObservedAttributes(
      arry: babel.ArrayExpression, document: JavaScriptDocument) {
    const results: ScannedAttribute[] = [];
    for (const expr of arry.elements) {
      const value = astValue.expressionToValue(expr);
      if (value && typeof value === 'string') {
        let description = '';
        let type: string|null = null;
        const comment = esutil.getAttachedComment(expr);
        if (comment) {
          const annotation = jsdoc.parseJsdoc(comment);
          description = annotation.description || description;
          const tags = annotation.tags || [];
          for (const tag of tags) {
            if (tag.title === 'type') {
              type = type || doctrine.type.stringify(tag.type!);
            }
            // TODO(justinfagnani): this appears wrong, any tag could have a
            // description do we really let any tag's description override
            // the previous?
            description = description || tag.description || '';
          }
        }
        const attribute: ScannedAttribute = {
          name: value,
          description: description,
          sourceRange: document.sourceRangeForNode(expr),
          astNode: {language: 'js', containingDocument: document, node: expr},
          warnings: [],
        };
        if (type) {
          attribute.type = type;
        }
        results.push(attribute);
      }
    }
    return results;
  }
}

interface CustomElementDefinition {
  class_: ScannedClass;
  definition?: ElementDefineCall;
}

class PrototypeMemberFinder implements Visitor {
  readonly members = new MapWithDefault<string, {
    methods: Map<string, ScannedMethod>,
    properties: Map<string, ScannedProperty>
  }>(() => ({
       methods: new Map<string, ScannedMethod>(),
       properties: new Map<string, ScannedProperty>()
     }));
  private readonly _document: JavaScriptDocument;

  constructor(document: JavaScriptDocument) {
    this._document = document;
  }

  enterExpressionStatement(node: babel.ExpressionStatement) {
    if (babel.isAssignmentExpression(node.expression)) {
      this._createMemberFromAssignment(
          node.expression, getJSDocAnnotationForNode(node));
    } else if (babel.isMemberExpression(node.expression)) {
      this._createMemberFromMemberExpression(
          node.expression, getJSDocAnnotationForNode(node));
    }
  }

  private _createMemberFromAssignment(
      node: babel.AssignmentExpression, jsdocAnn?: jsdoc.Annotation) {
    if (!babel.isMemberExpression(node.left) ||
        !babel.isMemberExpression(node.left.object) ||
        !babel.isIdentifier(node.left.property)) {
      return;
    }

    const leftExpr = node.left.object;
    const leftProperty = node.left.property;
    const cls = getIdentifierName(leftExpr.object);
    if (!cls || getIdentifierName(leftExpr.property) !== 'prototype') {
      return;
    }

    if (babel.isFunctionExpression(node.right)) {
      const prop = this._createMethodFromExpression(
          leftProperty.name, node.right, jsdocAnn);
      if (prop) {
        this._addMethodToClass(cls, prop);
      }
    } else {
      const method =
          this._createPropertyFromExpression(leftProperty.name, node, jsdocAnn);
      if (method) {
        this._addPropertyToClass(cls, method);
      }
    }
  }

  private _addMethodToClass(cls: string, member: ScannedMethod) {
    const classMembers = this.members.get(cls);
    classMembers.methods.set(member.name, member);
  }

  private _addPropertyToClass(cls: string, member: ScannedProperty) {
    const classMembers = this.members.get(cls);
    classMembers.properties.set(member.name, member);
  }

  private _createMemberFromMemberExpression(
      node: babel.MemberExpression, jsdocAnn: jsdoc.Annotation|undefined) {
    const left = node.object;

    // we only want `something.prototype.member`
    if (!babel.isIdentifier(node.property) || !babel.isMemberExpression(left) ||
        getIdentifierName(left.property) !== 'prototype') {
      return;
    }

    const cls = getIdentifierName(left.object);

    if (!cls) {
      return;
    }

    if (jsdoc.hasTag(jsdocAnn, 'function')) {
      const prop =
          this._createMethodFromExpression(node.property.name, node, jsdocAnn);
      if (prop) {
        this._addMethodToClass(cls, prop);
      }
    } else {
      const method = this._createPropertyFromExpression(
          node.property.name, node, jsdocAnn);
      if (method) {
        this._addPropertyToClass(cls, method);
      }
    }
  }

  private _createPropertyFromExpression(
      name: string, node: babel.AssignmentExpression|babel.MemberExpression,
      jsdocAnn: jsdoc.Annotation|undefined) {
    let description;
    let type;
    let readOnly = false;
    const privacy = getOrInferPrivacy(name, jsdocAnn);
    const sourceRange = this._document.sourceRangeForNode(node)!;
    const warnings: Warning[] = [];

    if (jsdocAnn) {
      description = jsdoc.getDescription(jsdocAnn);
      readOnly = jsdoc.hasTag(jsdocAnn, 'readonly');
    }

    let detectedType: Result<string, Warning>;

    if (babel.isAssignmentExpression(node)) {
      detectedType =
          getClosureType(node.right, jsdocAnn, sourceRange, this._document);
    } else {
      detectedType =
          getClosureType(node, jsdocAnn, sourceRange, this._document);
    }

    if (detectedType.successful) {
      type = detectedType.value;
    } else {
      warnings.push(detectedType.error);
      type = '?';
    }

    return {
      name,
      astNode:
          {language: 'js' as 'js', containingDocument: this._document, node},
      type,
      jsdoc: jsdocAnn,
      sourceRange,
      description,
      privacy,
      warnings,
      readOnly,
    };
  }

  private _createMethodFromExpression(
      name: string, node: babel.FunctionExpression|babel.MemberExpression,
      jsdocAnn: jsdoc.Annotation|undefined) {
    let description;
    let ret;
    const privacy = getOrInferPrivacy(name, jsdocAnn);
    const params = new Map<string, MethodParam>();

    if (jsdocAnn) {
      description = jsdoc.getDescription(jsdocAnn);
      ret = getReturnFromAnnotation(jsdocAnn);

      if (babel.isFunctionExpression(node)) {
        (node.params || []).forEach((nodeParam) => {
          const param = toMethodParam(nodeParam, jsdocAnn);
          params.set(param.name, param);
        });
      } else {
        for (const tag of (jsdocAnn.tags || [])) {
          if (tag.title !== 'param' || !tag.name) {
            continue;
          }
          let tagType;
          let tagDescription;
          if (tag.type) {
            tagType = doctrine.type.stringify(tag.type);
          }
          if (tag.description) {
            tagDescription = tag.description;
          }
          params.set(
              tag.name,
              {name: tag.name, type: tagType, description: tagDescription});
        }
      }
    }

    if (ret === undefined && babel.isFunctionExpression(node)) {
      ret = inferReturnFromBody(node);
    }

    return {
      name,
      type: ret !== undefined ? ret.type : undefined,
      description,
      sourceRange: this._document.sourceRangeForNode(node)!,
      warnings: [],
      astNode:
          {language: 'js' as 'js', containingDocument: this._document, node},
      jsdoc: jsdocAnn,
      params: Array.from(params.values()),
      return: ret,
      privacy
    };
  }
}

/**
 * Finds all classes and matches them up with their best jsdoc comment.
 */
class ClassFinder implements Visitor {
  readonly classes: ScannedClass[] = [];
  readonly warnings: Warning[] = [];
  private readonly alreadyMatched = new Set<babel.ClassExpression>();
  private readonly _document: JavaScriptDocument;

  constructor(document: JavaScriptDocument) {
    this._document = document;
  }

  enterAssignmentExpression(
      node: babel.AssignmentExpression, _parent: babel.Node, path: NodePath) {
    this.handleGeneralAssignment(
        astValue.getIdentifierName(node.left), node.right, path);
  }

  enterVariableDeclarator(
      node: babel.VariableDeclarator, _parent: babel.Node, path: NodePath) {
    if (node.init) {
      this.handleGeneralAssignment(
          astValue.getIdentifierName(node.id), node.init, path);
    }
  }

  /** Generalizes over variable declarators and assignment expressions. */
  private handleGeneralAssignment(
      assignedName: string|undefined, value: babel.Expression, path: NodePath) {
    const doc = jsdoc.parseJsdoc(esutil.getBestComment(path) || '');
    if (babel.isClassExpression(value)) {
      const name = assignedName ||
          value.id && astValue.getIdentifierName(value.id) || undefined;

      this._classFound(name, doc, value, path);
    } else {
      // TODO(justinfagnani): remove @polymerElement support
      if (jsdoc.hasTag(doc, 'customElement') ||
          jsdoc.hasTag(doc, 'polymerElement')) {
        this._classFound(assignedName, doc, value, path);
      }
    }
  }

  enterClassExpression(
      node: babel.ClassExpression, parent: babel.Node, path: NodePath) {
    // Class expressions may be on the right hand side of assignments, so
    // we may have already handled this expression from the parent or
    // grandparent node. Class declarations can't be on the right hand side of
    // assignments, so they'll definitely only be handled once.
    if (this.alreadyMatched.has(node)) {
      return;
    }

    const name = node.id ? astValue.getIdentifierName(node.id) : undefined;
    const comment = esutil.getAttachedComment(node) ||
        esutil.getAttachedComment(parent) || '';
    this._classFound(name, jsdoc.parseJsdoc(comment), node, path);
  }

  enterClassDeclaration(
      node: babel.ClassDeclaration, parent: babel.Node, path: NodePath) {
    const name = astValue.getIdentifierName(node.id);
    const comment = esutil.getAttachedComment(node) ||
        esutil.getAttachedComment(parent) || '';
    this._classFound(name, jsdoc.parseJsdoc(comment), node, path);
  }

  private _classFound(
      name: string|undefined, doc: jsdoc.Annotation, astNode: babel.Node,
      path: NodePath) {
    const namespacedName = name && getNamespacedIdentifier(name, doc);

    const warnings: Warning[] = [];
    const properties = extractPropertiesFromClass(astNode, this._document);
    const methods = getMethods(astNode, this._document);

    this.classes.push(new ScannedClass(
        namespacedName,
        name,
        {language: 'js', containingDocument: this._document, node: astNode},
        esutil.getCanonicalStatement(path),
        doc,
        (doc.description || '').trim(),
        this._document.sourceRangeForNode(astNode)!,
        properties,
        methods,
        getStaticMethods(astNode, this._document),
        this._getExtends(astNode, doc, warnings, this._document, path),
        jsdoc.getMixinApplications(
            this._document, astNode, doc, warnings, path),
        getOrInferPrivacy(namespacedName || '', doc),
        warnings,
        jsdoc.hasTag(doc, 'abstract'),
        jsdoc.extractDemos(doc)));
    if (babel.isClassExpression(astNode)) {
      this.alreadyMatched.add(astNode);
    }
  }

  /**
   * Returns the name of the superclass, if any.
   */
  private _getExtends(
      node: babel.Node, docs: jsdoc.Annotation, warnings: Warning[],
      document: JavaScriptDocument,
      path: NodePath): ScannedReference<'class'>|undefined {
    const extendsAnnotations =
        docs.tags!.filter((tag) => tag.title === 'extends');

    // prefer @extends annotations over extends clauses
    if (extendsAnnotations.length > 0) {
      const extendsId = extendsAnnotations[0].name;
      // TODO(justinfagnani): we need source ranges for jsdoc annotations
      const sourceRange = document.sourceRangeForNode(node)!;
      if (extendsId == null) {
        warnings.push(new Warning({
          code: 'class-extends-annotation-no-id',
          message: '@extends annotation with no identifier',
          severity: Severity.WARNING,
          sourceRange,
          parsedDocument: this._document
        }));
      } else {
        return new ScannedReference(
            'class', extendsId, sourceRange, undefined, path);
      }
    } else if (
        babel.isClassDeclaration(node) || babel.isClassExpression(node)) {
      // If no @extends tag, look for a superclass.
      const superClass = node.superClass;
      if (superClass != null) {
        let extendsId = getIdentifierName(superClass);
        if (extendsId != null) {
          if (extendsId.startsWith('window.')) {
            extendsId = extendsId.substring('window.'.length);
          }
          const sourceRange = document.sourceRangeForNode(superClass)!;
          return new ScannedReference(
              'class',
              extendsId,
              sourceRange,
              {
                language: 'js',
                node: node.superClass,
                containingDocument: document
              },
              path);
        }
      }
    }
  }
}

interface ElementDefineCall {
  tagName: TagNameExpression;
  class_: ElementClassExpression;
}

type ElementClassExpression = babel.ClassExpression|{
  type: 'MaybeChainedIdentifier';
  name: string, sourceRange: SourceRange
};

/** Finds calls to customElements.define() */
class CustomElementsDefineCallFinder implements Visitor {
  readonly warnings: Warning[] = [];
  readonly calls: ElementDefineCall[] = [];
  private readonly _document: JavaScriptDocument;

  constructor(document: JavaScriptDocument) {
    this._document = document;
  }

  enterCallExpression(node: babel.CallExpression) {
    const callee = astValue.getIdentifierName(node.callee);
    if (!(callee === 'window.customElements.define' ||
          callee === 'customElements.define')) {
      return;
    }

    const tagNameExpression = this._getTagNameExpression(node.arguments[0]);
    if (tagNameExpression == null) {
      return;
    }
    const elementClassExpression =
        this._getElementClassExpression(node.arguments[1]);
    if (elementClassExpression == null) {
      return;
    }
    this.calls.push(
        {tagName: tagNameExpression, class_: elementClassExpression});
  }

  private _getTagNameExpression(expression: babel.Node|
                                undefined): TagNameExpression|undefined {
    if (expression == null) {
      return;
    }
    const tryForLiteralString = astValue.expressionToValue(expression);
    if (tryForLiteralString != null &&
        typeof tryForLiteralString === 'string') {
      return {
        type: 'string-literal',
        value: tryForLiteralString,
        sourceRange: this._document.sourceRangeForNode(expression)!
      };
    }
    if (babel.isMemberExpression(expression)) {
      // Might be something like MyElement.is
      const isPropertyNameIs = (babel.isIdentifier(expression.property) &&
                                expression.property.name === 'is') ||
          (astValue.expressionToValue(expression.property) === 'is');
      const className = astValue.getIdentifierName(expression.object);
      if (isPropertyNameIs && className) {
        return {
          type: 'is',
          className,
          classNameSourceRange:
              this._document.sourceRangeForNode(expression.object)!
        };
      }
    }
    this.warnings.push(new Warning({
      code: 'cant-determine-element-tagname',
      message:
          `Unable to evaluate this expression down to a definitive string ` +
          `tagname.`,
      severity: Severity.WARNING,
      sourceRange: this._document.sourceRangeForNode(expression)!,
      parsedDocument: this._document
    }));
    return undefined;
  }

  private _getElementClassExpression(elementDefn: babel.Node|
                                     undefined): ElementClassExpression|null {
    if (elementDefn == null) {
      return null;
    }
    const className = astValue.getIdentifierName(elementDefn);
    if (className) {
      return {
        type: 'MaybeChainedIdentifier',
        name: className,
        sourceRange: this._document.sourceRangeForNode(elementDefn)!
      };
    }
    if (babel.isClassExpression(elementDefn)) {
      return elementDefn;
    }
    this.warnings.push(new Warning({
      code: 'cant-determine-element-class',
      message: `Unable to evaluate this expression down to a class reference.`,
      severity: Severity.WARNING,
      sourceRange: this._document.sourceRangeForNode(elementDefn)!,
      parsedDocument: this._document,
    }));
    return null;
  }
}

export function extractPropertiesFromClass(
    astNode: babel.Node, document: JavaScriptDocument) {
  const properties = new Map<string, ScannedProperty>();

  if (!babel.isClass(astNode)) {
    return properties;
  }

  const construct = astNode.body.body.find(
                        (member) => babel.isClassMethod(member) &&
                            member.kind === 'constructor') as babel.ClassMethod;

  if (construct) {
    const props = extractPropertiesFromConstructor(construct, document);
    for (const prop of props.values()) {
      properties.set(prop.name, prop);
    }
  }

  for (const prop of esutil
           .extractPropertiesFromClassOrObjectBody(astNode, document)
           .values()) {
    properties.set(prop.name, prop);
  }

  return properties;
}

function extractPropertyFromExpressionStatement(
    statement: babel.ExpressionStatement,
    document: JavaScriptDocument): ScannedProperty|null {
  let name;
  let astNode;
  let defaultValue;

  if (babel.isAssignmentExpression(statement.expression)) {
    // statements like:
    // /** @public The foo. */
    // this.foo = baz;
    name = getPropertyNameOnThisExpression(statement.expression.left);
    astNode = statement.expression.left;
    defaultValue = generate(statement.expression.right).code;
  } else if (babel.isMemberExpression(statement.expression)) {
    // statements like:
    // /** @public The foo. */
    // this.foo;
    name = getPropertyNameOnThisExpression(statement.expression);
    astNode = statement;
  } else {
    return null;
  }

  if (name === undefined) {
    return null;
  }

  const annotation = getJSDocAnnotationForNode(statement);
  if (!annotation) {
    return null;
  }

  return {
    name,
    astNode:
        {language: 'js' as 'js', containingDocument: document, node: astNode},
    type: getTypeFromAnnotation(annotation),
    default: defaultValue,
    jsdoc: annotation,
    sourceRange: document.sourceRangeForNode(astNode)!,
    description: jsdoc.getDescription(annotation),
    privacy: getOrInferPrivacy(name, annotation),
    warnings: [],
    readOnly: jsdoc.hasTag(annotation, 'const'),
  };
}

function extractPropertiesFromConstructor(
    method: babel.ClassMethod, document: JavaScriptDocument) {
  const properties = new Map<string, ScannedProperty>();

  for (const statement of method.body.body) {
    if (!babel.isExpressionStatement(statement)) {
      continue;
    }
    const prop = extractPropertyFromExpressionStatement(statement, document);
    if (!prop) {
      continue;
    }
    properties.set(prop.name, prop);
  }

  return properties;
}

function getJSDocAnnotationForNode(node: babel.Node) {
  const comment = esutil.getAttachedComment(node);
  const jsdocAnn =
      comment === undefined ? undefined : jsdoc.parseJsdoc(comment);

  if (!jsdocAnn || jsdocAnn.tags.length === 0) {
    // The comment only counts if there's a jsdoc annotation in there
    // somewhere.
    // Otherwise it's just an assignment, maybe to a property in a
    // super class or something.
    return undefined;
  }

  return jsdocAnn;
}

function getTypeFromAnnotation(jsdocAnn: jsdoc.Annotation): string|undefined {
  const typeTag = jsdoc.getTag(jsdocAnn, 'type');
  let type = undefined;

  if (typeTag && typeTag.type) {
    type = doctrine.type.stringify(typeTag.type);
  }

  return type;
}

function getPropertyNameOnThisExpression(node: babel.Node) {
  if (!babel.isMemberExpression(node) || node.computed ||
      !babel.isThisExpression(node.object) ||
      !babel.isIdentifier(node.property)) {
    return;
  }
  return node.property.name;
}
