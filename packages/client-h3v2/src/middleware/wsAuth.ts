import type { WebSocketPeer } from 'h3'
import { getLogger } from "@internal/shared";

export async function authWs(peer: WebSocketPeer): Promise<void> {
 const log = getLogger().child({service: 'auth-ws', branch: `ws-authentication`, reqID: peer.id })
 const req = peer.request as Request;
 const cookieHeader = req.headers.entries()
  
 let currentToken;
 let refresh;
 let canary;
 for (const [header, value] of cookieHeader) {
        if (header.toLowerCase() === 'cookie') {
            const cookies = value.split(';').reduce((acc, cookie) => {
                const [name, val] = cookie.trim().split('=');
                acc[name] = decodeURIComponent(val);
                return acc;
            }, {} as Record<string, string>);
            
             currentToken = cookies['__Secure-a'];
             refresh = cookies['session'];
             canary = cookies['canary_id'];
            
            if (!currentToken || !refresh || canary) {
                log.error(`Missing required authentication cookies`);
                return;
            }
            break;
        }
 }
      const cookies = [
        {label: `canary_id`,  value: canary},
        {label: `session`, value: refresh},
      ]    
}