export type LinkPasswordVerificationResponse =
  | {
      ok: true;
      date: string;
      data: {
        link: 'Password Reset';
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
      error: 'Link is not valid or expired' | 'Invalid link URL' | 'This link can only be used once';
    };