import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join, extname } from "path";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]);
const ALLOWED_EXTS  = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const MAX_BYTES     = 5 * 1024 * 1024; // 5 MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Invalid file type. Allowed: JPG, PNG, WebP, GIF." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File too large. Maximum size is 5 MB." }, { status: 400 });
    }

    const ext = extname(file.name).toLowerCase();
    if (!ALLOWED_EXTS.has(ext)) {
      return NextResponse.json({ error: "Invalid file extension." }, { status: 400 });
    }

    const filename = `product_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    const dir      = join(process.cwd(), "public", "BearthProducts");

    if (!existsSync(dir)) await mkdir(dir, { recursive: true });

    const bytes = await file.arrayBuffer();
    await writeFile(join(dir, filename), Buffer.from(bytes));

    return NextResponse.json({ url: `/BearthProducts/${filename}` });
  } catch {
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
