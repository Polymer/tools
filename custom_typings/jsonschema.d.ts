declare module 'jsonschema' {
  interface ValidationResult {
    disableFormat: boolean;
    errors: ValidationError[];
    instance: any;
    propertyPath: string;
    schema: any;
    throwError: any;
  }
  interface ValidationError {
    argument: string;
    instance: any;
    message: string;
    name: string;
    property: string;
    schema: any;
    stack: string;
  }
  export class Validator {
    validate(instance: any, schema: any): ValidationResult;
  }
}
