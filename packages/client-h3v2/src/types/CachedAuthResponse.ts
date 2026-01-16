import type { ServerResponse } from "./ServerResponse.js";

export type CachedAuthResponse = {
    type: 'SUCCESS';
    data: ServerResponse;
} | {
    type: 'ERROR';
    status: number;
    reason: 'SERVER_ERROR' | 'RATE_LIMIT' | 'MFA' | 'DETAILED_SERVER_ERROR' | 'UNAUTHORIZED';
    msg: string;
    retryAfter?: number; 
};

export interface CacheOptions {
  successTtl?: number;
  rateLimitTtl?: number;
}