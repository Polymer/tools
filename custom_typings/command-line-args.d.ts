declare module 'command-line-args' {

  module commandLineArgs {

    interface OptionDefinition {
      name: string;
      alias?: string;
      type?: any;
      multiple?: boolean;
      defaultOption?: boolean;
      defaultValue?: any;
    }

  }

  function commandLineArgs(options: OptionDefinition[], argv?: string[])
      : {[name: string]: any};

  export = commandLineArgs;
}
