import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  dbInitialized: boolean | undefined;
  initPromise: Promise<void> | undefined;
};

function getDatabaseUrl(): string {
  // If a remote cloud database (PostgreSQL, Supabase, Neon, Turso) is set, use it
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('file:')) {
    return process.env.DATABASE_URL;
  }

  // If running in Netlify or AWS Lambda serverless function
  const isServerless =
    Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME) ||
    Boolean(process.env.NETLIFY) ||
    Boolean(process.env.LAMBDA_TASK_ROOT);

  if (isServerless) {
    const tmpDbPath = '/tmp/dev.db';
    if (!fs.existsSync(tmpDbPath)) {
      const candidates = [
        path.join(process.cwd(), 'prisma', 'dev.db'),
        path.join(process.cwd(), 'dev.db'),
        path.join('/var/task', 'prisma', 'dev.db'),
        path.join('/var/task', 'dev.db'),
      ];
      for (const src of candidates) {
        if (fs.existsSync(/*turbopackIgnore: true*/ src)) {
          try {
            fs.copyFileSync(src, tmpDbPath);
            break;
          } catch (e) {
            console.error('Error copying seed db from ' + src, e);
          }
        }
      }
    }
    return `file:${tmpDbPath}`;
  }

  return process.env.DATABASE_URL || 'file:./prisma/dev.db';
}

const dbUrl = getDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: dbUrl,
      },
    },
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function ensureDbInitialized(): Promise<void> {
  if (globalForPrisma.dbInitialized) return;
  if (!globalForPrisma.initPromise) {
    globalForPrisma.initPromise = (async () => {
      try {
        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "User" (
            "id" TEXT PRIMARY KEY NOT NULL,
            "email" TEXT UNIQUE NOT NULL,
            "name" TEXT,
            "passwordHash" TEXT NOT NULL,
            "avatarUrl" TEXT,
            "role" TEXT NOT NULL DEFAULT 'user',
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
        `);
        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "DriveAccount" (
            "id" TEXT PRIMARY KEY NOT NULL,
            "email" TEXT UNIQUE NOT NULL,
            "displayName" TEXT NOT NULL DEFAULT '',
            "profilePicture" TEXT NOT NULL DEFAULT '',
            "encryptedAccessToken" TEXT NOT NULL,
            "encryptedRefreshToken" TEXT NOT NULL,
            "tokenExpiresAt" DATETIME NOT NULL,
            "totalBytes" BIGINT NOT NULL DEFAULT 16106127360,
            "usedBytes" BIGINT NOT NULL DEFAULT 0,
            "status" TEXT NOT NULL DEFAULT 'active',
            "lastSyncAt" DATETIME,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
        `);
        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "FileRecord" (
            "id" TEXT PRIMARY KEY NOT NULL,
            "filename" TEXT NOT NULL,
            "sizeBytes" BIGINT NOT NULL,
            "mimeType" TEXT NOT NULL DEFAULT 'application/octet-stream',
            "virtualPath" TEXT NOT NULL DEFAULT '/',
            "googleDriveId" TEXT,
            "isChunked" BOOLEAN NOT NULL DEFAULT 0,
            "totalChunks" INTEGER NOT NULL DEFAULT 0,
            "driveAccountId" TEXT,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "isDeleted" BOOLEAN NOT NULL DEFAULT 0,
            "deletedAt" DATETIME,
            "isStarred" BOOLEAN NOT NULL DEFAULT 0,
            "tags" TEXT NOT NULL DEFAULT ''
          );
        `);
        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "AuditLog" (
            "id" TEXT PRIMARY KEY NOT NULL,
            "action" TEXT NOT NULL,
            "details" TEXT NOT NULL,
            "userEmail" TEXT,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
        `);
        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "SharedLink" (
            "id" TEXT PRIMARY KEY NOT NULL,
            "code" TEXT UNIQUE NOT NULL,
            "fileRecordId" TEXT NOT NULL,
            "passwordHash" TEXT,
            "expiresAt" DATETIME,
            "downloadCount" INTEGER NOT NULL DEFAULT 0,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
        `);
        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "FileChunk" (
            "id" TEXT PRIMARY KEY NOT NULL,
            "fileRecordId" TEXT NOT NULL,
            "chunkIndex" INTEGER NOT NULL,
            "sizeBytes" BIGINT NOT NULL,
            "googleDriveId" TEXT NOT NULL,
            "driveAccountId" TEXT NOT NULL,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE("fileRecordId", "chunkIndex")
          );
        `);
        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "DriveNote" (
            "id" TEXT PRIMARY KEY NOT NULL,
            "title" TEXT NOT NULL,
            "content" TEXT NOT NULL,
            "category" TEXT NOT NULL DEFAULT 'reminder',
            "driveLetter" TEXT,
            "driveAccountId" TEXT,
            "color" TEXT NOT NULL DEFAULT 'amber',
            "isPinned" BOOLEAN NOT NULL DEFAULT 0,
            "tags" TEXT NOT NULL DEFAULT '',
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
        `);
        globalForPrisma.dbInitialized = true;
      } catch (err) {
        console.error('Error ensuring SQLite schema:', err);
      }
    })();
  }
  return globalForPrisma.initPromise;
}

export default prisma;
