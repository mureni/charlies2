// NOTE: Temporary ambient type until TypeScript ships RegExp.escape in its standard lib typings.
export {};

declare global {
   interface RegExpConstructor {
      escape(pattern: string): string;
   }
}
