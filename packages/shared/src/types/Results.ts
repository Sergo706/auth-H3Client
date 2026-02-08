export interface Success<T>  {
    ok: true,
    date: string,
    data: T
}
export interface ApiError  {
    ok: false,
    date: string,
    reason: string,
}
export type AppCode = 
'AUTH_REQUIRED' | 
 'SERVER_ERROR' | 
 'TEMPERING' | 
 'FORBIDDEN' | 
 'AUTH_SERVER_ERROR' | 
 'AUTH_CLIENT_ERROR' |
 'MISSING_BODY' |
 'INVALID_CREDENTIALS' |
 'INVALID_CONTENT_TYPE' |
 'NOT_FOUND' |
 (string & {})
 
 export type Results<T = unknown> = Success<T> | ApiError;
 /**
 * Extended results type for password validation.
 * Uses intersection to add extra fields to the base Results type.
 */

export type UtilsResponse<T> = Results<T> & {
    code?: AppCode;
    retryAfter?: string | null;
};

