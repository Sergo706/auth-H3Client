import { type AuthState, useAuthData } from "./composables/useAuthData.js";
import { $fetch, FetchOptions, type $Fetch } from 'ofetch';

export default class AuthBase {
    protected headers: Record<string, string>;

    constructor(headers: Record<string, string> = {}) {
        this.headers = headers;
    }

    public async waitForAuth(): Promise<AuthState> {
        const authRef = await useAuthData();
        return authRef.value;
    }

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