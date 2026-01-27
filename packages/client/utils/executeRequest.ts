// import { $fetch, type FetchOptions } from "ofetch";
import { getCsrfToken } from "./getCsrfToken.js";
import { appendResponseHeader, type H3Event } from "auth-h3client/v1";
import { type Results } from "@internal/shared";
import { useNuxtApp, useRequestHeaders } from "nuxt/app";

export async function executeRequest<T>(
    url: string,
    method: "GET" | "POST" | "DELETE" | "PUT" | "PATCH", 
    body?: object, 
    customHeaders: Record<string, string> = {},
    // @ts-ignore
    customOptions: FetchOptions<'json'> = {}
): Promise<Results<T>> {
    try {
        const dataType = method === "GET" ? {query: body} : {body: body};
        let token;
        
        if (import.meta.client) {
             token = getCsrfToken();
        }
        

        const headers: Record<string, string> = {
            ...customHeaders,
            'X-Forwarded-For': customHeaders['x-forwarded-for'] ?? '127.0.0.1',
        };

        if (import.meta.client && token) {
            headers['X-CSRF-Token'] = token;
        }

      
        if (import.meta.server) {
            const reqHeaders = useRequestHeaders();
            Object.assign(headers, reqHeaders);
        }
        // @ts-ignore
        const results = await $fetch.raw<Results<T>>(url, {
            method,
            timeout: 15000,
            ignoreResponseError: true,
            ...dataType,
            headers,
            ...customOptions
        });

        if (import.meta.server) {
            const cookies = results.headers.getSetCookie();
            if (cookies && cookies.length > 0) {
                const nuxtApp = useNuxtApp();
                const event = nuxtApp.ssrContext?.event as unknown as H3Event;
                if (event) {
                    appendResponseHeader(event, 'set-cookie', cookies);
                }
            }
        }

        const json = results._data;

        if (!json) return { 
             ok: false,
             date: new Date().toISOString(),
            reason: 'Server Error. Empty response.' 
        };

        if (!results.ok || results.status !== 200) {
             return { 
                ok: false,
                date: new Date().toISOString(), 
                reason: 'Server Error. Status not 200.' 
            };
        }

        if ('ok' in json && !json.ok) {
             return json as Results<T>;
        }

        return json;

    } catch (err) {
        return {
            ok: false,
            date: new Date().toISOString(),
            reason: err instanceof Error ? err.message : JSON.stringify(err)
        };
    }
}