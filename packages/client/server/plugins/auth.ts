import type { NitroApp } from 'nitropack';
import { configuration, httpLogger, useAuthRoutes, useOAuthRoutes, magicLinksRouter } from 'auth-h3client/v1';
import { defineNitroPlugin, useRuntimeConfig, useStorage } from 'nitropack/runtime/index';

/**
 * Nitro plugin that initializes auth routes and middleware.
 * Configuration is read from runtimeConfig.authH3Client which is set by the module.
 */
export default defineNitroPlugin((nitro: NitroApp) => {
  try {
    const config = useRuntimeConfig();
    const {enableMiddleware, ...authConfig} = config.authH3Client;
    
    if (!authConfig) {
      console.error('[auth] No authH3Client config found in runtimeConfig');
      return;
    }

    const fullConfig = {
      ...authConfig,
      uStorage: {
        storage: useStorage('cache'),
        cacheOptions: authConfig.cacheOptions ?? {
          successTtl: 60 * 60 * 24 * 30,
          rateLimitTtl: 10
        }
      }
    };

    configuration(fullConfig);
    httpLogger()(nitro.h3App);
    useAuthRoutes(nitro.router);
    useOAuthRoutes(nitro.router);
    magicLinksRouter(nitro.router, 'api');
    
    console.log('[auth] started');
  } catch (e) {
    console.error('[auth] failed to start', e);
  }
});
