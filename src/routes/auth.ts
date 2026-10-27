import { Router } from "express";
import { SYSTEM_IDENTITY, trackEvent } from "../analytics/pendo.js";
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
    // Sign-in friction: never send the email or password, only why the attempt was rejected.
    trackEvent("sign_in_failed", SYSTEM_IDENTITY, { failureReason: "missing_fields", statusCode: 400 });
    res.status(400).json({ error: "email and password are required" });
    return;
  }
  const user = userStore.verifyPassword(body.email, body.password);
  const account = user ? accountStore.get(user.accountId) : undefined;
  if (!user || !account) {
    // Attribute the failure to the user whose email was tried, when there is one, so it lands on their visitor.
    const triedUser = user ?? userStore.findByEmail(body.email);
    trackEvent(
      "sign_in_failed",
      triedUser ? { visitorId: triedUser.id, accountId: triedUser.accountId } : SYSTEM_IDENTITY,
      {
        failureReason: !triedUser ? "unknown_email" : !user ? "wrong_password" : "account_not_found",
        statusCode: 401,
      },
    );
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
