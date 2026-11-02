import { NextRequest, NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/google-drive';

export async function GET(request: NextRequest) {
  try {
    const authUrl = getAuthUrl();
    return NextResponse.json({ url: authUrl });
  } catch (error) {
    console.error('Auth URL generation failed:', error);
    return NextResponse.json(
      { error: 'Failed to generate auth URL' },
      { status: 500 }
    );
  }
}
