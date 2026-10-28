import { Router } from "express";
import { trackEvent } from "../analytics/pendo.js";
import type { AuthLocals } from "../auth/require-auth.js";
import { accountStore } from "../store/accounts.js";
import { userStore } from "../store/users.js";
import type { Account, NewAccount } from "../types.js";

const PLANS: Account["plan"][] = ["Starter", "Business", "Enterprise"];

/** Returns why `body` isn't a valid account, or null when it is. Fields may be left out only when `partial`. */
function validateAccount(body: Partial<NewAccount> | undefined, partial: boolean): string | null {
  if (!body) return "a JSON body is required";
  if ((!partial || body.name !== undefined) && (typeof body.name !== "string" || body.name.trim() === "")) {
    return "name is required";
  }
  if ((!partial || body.plan !== undefined) && !PLANS.includes(body.plan as Account["plan"])) {
    return `plan must be one of ${PLANS.join(", ")}`;
  }
  return null;
}

export const accountsRouter = Router();

accountsRouter.get("/", (_req, res) => {
  res.json(accountStore.list());
});

accountsRouter.get("/:id", (req, res) => {
  const account = accountStore.get(req.params.id);
  if (!account) {
    res.status(404).json({ error: "account not found" });
    return;
  }
  res.json(account);
});

// Lists the users who belong to the account.
accountsRouter.get("/:id/users", (req, res) => {
  if (!accountStore.get(req.params.id)) {
    res.status(404).json({ error: "account not found" });
    return;
  }
  res.json(userStore.list(req.params.id));
});

accountsRouter.post("/", (req, res) => {
  const body = req.body as Partial<NewAccount> | undefined;
  const problem = validateAccount(body, false);
  if (problem) {
    res.status(400).json({ error: problem });
    return;
  }
  const created = accountStore.create({ name: body!.name!.trim(), plan: body!.plan! });
  // Pendo: the account passed validation and was saved, with the plan it chose.
  const { user, account } = res.locals as AuthLocals;
  trackEvent("company_account_created", {
    visitorId: user.id,
    accountId: account.id,
    properties: { newAccountId: created.id, plan: created.plan, createdByUserId: user.id },
    req,
  });
  res.status(201).json(created);
});

accountsRouter.put("/:id", (req, res) => {
  const body = req.body as Partial<NewAccount> | undefined;
  const problem = validateAccount(body, true);
  if (problem) {
    res.status(400).json({ error: problem });
    return;
  }
  const previous = accountStore.get(req.params.id);
  const updated = accountStore.update(req.params.id, {
    ...(body!.name !== undefined && { name: body!.name.trim() }),
    ...(body!.plan !== undefined && { plan: body!.plan }),
  });
  if (!updated) {
    res.status(404).json({ error: "account not found" });
    return;
  }
  // Pendo: only when the plan actually changed (an upgrade or a downgrade).
  if (previous && body!.plan !== undefined && body!.plan !== previous.plan) {
    const { user, account } = res.locals as AuthLocals;
    trackEvent("account_plan_changed", {
      visitorId: user.id,
      accountId: account.id,
      properties: {
        targetAccountId: updated.id,
        previousPlan: previous.plan,
        newPlan: updated.plan,
        changeDirection: PLANS.indexOf(updated.plan) > PLANS.indexOf(previous.plan) ? "upgrade" : "downgrade",
        changedByUserId: user.id,
      },
      req,
    });
  }
  res.json(updated);
});

accountsRouter.delete("/:id", (req, res) => {
  const { user, account } = res.locals as AuthLocals;
  const target = accountStore.get(req.params.id);
  const remainingUserCount = userStore.list(req.params.id).length;
  if (remainingUserCount > 0) {
    // Pendo: the deletion was blocked because the account still has users. Count real deletions with
    // outcome "deleted".
    trackEvent("company_account_deleted", {
      visitorId: user.id,
      accountId: account.id,
      properties: {
        targetAccountId: req.params.id,
        plan: target?.plan ?? null,
        outcome: "blocked_has_users",
        remainingUserCount,
        deletedByUserId: user.id,
      },
      req,
    });
    res.status(409).json({ error: "the account still has users" });
    return;
  }
  if (!target || !accountStore.remove(req.params.id)) {
    res.status(404).json({ error: "account not found" });
    return;
  }
  // Pendo: the account was really deleted.
  trackEvent("company_account_deleted", {
    visitorId: user.id,
    accountId: account.id,
    properties: {
      targetAccountId: target.id,
      plan: target.plan,
      outcome: "deleted",
      remainingUserCount: 0,
      deletedByUserId: user.id,
    },
    req,
  });
  res.status(204).end();
});
