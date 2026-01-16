    
   export interface ServerAccessTokenMetaData {
        authorized: boolean,
        ipAddress: string,
        userAgent: string,
        date: string,
        roles: string[] | string,
        msUntilExp: number,
        refreshThreshold: number,
        shouldRotate: boolean,
        payload: {
            [key: string]: any;
            iss?: string | undefined;
            sub?: string | undefined;
            aud?: string | string[] | undefined;
            exp?: number | undefined;
            nbf?: number | undefined;
            iat?: number | undefined;
            jti?: string | undefined;
        }
    }
    
    export interface ServerRefreshTokenMetaData {
        authorized: boolean,
        ipAddress: string,
        userAgent: string,
        date: string,
        msUntilExp: number,
        refreshThreshold: number,
        shouldRotate: boolean,
        msUntilSessionMaxLife: number
    }
    