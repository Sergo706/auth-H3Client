import { useState, useRequestHeaders, useRequestFetch } from 'nuxt/app';
import type { Ref } from 'vue';
import type { ServerResponse } from "@internal/shared";

export interface AuthState {
    id?: string;    
    authorized: boolean;
    mfaRequired: boolean;
    message?: string;
}


let activeAuthRequest: Promise<void> | null = null;

/**
 * Composable that checks and returns the current authentication state.
 * Implements a singleton pattern - multiple simultaneous calls result in only one network request.
 * Updates the global `useState('auth')` reactive reference.
 * 
 * @param authStatusUrl - Optional custom endpoint URL for auth status check. Defaults to '/users/authStatus'.
 * @returns A reactive ref containing the authentication state.
 * 
 * @example
 * // In app.vue or middleware
 * const auth = await useAuthData();
 * if (!auth.value.authorized) {
 *   navigateTo('/login');
 * }
 * 
 * @example
 * // With custom endpoint
 * const auth = await useAuthData('/api/custom-auth-check');
 */
export const useAuthData = async (authStatusUrl = '/users/authStatus'): Promise<Ref<AuthState>> => {
  const authorized = useState<AuthState>('auth', () => ({ authorized: false, mfaRequired: false }));
  const headers = useRequestHeaders();
  const $fetch = useRequestFetch();

  if (import.meta.client && activeAuthRequest) {
      await activeAuthRequest;
      return authorized;
  }

  const performCheck = async () => {
      try {
        const res = await $fetch.raw<ServerResponse | Omit<AuthState, 'authorized'>>(authStatusUrl, {
          method: 'GET',
          headers: {
            ...headers,
            'Accept': 'application/json',
          },
          timeout: 5000,
          ignoreResponseError: true
        });
        
        const json = res._data;

        if (!json || res.status === 401) {
            authorized.value = { 
                authorized: false,
                mfaRequired: false 
            };
            return;
        }
        if (res.status === 202 && 'text' in json) {
            const mfaMsg = json.message ?? 
                        (json.text ? 'Multi factor authentication is required. Please check your email to continue.' : 'Security check required.');
                authorized.value = {
                    authorized: false,
                    mfaRequired: true,
                    message: mfaMsg
                };
                return;
       }

        if (res.status === 200 && 'authorized' in json) {
                authorized.value = {
                    id: json.userId,
                    authorized: json.authorized,
                    mfaRequired: false
                };
                return;
        }

        authorized.value = { 
            authorized: false,
            mfaRequired: false 
        };

      } catch (err) {
        console.error("Auth check failed:", err);
        authorized.value = { 
            authorized: false, 
            mfaRequired: false 
        };
      } finally {
       if (import.meta.client) {
            activeAuthRequest = null;
        }
      }
  };

  const requestPromise = performCheck();

  if (import.meta.client) {
      activeAuthRequest = requestPromise;
  }

  await requestPromise;
  return authorized;
};