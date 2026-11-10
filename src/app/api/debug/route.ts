import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { message, data } = await req.json();
    console.log(`[CLIENT] ${message}`, data ? JSON.stringify(data) : "");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false });
  }
}
