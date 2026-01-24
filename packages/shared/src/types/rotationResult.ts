export interface RotationSuccess {
    type: 'both';
    newToken: string;
    newRefresh: string;
    accessIat: string;
    rawSetCookie: string[];
}
export interface AccessRotationSuccess {
    type: 'access';
    newToken: string;
    accessIat: string;
}

export interface RefreshRotationSuccess {
    type: 'refresh';
    newRefresh: string;
    rawSetCookie: string[];
}

export interface RotationError {
    error: string;
}

export interface RotationMfa {
    text: string;
    message: string;
}

export type AccessRotationResult = AccessRotationSuccess | RotationError | RotationMfa | undefined;
export type RefreshRotationResult = RefreshRotationSuccess | RotationError | RotationMfa | undefined;
export type RotationResult = RotationSuccess | RotationError | RotationMfa | undefined;
