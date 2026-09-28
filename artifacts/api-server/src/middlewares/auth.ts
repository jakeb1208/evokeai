import type { NextFunction, Request, Response } from "express";
import type { User } from "@supabase/supabase-js";
import { authenticateAccessToken, supabaseConfigurationError } from "../lib/supabase";

declare global {
  namespace Express {
    interface Request {
      evokeUser?: User;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authorization = req.header("authorization");
  const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!accessToken) {
    return res.status(401).json({ error: "A Supabase access token is required." });
  }

  try {
    req.evokeUser = await authenticateAccessToken(accessToken);
    return next();
  } catch (error) {
    return res.status(supabaseConfigurationError(error) ? 503 : 401).json({
      error: error instanceof Error ? error.message : "Supabase authentication failed.",
    });
  }
}