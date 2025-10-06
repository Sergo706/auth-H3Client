import pino from "pino";
import type { Response } from 'undici';


export async function parseResponseContentType(log: pino.Logger, response: Response): Promise<any> {

    const contentType = response.headers.get('Content-Type') || '';
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