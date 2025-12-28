export {};

declare global {
   function fetch(
      input: string,
      init?: {
         method?: string;
         headers?: Record<string, string>;
         body?: string | Buffer;
      }
   ): Promise<{
      ok: boolean;
      status: number;
      text(): Promise<string>;
      json(): Promise<unknown>;
   }>;
}
