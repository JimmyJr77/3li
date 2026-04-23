import "express-serve-static-core";

declare module "express-serve-static-core" {
  interface Request {
    appUser?: { id: string; username: string; displayName: string | null; role: string };
  }
}
