import { H3Event, setHeaders, setResponseStatus, send } from "h3";


export async function safeRedirect(url: string, event: H3Event): Promise<void> {
    setHeaders(event, {
        "Content-Type": "text/html;charset=UTF-8",
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
    });

    setResponseStatus(event, 200)

     const html = `
            <!DOCTYPE html>
              <html>
                <head>
                <meta http-equiv="refresh" content="0;url=${url}">
            <script>window.location.replace('${url}');</script>
                </head>
            <body style="background: #000;">
                <div style="color: white; font-family: sans-serif; text-align: center; margin-top: 20%;">
                    Redirecting...
                </div>
            </body>
            </html>
            `;
    return send(event, html, "text/html");
}