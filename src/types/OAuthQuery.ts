import { z } from "zod"


export const query = z.object({
    code: z.union([z.string(), z.undefined()]),
    state: z.union([z.string(), z.undefined()]),
    error: z.union([z.string(), z.undefined()]),
    iss: z.union([z.string(), z.undefined()]),
})

export type QueryType = z.infer<typeof query>
