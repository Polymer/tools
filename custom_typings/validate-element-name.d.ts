declare module 'validate-element-name' {
  interface ValidationResult {
    isValid: boolean,
    message: string
  }

  function validate(name: string): ValidationResult

  export = validate;
}