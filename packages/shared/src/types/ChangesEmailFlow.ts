import z from 'zod'
import { makeSafeString } from '../utils/safeStringMaker.js'

export const dataSchema = z.object({
    code:makeSafeString({
        min: 7,
        max: 7,
        pattern: /^\d{7}$/,
        patternMsg: `Invalid or expired code`
    }),
    email:makeSafeString({
        min: 10,
        max: 80,
        pattern: /^(?!\.)(?!.*\.\.)[A-Za-z0-9_'-.]+[A-Za-z0-9_-]@[A-Za-z][A-Za-z-]*(?:\.[A-Za-z]{1,4}){1,3}$/,
        patternMsg: `Please enter a valid email.\n 
            Username (before @):\n
            Letters, digits, _ ' - . are allowed \n
    
            Cannot start or end with a dot, nor have “..”\n
    
            Domain (after @): \n
    
            First label must start with a letter (letters & hyphens allowed)\n
    
            Followed by 1 to 3 dot-separated labels\n
    
            Each of those labels must be 1–4 letters\n
    
            Examples:\n\n
    
    
            john-lastname414@example.com\n
    
            john@example.com\n
    
            alice.smith@domain.co.uk\n
    
            o_connor@my-domain.io`
    })
    .transform(s => s.toLowerCase()),

    newEmail:makeSafeString({
        min: 10,
        max: 80,
        pattern: /^(?!\.)(?!.*\.\.)[A-Za-z0-9_'-.]+[A-Za-z0-9_-]@[A-Za-z][A-Za-z-]*(?:\.[A-Za-z]{1,4}){1,3}$/,
        patternMsg: `Please enter a valid email.\n 
            Username (before @):\n
            Letters, digits, _ ' - . are allowed \n
    
            Cannot start or end with a dot, nor have “..”\n
    
            Domain (after @): \n
    
            First label must start with a letter (letters & hyphens allowed)\n
    
            Followed by 1 to 3 dot-separated labels\n
    
            Each of those labels must be 1–4 letters\n
    
            Examples:\n\n
    
    
            john-lastname414@example.com\n
    
            john@example.com\n
    
            alice.smith@domain.co.uk\n
    
            o_connor@my-domain.io`
    })
    .transform(s => s.toLowerCase()),
    
    password: 
    z.string()
        .min(12)
        .max(64)
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d])\S{12,64}$/,
        `Password must be at least 12 characters long, include atleast one uppercase letter, one lowercase letter, one digit, and one special character.`
    ),
})
export const initScheme = makeSafeString({min: 0, max: 1, pattern: /^1$/})
export const initSchema = z.object({
    init: initScheme
})
export type UpdateEmailSchemaType = z.infer<typeof dataSchema> 
export type InitSchemaType = z.infer<typeof initSchema>
