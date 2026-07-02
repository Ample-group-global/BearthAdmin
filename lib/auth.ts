import { createHmac, timingSafeEqual } from "crypto";

const SECRET =
  process.env.AUTH_SECRET || "bearth-admin-secret-please-change-in-production";

export type AdminRole = "admin" | "ops" | "tech";

export function signToken(role: AdminRole): string {
  const payload = `${role}:${Date.now()}`;
  const sig = createHmac("sha256", SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

export function verifyToken(token: string): AdminRole | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const lastDot = decoded.lastIndexOf(".");
    if (lastDot === -1) return null;
    const payload = decoded.slice(0, lastDot);
    const sig = decoded.slice(lastDot + 1);
    const expected = createHmac("sha256", SECRET).update(payload).digest("hex");
    const sigBuf = Buffer.from(sig, "hex");
    const expBuf = Buffer.from(expected, "hex");
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf))
      return null;
    const [role] = payload.split(":");
    if (role !== "admin" && role !== "tech" && role !== "ops") return null;
    return role as AdminRole;
  } catch {
    return null;
  }
}
