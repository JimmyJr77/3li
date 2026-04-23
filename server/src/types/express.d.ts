import "express-serve-static-core";

declare module "express-serve-static-core" {
  interface Request {
    appUser?: {
      id: string;
      username: string;
      email: string;
      phone: string | null;
      firstName: string | null;
      lastName: string | null;
      displayName: string | null;
      role: string;
    };
  }
}
