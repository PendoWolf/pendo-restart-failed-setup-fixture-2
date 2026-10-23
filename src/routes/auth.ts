import { Router } from "express";
import { SYSTEM_ID, trackEvent } from "../analytics/pendo.js";
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
    // Pendo: a sign-in turned down before checking credentials. Never sends the email or password.
    trackEvent("sign_in_failed", {
      visitorId: SYSTEM_ID,
      accountId: SYSTEM_ID,
      properties: { failureReason: "missing_credentials", statusCode: 400 },
    });
    res.status(400).json({ error: "email and password are required" });
    return;
  }
  const user = userStore.verifyPassword(body.email, body.password);
  const account = user ? accountStore.get(user.accountId) : undefined;
  if (!user || !account) {
    // Pendo: a sign-in turned down after checking credentials. Never sends the email or password.
    trackEvent("sign_in_failed", {
      visitorId: user?.id ?? SYSTEM_ID,
      accountId: user?.accountId ?? SYSTEM_ID,
      properties: { failureReason: user ? "account_not_found" : "wrong_credentials", statusCode: 401 },
    });
    res.status(401).json({ error: "wrong email or password" });
    return;
  }
  const session: SessionResponse = { token: sessionStore.start(user.id), user, account };
  // Pendo: the password check passed and a session started.
  trackEvent("sign_in_completed", {
    visitorId: user.id,
    accountId: account.id,
    properties: { role: user.role, plan: account.plan },
  });
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
