import type { ServerResponse } from './ServerResponse.ts';
import 'h3';

declare module 'h3' {
  interface H3EventContext {
    accessToken?: string;
    session?: string;
    authorizedData?: ServerResponse;
  }
}
