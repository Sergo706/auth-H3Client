import { defineNuxtModule, addImports, addServerHandler, addServerPlugin, addServerImports, resolvePath } from '@nuxt/kit';
import { serverImports } from './presets/serverImports.js';

export interface ModuleOptions  {
  /**
   * Enable the auth server middleware (CSRF, bot detection, IP validation)
   * @default true
   */
  enableMiddleware?: boolean;
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
    enableMiddleware: true
  },
  async setup(options, nuxt) {
    nuxt.options.runtimeConfig.authH3Client = {
    };

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
    }

  }
});
