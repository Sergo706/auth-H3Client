import { useState, useRequestHeaders, useFetch, useNuxtApp } from 'nuxt/app';
import type { Ref } from 'vue';
import type { ServerResponse } from "@internal/shared";
import { appendResponseHeader } from 'auth-h3client/v1';

export interface AuthState {
    id?: string;    
    authorized: boolean;
    mfaRequired: boolean;
    message?: string;
}


/**
 * Composable that checks and returns the current authentication state.
 * Implements a singleton pattern - multiple simultaneous calls result in only one network request.
 * Updates the global `useState('auth')` reactive reference.
 * 
 * @param authStatusUrl - Optional custom endpoint URL for auth status check. Defaults to '/users/authStatus'.
 * @returns {Promise<Ref<AuthState>>} A promise that resolves to a reactive ref containing the authentication state.
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

      try {
         await useFetch<ServerResponse | Omit<AuthState, 'authorized'>>(authStatusUrl, {
          key: `auth-data-${authStatusUrl}`,
          method: 'GET',
          headers: {
            ...headers,
            'Accept': 'application/json',
          },
          timeout: 5000,
          ignoreResponseError: true,
          retry: false,

          getCachedData: (key, nuxtApp) => {
                if (nuxtApp.isHydrating) {
                 return nuxtApp.payload.data[key];
             }
              return undefined; 
          },

          onResponse ({ response }) {
            const json = response._data;

            if (import.meta.server) {
                const nuxtApp = useNuxtApp();
                const cookies = response.headers.getSetCookie();
                const event = nuxtApp.ssrContext?.event;
                if (event) {
                    appendResponseHeader(event, 'set-cookie', cookies);
                }
            }
            if (!json || response.status === 401) {
                authorized.value = { 
                    authorized: false,
                    mfaRequired: false 
                };
                  return;
            }
            if(response.status === 202 && 'text' in json) {
               const mfaMsg = json.message ?? 
                        (json.text ? 'Multi factor authentication is required. Please check your email to continue.' : 'Security check required.');
                authorized.value = {
                    authorized: false,
                    mfaRequired: true,
                    message: mfaMsg
                };
                return;
            }
            if (response.status === 200 && 'authorized' in json) {
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
            return;
        },
        onResponseError() {
            authorized.value = { 
                authorized: false, 
                mfaRequired: false 
            };
            return;
        }
        });
        
      } catch (err) {
        console.error("Auth check failed:", err);
        authorized.value = { 
            authorized: false, 
            mfaRequired: false 
        };
      } 
        return authorized;
  };
