import { defineNuxtModule, addImports, createResolver, addServerHandler, addServerPlugin, addServerImports } from '@nuxt/kit';
import type { Configuration } from '@internal/shared';
import { serverImports } from './presets/serverImports.js';

export interface ModuleOptions extends Configuration {
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
  setup(options, nuxt) {

    nuxt.options.runtimeConfig.authH3Client = {
      ...options
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
        handler: 'auth-h3client/server/middleware'
      });
    }

    addServerPlugin('auth-h3client/server/plugin');
  }
});
