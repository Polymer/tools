// https://github.com/bower/spec/blob/master/json.md
export interface BowerConfig {
  name: string;
  description?: string;
  version?: string;
  main?: string|string[];
  license?: string|string[];
  ignore?: string[];
  keywords?: string[];
  authors?: Array<BowerPerson|string>;
  author?: string;
  homepage?: string;
  repository?: {type: string, url: string};
  dependencies?: {[pkg: string]: string};
  devDependencies?: {[pkg: string]: string};
  resolutions?: {[pkg: string]: string};
  private?: boolean;
}

export interface BowerPerson {
  name?: string;
  email?: string;
  homepage?: string;
}
