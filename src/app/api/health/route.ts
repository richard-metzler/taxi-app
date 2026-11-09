import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    return NextResponse.json({ status: "ok", database: "connected" });
  } catch (error) {
    return NextResponse.json({ status: "error", database: "disconnected" }, { status: 500 });
  }
}
