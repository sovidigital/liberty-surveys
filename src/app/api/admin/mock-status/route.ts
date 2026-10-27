import { NextResponse } from 'next/server';
import { isMockMode } from '@/lib/auth';

export async function GET() {
  return NextResponse.json({ isMockMode: isMockMode() });
}
