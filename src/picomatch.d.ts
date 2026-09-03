declare module "picomatch" {
  export interface PicomatchOptions {
    readonly dot?: boolean;
    readonly nocase?: boolean;
  }
  export default function picomatch(pattern: string, options?: PicomatchOptions): (input: string) => boolean;
}
