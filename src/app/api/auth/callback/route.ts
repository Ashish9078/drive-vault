import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getOAuth2Client } from '@/lib/google-drive';
import { encrypt } from '@/lib/encryption';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (!code) {
    return NextResponse.redirect(new URL('/?error=no_code', request.url));
  }

  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();

    // Get drive storage info
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const about = await drive.about.get({ fields: 'storageQuota,user' });
    const quota = about.data.storageQuota;

    const email = userInfo.data.email || '';
    const displayName = userInfo.data.name || '';
    const profilePicture = userInfo.data.picture || '';

    // Determine logged in userId
    const currentUser = await getCurrentUser();
    const userId = currentUser?.userId || (state && state.length > 5 ? state : null);

    // Check account count for this user
    const accountCount = await prisma.driveAccount.count({
      where: { userId },
    });
    
    // Check if account already exists for this user
    const existingAccount = await prisma.driveAccount.findFirst({
      where: {
        userId,
        email,
      },
    });

    if (existingAccount) {
      // Update existing account tokens
      await prisma.driveAccount.update({
        where: { id: existingAccount.id },
        data: {
          encryptedAccessToken: encrypt(tokens.access_token || ''),
          encryptedRefreshToken: tokens.refresh_token 
            ? encrypt(tokens.refresh_token) 
            : existingAccount.encryptedRefreshToken,
          tokenExpiresAt: new Date(tokens.expiry_date || Date.now() + 3600 * 1000),
          totalBytes: BigInt(quota?.limit || '16106127360'),
          usedBytes: BigInt(quota?.usage || '0'),
          displayName,
          profilePicture,
          status: 'active',
        },
      });
    } else {
      if (accountCount >= 100) {
        return NextResponse.redirect(
          new URL('/?error=max_accounts', request.url)
        );
      }

      // Create new account
      await prisma.driveAccount.create({
        data: {
          userId,
          email,
          displayName,
          profilePicture,
          encryptedAccessToken: encrypt(tokens.access_token || ''),
          encryptedRefreshToken: encrypt(tokens.refresh_token || ''),
          tokenExpiresAt: new Date(tokens.expiry_date || Date.now() + 3600 * 1000),
          totalBytes: BigInt(quota?.limit || '16106127360'),
          usedBytes: BigInt(quota?.usage || '0'),
          status: 'active',
        },
      });
    }

    if (userId) {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'connect',
          details: `Connected Google Drive: ${email} (${displayName || 'Account'})`,
          userEmail: currentUser?.email || email,
        },
      });
    }

    return NextResponse.redirect(new URL('/?success=connected', request.url));
  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect(
      new URL('/?error=auth_failed', request.url)
    );
  }
}
