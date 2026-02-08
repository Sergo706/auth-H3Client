import z from "zod"
import { makeSafeString } from "../utils/safeStringMaker.js"

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

export const verificationLink = z.object({
    ...schema.shape,
    visitor: z.coerce.number(),
    temp: z.string()
})

export const code = z.strictObject({ 
    code:makeSafeString({
        min: 7,
        max: 7,
        pattern: /^\d{7}$/,
        patternMsg: `Invalid or expired code`
    })
}).required();

export type Code = z.infer<typeof code>
export type VerificationLinkSchema = z.infer<typeof verificationLink>