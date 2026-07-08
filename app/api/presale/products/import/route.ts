import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

export interface ImportRow {
  name: string;
  sku?: string;
  category?: string;
  retailPrice?: number;
  presalePrice?: number;
  stockQty?: number;
  description?: string;
  _rowNum: number;
  _errors: string[];
}

const REQUIRED_HEADERS = ["Name", "Retail Price (TWD)", "Bearth Price (TWD)"];

function parseNum(v: unknown): number | undefined {
  if (v === "" || v === null || v === undefined) return undefined;
  const n = Number(v);
  return isNaN(n) ? undefined : n;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "xlsx" && ext !== "xls") {
      return NextResponse.json({ error: "Invalid file. Please upload a .xlsx or .xls file." }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large. Maximum 10 MB." }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const workbook = XLSX.read(bytes, { type: "buffer" });
    if (!workbook.SheetNames.length) {
      return NextResponse.json({ error: "Excel file has no sheets." }, { status: 400 });
    }

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

    if (rawRows.length === 0) {
      return NextResponse.json({ error: "Sheet is empty. Please add product rows." }, { status: 400 });
    }
    if (rawRows.length > 500) {
      return NextResponse.json({ error: "Maximum 500 products per import." }, { status: 400 });
    }

    // Check required headers
    const firstRow = rawRows[0];
    for (const header of REQUIRED_HEADERS) {
      if (!(header in firstRow)) {
        return NextResponse.json({
          error: `Missing required column: "${header}". Download the template for the correct format.`,
        }, { status: 400 });
      }
    }

    const rows: ImportRow[] = rawRows.map((r, i) => {
      const errors: string[] = [];
      const name = String(r["Name"] ?? "").trim();
      if (!name) errors.push("Name is required");

      const retailPrice = parseNum(r["Retail Price (TWD)"]);
      if (retailPrice === undefined) errors.push("Retail Price must be a number");
      else if (retailPrice < 0)      errors.push("Retail Price cannot be negative");

      const presalePrice = parseNum(r["Bearth Price (TWD)"]);
      if (presalePrice === undefined) errors.push("Bearth Price must be a number");
      else if (presalePrice < 0)      errors.push("Bearth Price cannot be negative");

      const stockQty = parseNum(r["Stock Qty"]);
      if (stockQty !== undefined && stockQty < 0) errors.push("Stock Qty cannot be negative");

      return {
        name,
        sku:          String(r["SKU"]         ?? "").trim() || undefined,
        category:     String(r["Category"]    ?? "").trim() || undefined,
        description:  String(r["Description"] ?? "").trim() || undefined,
        retailPrice,
        presalePrice,
        stockQty:     stockQty !== undefined ? Math.floor(stockQty) : undefined,
        _rowNum:  i + 2,
        _errors:  errors,
      };
    });

    const totalErrors = rows.filter(r => r._errors.length > 0).length;
    return NextResponse.json({ rows, total: rows.length, errorCount: totalErrors });
  } catch {
    return NextResponse.json({ error: "Failed to parse Excel file." }, { status: 500 });
  }
}
