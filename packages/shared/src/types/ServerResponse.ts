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
