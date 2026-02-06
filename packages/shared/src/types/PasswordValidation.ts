import type { Results } from "./Results.js";

/**
 * Interface for the expected response from the auth server login endpoint.
 */
export interface AuthServerLoginResponse {
    accessToken: string;
    accessIat: number;
}

/**
 * Extended results type for password validation.
 * Uses intersection to add extra fields to the base Results type.
 */
export type ValidatePasswordResults = Results<'Allowed'> & {
    code?: string;
    retryAfter?: string | null;
};
