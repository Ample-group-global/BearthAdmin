import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.BEARTH_API_URL!;

export function getSessionToken(req: NextRequest): string | null {
  return req.cookies.get("admin_session")?.value ?? null;
}

type ProxyOptions = {
  method?: string;
  body?: unknown;
  searchParams?: URLSearchParams;
};

export async function proxyToApi(
  req: NextRequest,
  path: string,
  options: ProxyOptions = {}
): Promise<NextResponse> {
  const token = getSessionToken(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(path, API_BASE);
  if (options.searchParams) {
    options.searchParams.forEach((v, k) => url.searchParams.set(k, v));
  }

  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  try {
    const response = await fetch(url.toString(), {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ error: "API unreachable" }, { status: 503 });
  }
}
