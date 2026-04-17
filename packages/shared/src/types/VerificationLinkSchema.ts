import z from "zod"
import { makeSafeString } from "../utils/safeStringMaker.js"

/**
 * Base schema for MFA verification parameters.
 * Contains the cryptographic random token and action reason.
 */
export const schema = z.object({
    random: makeSafeString({
        min: 254,
        max: 500,
        patternMsg: "Invalid random"
    }),
    reason: makeSafeString({
        min: 0,
        max: 100
    }),
}).required()

/**
 * Complete verification link schema including visitor ID and temporary token.
 * Used to validate magic link query parameters.
 *
 * @property visitor - Numeric visitor/user identifier
 * @property temp - Temporary verification token
 * @property random - Cryptographic hash for request verification (254-500 chars)
 * @property reason - Action identifier (max 100 chars)
 */
export const verificationLink = z.object({
    ...schema.shape,
    visitor: z.string(),
    token: z.string()
})

/**
 * Schema for validating MFA verification codes.
 * Enforces a strict 7-digit numeric format.
 *
 * @property code - A 7-digit numeric string (e.g., "1234567")
 */
export const code = z.strictObject({ 
    code:makeSafeString({
        min: 7,
        max: 7,
        pattern: /^\d{7}$/,
        patternMsg: `Invalid or expired code`
    })
}).required();

/**
 * Inferred type for the MFA verification code object.
 * Contains a single `code` property with a 7-digit numeric string.
 */
export type Code = z.infer<typeof code>

/**
 * Inferred type for magic link query parameters.
 * Used when handling verification link GET requests.
 */
export type VerificationLinkSchema = z.infer<typeof verificationLink>