import { NextRequest } from "next/server";
import { verifyToken, AdminRole } from "@/lib/auth";

const ALL_PERMISSIONS = [
  "dashboard.view",
  "orders.view", "orders.create", "orders.edit", "orders.delete",
  "orders.confirm_nft_payment", "orders.confirm_merch_payment",
  "nft.view", "nft.edit", "nft.confirm_delivery",
  "products.view", "products.create", "products.edit", "products.delete",
  "customers.view", "customers.create", "customers.edit", "customers.delete",
  "reconciliation.view", "reconciliation.confirm", "reconciliation.cancel",
  "reports.view",
  "users.view", "users.create", "users.edit", "users.delete", "users.revoke_permission",
];

export const ROLE_PERMISSIONS: Record<AdminRole, string[]> = {
  admin: ALL_PERMISSIONS,
  ops: [
    "dashboard.view",
    "orders.view", "orders.create", "orders.edit", "orders.delete",
    "orders.confirm_nft_payment", "orders.confirm_merch_payment",
    "nft.view", "nft.edit", "nft.confirm_delivery",
    "products.view", "products.create", "products.edit", "products.delete",
    "customers.view", "customers.create", "customers.edit", "customers.delete",
    "reconciliation.view", "reconciliation.confirm", "reconciliation.cancel",
    "reports.view",
    "users.view", "users.create", "users.edit", "users.delete", "users.revoke_permission",
  ],
  tech: [
    "dashboard.view",
    "nft.view", "nft.edit", "nft.confirm_delivery",
    "products.view", "products.create", "products.edit", "products.delete",
    "reports.view",
  ],
};

export interface AuthContext {
  userId: string;
  role: AdminRole;
  permissions: string[];
}

export class AuthError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function getAuth(req: NextRequest): AuthContext | null {
  const token = req.cookies.get("admin_session")?.value;
  if (!token) return null;
  const result = verifyToken(token);
  if (!result) return null;
  return { userId: result.userId, role: result.role, permissions: ROLE_PERMISSIONS[result.role] };
}

export function requireAuth(req: NextRequest): AuthContext {
  const auth = getAuth(req);
  if (!auth) throw new AuthError(401, "Unauthorized");
  return auth;
}
