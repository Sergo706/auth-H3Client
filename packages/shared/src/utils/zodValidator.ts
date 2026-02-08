import { ZodSafeParseSuccess, type ZodType } from 'zod';
import * as z from 'zod';
import { getLogger } from './logger.js';

/**
 * Represents a validation failure with field-specific error messages.
 * Used when Zod schema validation fails.
 */
interface CustomValidationError { valid: false; errors: Record<string, string> };

/**
 * Validates data against a Zod schema and returns either a success result
 * or a structured error object with field-specific messages.
 *
 * This utility provides a consistent validation pattern across the codebase,
 * with built-in logging and error formatting. The error format is designed
 * for easy consumption by API responses.
 *
 * @typeParam T - The expected output type after successful validation
 * @typeParam Input - The input type being validated
 *
 * @param schema - The Zod schema to validate against
 * @param data - The data to validate
 * @param log - Pino logger instance for validation logging
 *
 * @returns Either a Zod success result with parsed data, or a {@link CustomValidationError}
 *          containing field-specific error messages
 *
 * @example
 * ```typescript
 * const validation = validateZodSchema(userSchema, requestBody, log);
 *
 * if ('valid' in validation) {
 *   // Validation failed - validation.errors contains field-specific messages
 *   return { errors: validation.errors };
 * }
 *
 * // Validation succeeded - use validation.data
 * const user = validation.data;
 * ```
 *
 * @remarks
 * The error object uses `"fieldName Error"` as keys (e.g., `"email Error": "Invalid email format"`)
 * to provide human-readable error identifiers.
 */
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