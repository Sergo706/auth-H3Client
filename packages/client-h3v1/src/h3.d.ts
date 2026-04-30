import type { ServerResponse, LimitedMetaData, CreationSuccess, ActionManagerResult, VerifySuccessResponse, InternalUnion  } from '@internal/shared';
import 'h3';

declare module 'h3' {
  interface H3EventContext {
    accessToken?: string;
    session?: string;
    authorizedData?: ServerResponse;
    isRotated?: boolean;
    limitedMetaData?: Omit<LimitedMetaData, 'accessIat', 'accessToken'>;
    userData?: unknown;
    authHeaders?: Record<string, string>;
    provider?: string;
    link?: "Custom MFA" | "Password Reset" | "MFA Code";
    reason?: string;

    newApiToken?: Extract<InternalUnion, CreationSuccess>;
    ipRestrictionUpdate?: Extract<Exclude<InternalUnion, string>, { msg: string }>;
    privilegeUpdate?: Extract<Exclude<InternalUnion, string>, { msg: string }>;
    revoke?: Extract<InternalUnion, string | { msg: string; invalidedTokenId: number; userId: number }>;
    extensiveMetadata?: Extract<InternalUnion, SingleTokenMeta>;
    rotate?: Extract<InternalUnion, ApiTokenRotationSuccess>;
    apiVerification?: VerifySuccessResponse;
  }
}
