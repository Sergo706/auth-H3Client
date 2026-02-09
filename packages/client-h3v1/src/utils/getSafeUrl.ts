import { getRequestURL, H3Event } from "h3";
import { getBaseUrl } from "@internal/shared";
import { getConfiguration } from "@internal/shared";

export function getSafeUrl(event: H3Event) {
    try {
        return getRequestURL(event, { xForwardedHost: true, xForwardedProto: true });
    } catch (err) {
        const path = event.path|| event.node.req?.url || '/';
        const base = getBaseUrl(getConfiguration())
        return new URL(path, base);
    }
}