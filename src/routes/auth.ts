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
    res.status(400).json({ error: "email and password are required" });
    return;
  }
  const user = userStore.verifyPassword(body.email, body.password);
  const account = user ? accountStore.get(user.accountId) : undefined;
  if (!user || !account) {
    // Pendo: a failed sign-in attempt. It's credited to the user whose email was tried, when there is one.
    const attempted = userStore.findByEmail(body.email);
    const attemptedAccount = attempted ? accountStore.get(attempted.accountId) : undefined;
    trackPendoEvent("user_signed_in", {
      visitorId: attempted?.id ?? "system",
      accountId: attemptedAccount?.id ?? "system",
      properties: {
        outcome: "failure",
        ...(attempted && { userId: attempted.id, userRole: attempted.role }),
        ...(attemptedAccount && { accountPlan: attemptedAccount.plan }),
      },
    });
    res.status(401).json({ error: "wrong email or password" });
    return;
  }
  const session: SessionResponse = { token: sessionStore.start(user.id), user, account };
  // Pendo: the credentials checked out and a session started.
  trackPendoEvent("user_signed_in", {
    visitorId: user.id,
    accountId: account.id,
    properties: { outcome: "success", userId: user.id, userRole: user.role, accountPlan: account.plan },
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
