import { H3Event, createError } from "h3";
import pino from "pino";
import {type AppCode } from "@internal/shared";
/**
 * Logs a structured error and throws an HTTPError with the provided application status metadata.
 *
 * @param log - Pino logger scoped to the current request.
 * @param event - H3 event where the error originated.
 * @param appCode - Application-specific error code.
 * @param status - HTTP status code to surface.
 * @param statusText - HTTP status text.
 * @param message - Human-readable message (optional).
 * @param cause - Additional detail for logging (optional).
 * @throws HTTPError Always throws after logging.
 *
 * @example
 * throwError(log, event, 'FORBIDDEN', 403, 'Forbidden', 'Not allowed');
 */
export default function throwError(log: pino.Logger, event: H3Event, appCode: AppCode, status: number, statusText: string, message?: string, cause?: string): never {
      log.error({appCode, status, statusText, cause}, message)
       throw createError({
        data: { date: new Date().toJSON(), code: appCode },
        status,
        statusText,
        message,
       })
}
