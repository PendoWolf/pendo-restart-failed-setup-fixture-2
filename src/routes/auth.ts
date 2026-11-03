import { Router } from "express";
import { trackPendoEvent } from "../analytics/pendo.js";
import { requireAuth, type AuthLocals } from "../auth/require-auth.js";
import { accountStore } from "../store/accounts.js";
import { sessionStore } from "../store/sessions.js";
import { userStore } from "../store/users.js";
import type { SessionResponse, SignInRequest } from "../types.js";

export const authRouter = Router();

// Signs a user in with their email and password, and returns a bearer token with the user and their account.
authRouter.post("/login", (req, res) => {
  const body = req.body as Partial<SignInRequest> | undefined;
  if (!body || typeof body.email !== "string" || typeof body.password !== "string") {
    // The sign-in was rejected before anyone was identified. Never send the email or password.
    trackPendoEvent({
      event: "sign_in_failed",
      visitorId: "system",
      accountId: "system",
      properties: { failureReason: "missing_fields", statusCode: 400 },
      req,
    });
    res.status(400).json({ error: "email and password are required" });
    return;
  }
  const user = userStore.verifyPassword(body.email, body.password);
  const account = user ? accountStore.get(user.accountId) : undefined;
  if (!user || !account) {
    // Wrong email or password, so there's no signed-in user; a user without an account is the only case with one.
    trackPendoEvent({
      event: "sign_in_failed",
      visitorId: user?.id ?? "system",
      accountId: user?.accountId ?? "system",
      properties: { failureReason: user ? "account_not_found" : "wrong_credentials", statusCode: 401 },
      req,
    });
    res.status(401).json({ error: "wrong email or password" });
    return;
  }
  const session: SessionResponse = { token: sessionStore.start(user.id), user, account };
  res.json(session);
});

// Returns the signed-in user and their account.
authRouter.get("/me", requireAuth, (_req, res) => {
  const { token, user, account } = res.locals as AuthLocals;
  const session: SessionResponse = { token, user, account };
  res.json(session);
});

// Ends the session: its token stops working.
authRouter.post("/logout", requireAuth, (_req, res) => {
  sessionStore.end((res.locals as AuthLocals).token);
  res.status(204).end();
});
