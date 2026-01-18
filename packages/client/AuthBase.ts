import { type AuthState, useAuthData } from "./composables/useAuthData.js";
import { $fetch, FetchOptions, type $Fetch } from 'ofetch';

/**
 * Base class for authenticated API services.
 * Provides methods to wait for auth state and make authenticated fetch requests.
 * Extend this class to create API service classes with auth-aware data fetching.
 * 
 * @example
 * class ProfilesApi extends AuthBase {
 *   async getProfile(id: number) {
 *     const auth = await this.waitForAuth();
 *     if (!auth.authorized) return { ok: false };
 *     return this.authFetch<Profile>(`/api/profiles/${id}`);
 *   }
 * }
 */
export default class AuthBase {
    protected headers: Record<string, string>;

    constructor(headers: Record<string, string> = {}) {
        this.headers = headers;
    }

    /**
     * Waits for the authentication singleton lock to resolve.
     * Returns the current auth state (authorized, userId, mfaRequired).
     * Safe to call multiple times - uses singleton pattern with zero extra network requests.
     * 
     * @returns The current authentication state.
     * 
     * @example
     * const auth = await this.waitForAuth();
     * if (!auth.authorized) return { error: 'Not logged in' };
     */
    public async waitForAuth(): Promise<AuthState> {
        const authRef = await useAuthData();
        return authRef.value;
    }

    /**
     * Makes an authenticated fetch request with pre-configured headers.
     * Waits for auth state before sending the request.
     * 
     * @overload When `prefix` is `true`, returns a configured `$Fetch` instance for a base URL.
     * @overload When `prefix` is `false` or omitted, makes a direct request and returns the response data.
     * 
     * @param url - The URL to fetch or base URL for prefix mode.
     * @param prefix - If `true`, returns a `$Fetch` instance configured with `url` as baseURL.
     * @param options - Optional fetch options (query, body, headers, etc.).
     * @returns The response data or a configured fetcher instance.
     * 
     * @example
     * // Direct request
     * const data = await this.authFetch<User>('/api/user/me');
     * 
     * // Prefix mode - create a scoped API client
     * const api = await this.authFetch('/api/users', true);
     * const user = await api<User>('/123');
     */
    public async authFetch(url: string, prefix: true, options?: FetchOptions): Promise<$Fetch>;
    public async authFetch<T>(url: string, prefix?: false, options?: FetchOptions): Promise<T>;
    public async authFetch<T>(url: string, prefix?: boolean, options?: FetchOptions): Promise<T | $Fetch> {
        await this.waitForAuth();
     
        if (prefix) {
            return $fetch.create({
                baseURL: url,
                ...options,
                headers: {
                    ...this.headers,
                    ...options?.headers
                }
            });
        }

        return $fetch(url, {
            ...options,
            headers: {
                ...this.headers,
                ...options?.headers
            }
        }) as Promise<T>;
    }
}