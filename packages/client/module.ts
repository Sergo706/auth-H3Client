import { defineNuxtModule, addImports, addServerHandler, addServerPlugin, addServerImports, resolvePath } from '@nuxt/kit';
import { serverImports } from './presets/serverImports.js';

export interface ModuleOptions  {
  /**
   * Enable the auth server middleware (CSRF, bot detection, IP validation)
   * @default true
   */
  enableMiddleware?: boolean;
    /**
   * default auth status url to use
   * @default '/auth/users/authStatus'
   */
  authStatusUrl?: string;
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
    authStatusUrl: '/auth/users/authStatus'
  },
  async setup(options, nuxt) {

    addImports([
      {
        name: 'useAuthData',
        from: 'auth-h3client/client'
      },
      {
        name: 'getCsrfToken',
         from: 'auth-h3client/client'
      },
      {
        name: 'AuthBase',
        from: 'auth-h3client/client'
      }
    ]);

    addServerImports([...serverImports]);

    if (options.enableMiddleware !== false) {
      addServerHandler({
        middleware: true,
        handler: await resolvePath('auth-h3client/server/middleware')
      });
      addServerHandler({
        middleware: false,
        handler: await resolvePath('auth-h3client/server/routes/authStatus'),
        method: 'get',
        route: options.authStatusUrl,
      });
    }

  }
});
