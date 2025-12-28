declare module "app-root-path" {
   interface AppRootPath {
      path: string;
      resolve(path?: string): string;
   }

   const appRootPath: AppRootPath;
   export = appRootPath;
}
