declare module 'validate-element-name' {
  type ValidationResult = {
    isValid: false,
    message: string,
  }|{
    isValid: true;
    message: undefined|string;
  };

  function validate(name: string): ValidationResult

  export = validate;
}
