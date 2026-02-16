export type LinkMfaVerificationResponse =
  | {
      ok: true;
      date: string;
      data: {
        link: 'MFA Code';
        reason: string;
      };
    }
  | undefined

  | {
      banned: true;
    }
  | {
      error: any;
      banned: false;
    }
  | {
      ok: false;
      date: string;
      reason: "Zod validation failed malformed link";
    }

    | {
      ok: false;
      date: string;
      reason: 'Malformed token payload';
    }

    | {
      error: 'Link is not valid or expired';
      details: string; 
    }
  | {
      error: 'Invalid link URL' | 'Link is not valid or expired' | 'This link can only be used once';
    };