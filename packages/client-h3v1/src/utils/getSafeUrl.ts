import { getRequestURL, H3Event } from "h3";
import { getBaseUrl } from "./buildBaseUrl.js";
import { getConfiguration } from "../main.js";

export function getSafeUrl(event: H3Event) {
    try {
        return getRequestURL(event, { xForwardedHost: true, xForwardedProto: true });
    } catch (err) {
        const path = event.path|| event.node.req?.url || '/';
        const base = getBaseUrl(getConfiguration())
        return new URL(path, base);
    }
}