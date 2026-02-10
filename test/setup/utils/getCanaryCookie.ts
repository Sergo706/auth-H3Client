import { botDetectorMiddleware } from "auth-h3client/v2";
import { H3Event } from "h3";

export async function getCanaryCookie(event: H3Event): Promise<string | undefined> {
   try  {
       await botDetectorMiddleware(event);
   } catch {}

    const setCookie = event.res.headers.get('set-cookie');
    if (!setCookie) {
        console.warn("No canary_id returned.")
        return undefined;
    }
    
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie as string];
    const canaryCookie = cookies.find(c => c.startsWith('canary_id='));
    if (!canaryCookie) return undefined;
    
    return canaryCookie.split(';')[0].split('=')[1];
}