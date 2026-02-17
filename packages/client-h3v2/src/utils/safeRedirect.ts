import { H3Event } from "h3";


export function safeRedirect(url: string, event: H3Event): string {
    event.res.headers.set("Content-Type", "text/html;charset=UTF-8")  
    event.res.headers.set('Cache-Control', 'no-store')  
    event.res.headers.set('Pragma', 'no-cache')  
    event.res.status = 200;
     return `
            <!DOCTYPE html>
              <html>
                <head>
                <meta http-equiv="refresh" content="0;url=${url}">
            <script>window.location.replace('${url}');</script>
                </head>
                <body>
                </body>
            </html>
            `;
}