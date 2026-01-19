import type { NitroApp } from 'nitropack';
import { configuration, httpLogger, useAuthRoutes, useOAuthRoutes, magicLinksRouter } from './main.js';
import type { Configuration } from '@internal/shared';

export function defineAuthConfiguration(nitro: NitroApp, config: Configuration) {
    try {
        configuration(config);
        httpLogger()(nitro.h3App);
        useAuthRoutes(nitro.router);
        useOAuthRoutes(nitro.router);
        magicLinksRouter(nitro.router, 'api');
        console.log('[Auth] initialized successfully!');
    } catch (err) {
        throw err;
    }
}