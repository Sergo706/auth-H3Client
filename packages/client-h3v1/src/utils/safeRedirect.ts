import { H3Event, setHeader, setResponseStatus } from "h3";


export function safeRedirect(url: string, event: H3Event): string {
    setHeader(event, "Content-Type", "text/html;charset=UTF-8");
    setHeader(event, 'Cache-Control', 'no-store');
    setHeader(event, 'Pragma', 'no-cache');
    setResponseStatus(event, 200)

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