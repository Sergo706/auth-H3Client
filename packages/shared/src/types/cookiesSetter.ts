export interface CookiesSetter {
    httpOnly: boolean,
    sameSite: boolean | "lax" | "strict" | "none";
    maxAge: number; 
    secure?: boolean;
    expires?: Date;
    domain?: string;
    path?: string; 
  };

