import { Results } from "./Results.js";

export interface TokenMeta {
    name?: string;
    tokenId?: number;
    userId?: number;
    createdAt?: string;
    expiresAt?: string;
    lastUsed?: string;
    usageCount?: number;
    providedPrivilege?: "demo" | "restricted" | "protected" | "full" | "custom" | undefined;
}

export interface SingleTokenMeta {
    tokenMeta: TokenMeta,
    counts: {
       totalInvalidTokens: number;
       totalValidTokens: number;
       total: number;
    }
}
export interface TokenList {
    id: number,
    name: string,
    created_at: string,
    expires_at: string,
    restricted_to_ip_address: string[] | null
    public_identifier: string,
    last_used: string,
    usage_count: number,
    privilege_type: 'demo' | 'restricted' | 'protected' | 'full' | 'custom',
}

export interface AllValidTokensList {
    total: number,
    totalInvalidTokens: number,
    totalValidTokens: number,
    tokenList?: TokenList[]
}


export interface ApiTokenRotationSuccess {
     msg: string;
     newRawToken: string | undefined,
     newExpiry: Date | null
}

export interface CreationSuccess {
     rawApiKey: string | undefined,
     expiresAt: Date | null
}

export interface VerifySuccessResponse {
        name: string;
        tokenId: number;
        userId: number;
        createdAt: string;
        expiresAt: string;
        lastUsed: string;
        usageCount: number;
        providedPrivilege: "custom" | "demo" | "restricted" | "protected" | "full";
}

export type ActionArgs = 
    | { action: 'privilege-update'; newPrivileges: 'demo' | 'restricted' | 'protected' | 'full' | 'custom' }
    | { action: 'ip-restriction-update'; newIpAddress: string[] | null }
    | { action: 'revoke' | 'metadata' | 'rotate' };

export type ActionManagerResult = 
| Results<string | { msg: string; invalidedTokenId: number; userId: number }>
| Results<ApiTokenRotationSuccess>
| Results<SingleTokenMeta>
| Results<CreationSuccess>
| Results<{ msg: string }>;


export type InternalUnion = ActionManagerResult extends Results<infer Res> ? Res : never;
