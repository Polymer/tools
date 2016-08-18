// Taken from https://github.com/tdegrunt/jsonschema/blob/master/lib/index.d.ts
// until jsonschema >1.1.0 is released which will have this natively.
// That repository is licensed under the MIT license, available at:
// https://github.com/tdegrunt/jsonschema/blob/master/LICENSE

declare module 'jsonschema' {
  export class Validator {
    constructor();
    customFormats: CustomFormat[];
    schemas: {[id: string]: Schema};
    unresolvedRefs: string[];

    attributes: {[property: string]: CustomProperty};

    addSchema(schema?: Schema, uri?: string): Schema|void;
    validate(
        instance: any, schema: Schema, options?: Options,
        ctx?: SchemaContext): ValidatorResult;
  }

  export class ValidatorResult {
    constructor(
        instance: any, schema: Schema, options: Options, ctx: SchemaContext)
    instance: any;
    schema: Schema;
    propertyPath: string;
    errors: ValidationError[];
    throwError: boolean;
    disableFormat: boolean;
    valid: boolean;
    addError(detail: string|ErrorDetail): ValidationError;
    toString(): string;
  }

  export class ValidationError {
    constructor(
        message?: string, instance?: any, schema?: Schema, propertyPath?: any,
        name?: string, argument?: any);
    property: string;
    message: string;
    schema: string|Schema;
    instance: any;
    name: string;
    argument: any;
    toString(): string;
  }

  export class SchemaError extends Error {
    constructor(msg: string, schema: Schema);
    schema: Schema;
    message: string;
  }

  export function validate(
      instance: any, schema: any, options?: Options): ValidatorResult

  export interface Schema {
    id?: string
    $schema?: string
    title?: string
    description?: string
    multipleOf?: number
    maximum?: number
    exclusiveMaximum?: boolean
    minimum?: number
    exclusiveMinimum?: boolean
    maxLength?: number
    minLength?: number
    pattern?: string
    additionalItems?: boolean|Schema
    items?: Schema|Schema[]
    maxItems?: number
    minItems?: number
    uniqueItems?: boolean
    maxProperties?: number
    minProperties?: number
    required?: string[]
    additionalProperties?: boolean|Schema
    definitions?: {[name: string]: Schema};
    properties?: {[name: string]: Schema};
    patternProperties?: {[name: string]: Schema};
    dependencies?: {[name: string]: Schema | string[]};
    'enum'?: any[]
    type?: string|string[]
    allOf?: Schema[]
    anyOf?: Schema[]
    oneOf?: Schema[]
    not?: Schema
  }

  export interface Options {
    skipAttributes?: string[];
    allowUnknownAttributes?: boolean;
    rewrite?: RewriteFunction;
    propertyName?: string;
    base?: string;
  }

  export interface RewriteFunction {
    (instance: any, schema: Schema, options: Options, ctx: SchemaContext): any;
  }

  export interface SchemaContext {
    schema: Schema;
    options: Options;
    propertyPath: string;
    base: string;
    schemas: {[base: string]: Schema};
  }

  export interface CustomFormat { (input: any): boolean; }

  export interface CustomProperty {
    (instance: any, schema: Schema, options: Options,
     ctx: SchemaContext): string|ValidatorResult;
  }

  export interface ErrorDetail {
    message: string;
    name: string;
    argument: string;
  }
}
