import { ZodSafeParseSuccess, type ZodType } from 'zod';
import * as z from 'zod';
import { getLogger } from './logger.js';

interface CustomValidationError { valid: false; errors: Record<string, string> };

export function validateZodSchema<T, Input>(schema: ZodType<T, Input>,data: Input, log: ReturnType<typeof getLogger>)
: ZodSafeParseSuccess<T> | CustomValidationError {
    log.info(`Validating schema...`);
    const result = schema.safeParse(data);
    
    if (!result.success) {
        const prettyError = z.prettifyError(result.error);
        log.error(`Error validating data ${prettyError}`);
        const errors: Record<string,string> = {};
            
        result.error.issues.forEach(issue => {
              const key = issue.path[0]?.toString() ?? 'root';
              errors[`${key} Error`] = issue.message;
        });
            return {
                valid: false,
                errors: errors
            };
    }
    log.info(`Schema parsed`);
    return result;
} 