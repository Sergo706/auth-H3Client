import { defineEventHandler, getQuery, Router } from "h3";
import { safeRedirect } from "../utils/safeRedirect.js";
import { getConfiguration, VerificationLinkSchema } from "@internal/shared";

export function bounceRouter(router: Router, prefix?: string) {
  const p = (path: string) => prefix ? `/${prefix}${path}` : path;
  const en = (e: string | number) => encodeURIComponent(e)
  
  const { magicLinkRedirectPath } = getConfiguration();
  
  router.get(p('/auth/bounce'), defineEventHandler((event) => {
    const { visitor, random, reason, token } = getQuery<VerificationLinkSchema>(event)
    
    const destination = `${magicLinkRedirectPath}?token=${en(token)}&reason=${en(reason)}&visitor=${en(visitor)}&random=${en(random)}`;

    return safeRedirect(destination, event);
  }));
}