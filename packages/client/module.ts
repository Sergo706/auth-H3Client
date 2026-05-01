import { defineNuxtModule, addImports, addServerHandler, addServerImports,resolvePath } from '@nuxt/kit';
import { serverImports } from './presets/serverImports.js';

export interface ModuleOptions  {
  /**
   * Enable the auth server middleware (CSRF, bot detection, IP validation)
   * @default true
   */
  enableMiddleware?: boolean;
    /**
   * default auth status url to use
   * @default '/api/auth/users/authStatus'
   */
  authStatusUrl?: string;
  /**
   * The `getApiListsController` route configuration option. disabled if omitted
   */
  registerApiRoute?: {
    /**
     * The path the controller will be registered on.
     */
    path: string
  }
}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'auth-h3client',
    configKey: 'authH3Client',
    compatibility: {
      nuxt: '^3.0.0 || ^4.2.2'
    }
  },
  defaults: {
    enableMiddleware: true,
    authStatusUrl: '/api/auth/users/authStatus'
  },
  async setup(options, nuxt) {

    addImports([
      {
        name: 'useAuthData',
        from: '@riavzon/auth-h3client/client'
      },
      {
        name: 'getCsrfToken',
        from: '@riavzon/auth-h3client/client'
      },
      {
        name: 'executeRequest',
        from: '@riavzon/auth-h3client/client'
      },
      {
       name: 'useMagicLink',
       from: '@riavzon/auth-h3client/client'
      }
    ]);

    addServerImports([...serverImports]);

    if (options.enableMiddleware !== false) {
      addServerHandler({
        middleware: true,
        handler: await resolvePath('@riavzon/auth-h3client/server/middleware')
      });
    }
    
    addServerHandler({
      middleware: false,
      handler: await resolvePath('@riavzon/auth-h3client/server/auth-status'),
      method: 'get',
      route: options.authStatusUrl,
    });

    if(options.registerApiRoute) {
       addServerHandler({
          middleware: false,
          handler: await resolvePath('@riavzon/auth-h3client/server/api-lists'),
          method: 'get',
          route: options.registerApiRoute.path,
       });
    }

  }
});
