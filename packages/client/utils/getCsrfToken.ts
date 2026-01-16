
export function getCsrfToken(): string | undefined { 
    const raw = /__Host-csrf=([^;]+)/.exec(document.cookie);
    const token = raw ? raw[1]?.split(".")[0] : '';

    if (!token) return; 
    return token;
}