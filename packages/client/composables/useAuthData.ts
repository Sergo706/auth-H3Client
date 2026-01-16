import { useState, useRequestHeaders } from 'nuxt/app';
import type { Ref } from 'vue';
import { $fetch } from 'ofetch';

export interface AuthState {
    id?: string;    
    authorized: boolean;
    mfaRequired: boolean;
    message?: string;
}

export interface ServerResponse {
    authorized: boolean,
    userId?: string,
    reason?: string,
    ipAddress: string,
    userAgent:  string,
    date: string,
    roles?: string[] | string;
    error?: string
    message?: string
}

let activeAuthRequest: Promise<void> | null = null;

export const useAuthData = async (authStatusUrl = '/users/authStatus'): Promise<Ref<AuthState>> => {
  const authorized = useState<AuthState>('auth', () => ({ authorized: false, mfaRequired: false }));
  const headers = useRequestHeaders();

  if (activeAuthRequest) {
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
        activeAuthRequest = null;
      }
  };

  activeAuthRequest = performCheck();
  await activeAuthRequest;
  return authorized;
};