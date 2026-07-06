import { createHmac, timingSafeEqual } from "crypto";

const SECRET =
  process.env.AUTH_SECRET || "bearth-admin-secret-please-change-in-production";

export type AdminRole = "admin" | "ops" | "tech";

// Tokens are issued by BearthApi: base64url(userId:role:timestamp.hmac)
export function verifyToken(token: string): { userId: string; role: AdminRole } | null {
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
    // payload: userId:role:timestamp
    const parts = payload.split(":");
    if (parts.length < 3) return null;
    const [userId, role] = parts;
    if (role !== "admin" && role !== "ops" && role !== "tech") return null;
    return { userId, role: role as AdminRole };
  } catch {
    return null;
  }
}
