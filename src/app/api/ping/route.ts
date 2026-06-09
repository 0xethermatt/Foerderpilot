import { NextResponse } from 'next/server';
export function GET() {
  return NextResponse.json({ ok: true, branch: 'main', phase: 10, ts: Date.now() });
}
