import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getDriveClient } from '@/lib/google-drive';

export async function GET(request: NextRequest) {
  try {
    const fileId = request.nextUrl.searchParams.get('fileId');

    if (!fileId) {
      return NextResponse.json(
        { error: 'fileId is required' },
        { status: 400 }
      );
    }

    const file = await prisma.fileRecord.findUnique({
      where: { id: fileId },
      include: {
        driveAccount: true,
        chunks: {
          orderBy: { chunkIndex: 'asc' },
          include: {
            driveAccount: true,
          },
        },
      },
    });

    if (!file) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    const inline = request.nextUrl.searchParams.get('inline') === 'true';
    const contentDisposition = inline ? 'inline' : `attachment; filename="${encodeURIComponent(file.filename)}"`;

    // Demo file fallback for instant test downloads
    if (
      file.googleDriveId?.startsWith('demo_gdrive_id_') ||
      file.driveAccount?.encryptedAccessToken === 'demo_token'
    ) {
      const demoContent = Buffer.from(
        `--- DriveVault Downloaded File ---\n` +
        `Filename: ${file.filename}\n` +
        `Size: ${file.sizeBytes.toString()} bytes\n` +
        `MIME Type: ${file.mimeType}\n` +
        `Virtual Path: ${file.virtualPath}\n` +
        `Host Google Drive: ${file.driveAccount?.displayName || file.driveAccount?.email || 'DriveVault Pool'}\n` +
        `Stored on Account: ${file.driveAccount?.email || 'Multi-chunk Drive Pool'}\n` +
        `Downloaded At: ${new Date().toISOString()}\n\n` +
        `This file was retrieved from your unified DriveVault storage pool.`
      );

      return new NextResponse(demoContent, {
        headers: {
          'Content-Type': file.mimeType.startsWith('text/') ? file.mimeType : 'application/octet-stream',
          'Content-Disposition': contentDisposition,
          'Content-Length': demoContent.length.toString(),
        },
      });
    }

    // Single file download — stream directly from Google Drive
    if (!file.isChunked && file.googleDriveId && file.driveAccountId) {
      const drive = await getDriveClient(file.driveAccountId);

      const response = await drive.files.get(
        { fileId: file.googleDriveId, alt: 'media' },
        { responseType: 'stream' }
      );

      const stream = response.data as unknown as NodeJS.ReadableStream;
      const readableStream = new ReadableStream({
        start(controller) {
          stream.on('data', (chunk: Buffer) => {
            controller.enqueue(new Uint8Array(chunk));
          });
          stream.on('end', () => {
            controller.close();
          });
          stream.on('error', (err: Error) => {
            controller.error(err);
          });
        },
      });

      return new NextResponse(readableStream, {
        headers: {
          'Content-Type': file.mimeType,
          'Content-Disposition': contentDisposition,
          'Content-Length': file.sizeBytes.toString(),
        },
      });
    }

    // Chunked file download — reconstruct from multiple drives
    if (file.isChunked && file.chunks.length > 0) {
      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            for (const chunk of file.chunks) {
              const drive = await getDriveClient(chunk.driveAccountId);
              const response = await drive.files.get(
                { fileId: chunk.googleDriveId, alt: 'media' },
                { responseType: 'stream' }
              );

              const chunkStream = response.data as unknown as NodeJS.ReadableStream;
              
              await new Promise<void>((resolve, reject) => {
                chunkStream.on('data', (data: Buffer) => {
                  controller.enqueue(new Uint8Array(data));
                });
                chunkStream.on('end', () => resolve());
                chunkStream.on('error', (err: Error) => reject(err));
              });
            }
            controller.close();
          } catch (err) {
            controller.error(err);
          }
        },
      });

      return new NextResponse(readableStream, {
        headers: {
          'Content-Type': file.mimeType,
          'Content-Disposition': contentDisposition,
          'Content-Length': file.sizeBytes.toString(),
        },
      });
    }

    return NextResponse.json(
      { error: 'File has no download source' },
      { status: 404 }
    );
  } catch (error) {
    console.error('Download failed:', error);
    return NextResponse.json(
      { error: 'Download failed' },
      { status: 500 }
    );
  }
}
