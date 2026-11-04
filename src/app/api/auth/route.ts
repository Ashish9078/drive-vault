import { NextRequest, NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/google-drive';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Please login first' }, { status: 401 });
    }
    const authUrl = getAuthUrl(user.userId);
    return NextResponse.json({ url: authUrl });
  } catch (error) {
    console.error('Auth URL generation failed:', error);
    return NextResponse.json(
      { error: 'Failed to generate auth URL' },
      { status: 500 }
    );
  }
}
