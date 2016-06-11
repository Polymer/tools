declare module 'fs-extra' {
  export function copySync(source: string, dest: string): void;
  export function readdirSync(path: string): string;
}
