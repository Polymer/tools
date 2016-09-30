declare module 'command-line-args' {
  function commandLineArgs(args: commandLineArgs.ArgDescriptor[]): any;

  module commandLineArgs {
    interface ArgDescriptor {
      name: string;
      alias?: string;
      description?: string;
      defaultValue?: any;
      type?: Object;
      multiple?: boolean;
      defaultOption?: boolean;
    }
  }

  export = commandLineArgs;
}
