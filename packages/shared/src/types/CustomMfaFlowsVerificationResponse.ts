export type CustomMfaFlowsVerificationResponse =
  | {
      ok: true;
      date: string;
      data: {
        link: 'Custom MFA';
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
      reason:
        | "Zod validation failed malformed link"
        | 'Invalid link URL'
        | 'Malformed token payload'
        | 'Link is not valid or expired'
        | 'This link can only be used once';
    }
  | {
      error: 'Link is not valid or expired';
      details: string;
    };