import { $fetch, type FetchResponse, type FetchOptions } from "ofetch";
import { getCsrfToken } from "./getCsrfToken.js";
import { appendResponseHeader, H3Event} from "auth-h3client/v1";
import { type Results } from "@internal/shared";
import type { $Fetch, NitroFetchRequest, H3Event$Fetch } from "nitropack";

export interface ApiContext {
    fetcher?: H3Event$Fetch | $Fetch<unknown, NitroFetchRequest>
    event?: H3Event | undefined;
    headers?: Record<string, string>;
}
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
 * 
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
    customOptions: FetchOptions<'json'> = {},
    context: ApiContext = {}
): Promise<Results<T>> {
    try {
        const dataType = method === "GET" ? {query: body} : {body: body};
        let token;
        let upstreamResponse: FetchResponse<Results<T>> | undefined;
        const fetcher = (context.fetcher ?? $fetch) as H3Event$Fetch | $Fetch<unknown, NitroFetchRequest>;
        const event = context.event;
        if (import.meta.client) {
             token = getCsrfToken();
        }
        

        const headers: Record<string, string> = {
            ...customHeaders,
        };

        if (import.meta.client && token) {
            headers['X-CSRF-Token'] = token;
        }

        if (import.meta.server && context.headers) {
            Object.assign(headers, context.headers);
        }
        

        const results = await fetcher<Results<T>>(url, {
            method,
            timeout: 15000,
            ignoreResponseError: true,
            ...dataType,
            headers,
            ...customOptions,

            onResponse({ response }: { response: FetchResponse<Results<T>> }) {
                upstreamResponse = response;
                if (import.meta.server) {
                    const cookies = response.headers.getSetCookie();
                    if (cookies && cookies.length > 0 && event) {
                        for (const cookie of cookies) {
                            appendResponseHeader(event, 'set-cookie', cookie);
                        }
                    }
                }
            }
        });
        

        if (!upstreamResponse) {
             return { 
                ok: false,
                date: new Date().toISOString(), 
                reason: 'Server Error. No response captured.' 
            };
        }

        const json = results;

        if (!upstreamResponse.ok && upstreamResponse.status !== 200) {
             return { 
                ok: false,
                date: new Date().toISOString(), 
                reason: `Server Error. Status ${upstreamResponse.status}.`
            };
        }

        if (!json) return { 
             ok: false,
             date: new Date().toISOString(),
            reason: 'Server Error. Empty response body.' 
        };

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