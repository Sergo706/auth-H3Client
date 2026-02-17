import { createError, useAsyncData, useRequestEvent, useRequestFetch, useRequestHeaders, useRoute } from "nuxt/app";
import { executeRequest } from "../main.js";


export interface NotFoundPath {
   error: string;
} 

export type BuildInReason = 'MAGIC_LINK_MFA_CHECKS' | "PASSWORD_RESET" | 'change_email' | string;

export interface SuccessPath {
    reason: BuildInReason,
    link: "Password Reset" | "MFA Code" | 'Custom MFA'; 
}
type Data = SuccessPath & {
    random: string, 
    token: string, 
    visitor: string
}
/**
 * Composable to handle magic link verification flows.
 * Uses query parameters to align with the BFF's refactored logic.
 */
export async function useMagicLink(path?: string): Promise<Data | NotFoundPath> {
    const route = useRoute();
    const { random, token, reason, visitor} = route.query;
    if (!random || !token || !reason || !visitor) {
        throw createError({
            statusCode: 404,
            statusText: 'Not Found',
            message: `The page you are looking for doesn't exists`
        })
    }
    const lowC = String(reason).toLowerCase()
    let baseUrl: string | undefined;
    switch (lowC) {
        case "magic_link_mfa_checks":
            baseUrl = '/api/auth/verify-mfa';
            break;
        case "password_reset":
            baseUrl = '/api/auth/reset-password';
            break;
        case "change_email":
            baseUrl = '/api/auth/update-email';
            break;
        default:
            baseUrl = path;
    }
    if (!baseUrl) {
        throw createError({
            statusCode: 404,
            statusText: 'Not Found',
            message: `The page you are looking for doesn't exists`
        }) 
    }

    const headers = useRequestHeaders();
    const event = useRequestEvent();
    const fetcher = useRequestFetch();
    
    const { error, data } = await useAsyncData(String(reason), async () => {
        const result = await executeRequest<SuccessPath | NotFoundPath>(baseUrl, "GET", { random, token, reason, visitor }, {}, {}, { headers, event, fetcher })
        
        if (!result.ok) {
            throw createError({
                statusCode: 404,
                statusText: 'Not Found',
                message: `The page you are looking for doesn't exists`
            })   
        }
        return result;
    })

    if (error.value || !data.value) {
         throw createError({ statusCode: 404, statusMessage: `Not Found`, message: `The page you are looking for doesn't exists` });
    }

    const resultValue = data.value.data;

    if ('error' in resultValue) {
         throw createError({ 
            statusCode: 404, 
            statusMessage: `Not Found`, 
            message: `The page you are looking for doesn't exist` 
        });
    }

    return {
         token: String(token),
         random: String(random),
         visitor: String(visitor),
        ...resultValue,
    };
}