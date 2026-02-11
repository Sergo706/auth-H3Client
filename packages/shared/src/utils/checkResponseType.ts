import pino from "pino";
import type { Response } from 'undici';


/**
 * Parses a fetch Response body based on its Content-Type, logging metadata for observability.
 *
 * @param log - Pino logger used for structured diagnostics.
 * @param response - Fetch response to parse.
 * @returns Parsed JSON or text payload; `undefined` when parsing fails.
 *
 * @example
 * const result = await parseResponseContentType(log, response);
 */
export async function parseResponseContentType(log: pino.Logger, response: Response): Promise<any> {

    const contentType = (response.headers.get('Content-Type') || '').toLowerCase();
    let bodyRequest;
    try {
        if (contentType.includes('application/json')) {
          bodyRequest = await response.json()
          log.info(`Parsed content type, json.`)
        } else {
           const text = await response.text();
           bodyRequest = text
           log.warn(`Parsed content type, is text or html.`)
        }
         return bodyRequest;
    } catch(err) {
        log.error({code: response.status, data: bodyRequest, error: err}, `Failed to parse response content type.`)
        return;
    }
   
}
