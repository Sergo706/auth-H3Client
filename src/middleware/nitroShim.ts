import { defineHandler, getHeader } from 'h3';

/**
 * Reads context (like IP address) forwarded from Nitro via headers
 * and patches the event object so that H3 v2 utilities work correctly.
 */
export const nitroShim = defineHandler((event) => {
  const forwardedIp = getHeader(event, 'x-nitro-forwarded-ip');
  
  if (forwardedIp) {
    Object.defineProperty(event?.runtime?.node?.req, 'socket', {
      value: { remoteAddress: forwardedIp },
      writable: true,
      configurable: true,
    });
  }
});