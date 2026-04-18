export function safeRedirect(url: string): Response {
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

    return new Response(html, {
        status: 200,
        headers: {
            "Content-Type": "text/html;charset=UTF-8",
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        },
  });

}