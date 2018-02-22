declare module 'whatwg-url' {
  export class URL {
    protocol: string;
    pathname: string;

    constructor(url: string);
  }
}
