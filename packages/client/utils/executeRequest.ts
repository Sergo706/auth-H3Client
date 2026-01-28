import { $fetch, type FetchOptions } from "ofetch";
import { getCsrfToken } from "./getCsrfToken.js";
import { appendResponseHeader} from "auth-h3client/v1";
import { type Results } from "@internal/shared";
import { useRequestEvent, useRequestHeaders } from "nuxt/app";

/**
 * Executes a network request to an internal or external API, handling authentication,
 * CSRF protection, and server-side cookie propagation.
 * 
 * @template T The expected type of the response data.
 * @param url The endpoint URL to fetch.
 * @param method The HTTP method to use (GET, POST, etc.).
 * @param body Optional request body. usage depends on method (query for GET, body for POST).
 * @param customHeaders Optional headers to append to the request.
 * @param customOptions Additional options to pass to `$fetch`.
 * @returns {Promise<Results<T>>} A promise resolving to a standardized `Results` object.
 * 
 * @description
 * - **Client Side**: Auto-injects `X-CSRF-Token` if available.
 * - **Server Side**: Auto-proxies headers from the incoming request (including cookies/auth tokens).
 * - **Cookie Propagation**: Captures `Set-Cookie` headers from the API response and
 *   forwards them to the client browser (important for token rotation).
 */
export async function executeRequest<T>(
    url: string,
    method: "GET" | "POST" | "DELETE" | "PUT" | "PATCH", 
    body?: object, 
    customHeaders: Record<string, string> = {},
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
    
        const results = await $fetch.raw<Results<T>>(url, {
            method,
            timeout: 15000,
            ignoreResponseError: true,
            ...dataType,
            headers,
            ...customOptions
        });
        const event = useRequestEvent()
        if (import.meta.server) {
            const cookies = results.headers.getSetCookie();
            if (cookies && cookies.length > 0 && event) {
                for (const cookie of cookies) {
                    appendResponseHeader(event, 'set-cookie', cookie);
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