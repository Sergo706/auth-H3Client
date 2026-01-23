export interface RotationSuccess {
    newToken: string;
    newRefresh: string;
    accessIat: string;
    rawSetCookie: string[];
}

export interface RotationError {
    error: string;
}

export interface RotationMfa {
    text: string;
    message: string;
}

export type RotationResult = RotationSuccess | RotationError | RotationMfa | undefined;
