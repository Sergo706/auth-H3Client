import { type AuthState, useAuthData } from "./composables/useAuthData.js";
import { $fetch } from 'ofetch';

export default class AuthBase {
    protected headers: Record<string, string>;

    constructor(headers: Record<string, string> = {}) {
        this.headers = headers;
    }

    public async waitForAuth(): Promise<AuthState> {
        const authRef = await useAuthData();
        return authRef.value;
    }

    public async authFetch<T>(url: string, options: any = {}): Promise<T> {
        await this.waitForAuth();

        return $fetch<T>(url, {
            ...options,
            headers: {
                ...this.headers,
                ...options.headers
            }
        });
    }
}