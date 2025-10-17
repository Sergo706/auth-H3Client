export interface ResponseSign {
    inputError: object;
    accessToken: string;
    accessIat: string;
    banned: boolean;
    error?: object;
    ok: boolean;
    receivedAt: string;
}