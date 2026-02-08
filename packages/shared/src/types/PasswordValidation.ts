
/**
 * Interface for the expected response from the auth server login endpoint.
 */
export interface AuthServerLoginResponse {
    accessToken: string;
    accessIat: number;
}
