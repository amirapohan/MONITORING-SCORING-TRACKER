import type { AuditAction } from "@prisma/client";

export const EXCHANGE = "identity.events";
export const AUDIT_QUEUE = "identity.audit";

export const ROUTING_KEYS: Record<AuditAction, string> = {
  REGISTER: "user.registered",
  LOGIN_SUCCESS: "user.login.success",
  LOGIN_FAILED: "user.login.failed",
  LOGOUT: "user.logout",
  TOKEN_REFRESH: "user.token_refreshed",
  USER_DEACTIVATED: "user.deactivated",
  PROJECT_COMPLETED: "project.completed",
};

export type EventMessage = {
  id: string;
  eventType: AuditAction;
  userId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  payload: unknown;
  createdAt: string;
};
