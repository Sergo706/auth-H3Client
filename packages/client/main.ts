export { useAuthData, type AuthState } from "./composables/useAuthData.js";
export { executeRequest, type ApiContext } from './utils/executeRequest.js';
export { useMagicLink, type NotFoundPath, type BuildInReason, type SuccessPath } from './composables/useMagicLink.js'
export { getCsrfToken } from "./utils/getCsrfToken.js";
export { type ServerResponse, type LimitedMetaData } from '@internal/shared';
export { type UtilsResponse, type VerificationLinkSchema, type Results, type AuthServerLoginResponse, type AppCode, type InitSchemaType, type UpdateEmailSchemaType } from '@internal/shared';
export type { CustomMfaFlowsVerificationResponse, LinkMfaVerificationResponse, LinkPasswordVerificationResponse } from "@internal/shared";