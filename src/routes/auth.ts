import { Router } from "express";
import { trackEvent } from "../analytics/pendo.js";
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
    res.status(400).json({ error: "email and password are required" });
    return;
  }
  const user = userStore.verifyPassword(body.email, body.password);
  const account = user ? accountStore.get(user.accountId) : undefined;
  if (!user || !account) {
    res.status(401).json({ error: "wrong email or password" });
    // Pendo: the credentials were rejected. There's no signed-in user, and the email is never sent.
    trackEvent(
      "sign_in_completed",
      { visitorId: user?.id ?? "system", accountId: account?.id ?? "system" },
      { outcome: "failed" },
    );
    return;
  }
  const session: SessionResponse = { token: sessionStore.start(user.id), user, account };
  res.json(session);
  // Pendo: the credentials were accepted and a session started.
  trackEvent(
    "sign_in_completed",
    { visitorId: user.id, accountId: account.id },
    { outcome: "succeeded", userId: user.id, role: user.role, accountPlan: account.plan },
  );
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
