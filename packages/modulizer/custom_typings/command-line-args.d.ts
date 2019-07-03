declare module 'command-line-args' {
  module commandLineArgs {
    interface OptionDefinition {
      name: string;
      alias?: string;
      type?: any;
      multiple?: boolean;
      defaultOption?: boolean;
      defaultValue?: any;
      description?: string;
    }
  }

  function commandLineArgs(
      options: commandLineArgs.OptionDefinition[],
      argv?: string[]): {[name: string]: any};

  export = commandLineArgs;
}
