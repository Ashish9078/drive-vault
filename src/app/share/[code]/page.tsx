'use client';

import React, { useState, useEffect } from 'react';
import {
  Download,
  Lock,
  Unlock,
  FileText,
  AlertCircle,
  Clock,
  ShieldCheck,
  CheckCircle2,
  HardDrive
} from 'lucide-react';
import { useParams } from 'next/navigation';

export default function PublicSharePage() {
  const params = useParams();
  const code = params?.code as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState<{
    code: string;
    fileId: string;
    filename: string;
    sizeBytes: string;
    mimeType: string;
    isPasswordProtected: boolean;
    expiresAt: string | null;
  } | null>(null);

  const [password, setPassword] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [downloadReadyUrl, setDownloadReadyUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    fetch(`/api/share?code=${code}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(res.status === 410 ? 'This link has expired.' : 'Shared link not found.');
        }
        return res.json();
      })
      .then((data) => {
        setFileInfo(data);
        setLoading(false);
        if (!data.isPasswordProtected) {
          setDownloadReadyUrl(`/api/download?fileId=${data.fileId}`);
        }
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [code]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setUnlocking(true);
    setUnlockError(null);
    try {
      const res = await fetch('/api/share/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to verify password');
      }
      setDownloadReadyUrl(data.downloadUrl);
    } catch (err: unknown) {
      const errorObj = err as Error;
      setUnlockError(errorObj.message || 'Incorrect password');
    } finally {
      setUnlocking(false);
    }
  };

  const formatBytes = (bytesStr: string) => {
    const bytes = Number(bytesStr);
    if (isNaN(bytes) || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 selection:bg-blue-500 selection:text-white">
      {/* Background radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(37,99,235,0.12),transparent_70%)] pointer-events-none" />

      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl">
        {/* Brand header */}
        <div className="px-6 py-5 border-b border-slate-800/80 bg-slate-900/60 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <HardDrive size={20} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">DriveVault Share</h2>
              <p className="text-[11px] text-slate-400">Secure Cloud Transfer</p>
            </div>
          </div>
          <div className="flex items-center space-x-1 text-emerald-400 text-xs font-medium bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20">
            <ShieldCheck size={14} />
            <span>Encrypted</span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6">
          {loading ? (
            <div className="py-12 text-center text-slate-400">
              <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs">Verifying security token...</p>
            </div>
          ) : error ? (
            <div className="py-8 text-center">
              <div className="w-14 h-14 mx-auto rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mb-3 border border-rose-500/20">
                <AlertCircle size={28} />
              </div>
              <h3 className="text-base font-semibold text-rose-300">Link Unavailable</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">{error}</p>
            </div>
          ) : fileInfo ? (
            <div className="space-y-6">
              {/* File Info Box */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/90 flex items-center space-x-4">
                <div className="p-3 rounded-lg bg-blue-500/10 text-blue-400 shrink-0">
                  <FileText size={28} />
                </div>
                <div className="truncate flex-1">
                  <h3 className="text-sm font-semibold text-slate-100 truncate" title={fileInfo.filename}>
                    {fileInfo.filename}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {formatBytes(fileInfo.sizeBytes)} • {fileInfo.mimeType}
                  </p>
                </div>
              </div>

              {/* Expiry Badge */}
              {fileInfo.expiresAt && (
                <div className="flex items-center space-x-2 text-xs text-amber-400/90 bg-amber-500/10 px-3 py-2 rounded-lg border border-amber-500/20">
                  <Clock size={14} />
                  <span>Expires on: {new Date(fileInfo.expiresAt).toLocaleString()}</span>
                </div>
              )}

              {/* Password prompt if required */}
              {fileInfo.isPasswordProtected && !downloadReadyUrl && (
                <form onSubmit={handleUnlock} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
                      <Lock size={13} className="text-amber-400" />
                      <span>This file is password protected</span>
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter security password"
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                    />
                  </div>

                  {unlockError && (
                    <p className="text-xs text-rose-400 flex items-center space-x-1">
                      <AlertCircle size={13} />
                      <span>{unlockError}</span>
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={unlocking}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white text-sm font-medium rounded-xl shadow-lg shadow-blue-600/20 transition-all disabled:opacity-50"
                  >
                    {unlocking ? (
                      <span>Unlocking...</span>
                    ) : (
                      <>
                        <Unlock size={16} />
                        <span>Unlock File</span>
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* Download Action Ready */}
              {downloadReadyUrl && (
                <div className="space-y-3">
                  {fileInfo.isPasswordProtected && (
                    <div className="flex items-center space-x-2 text-xs text-emerald-400 bg-emerald-500/10 px-3 py-2 rounded-lg border border-emerald-500/20">
                      <CheckCircle2 size={15} />
                      <span>Password accepted. Download unlocked!</span>
                    </div>
                  )}

                  <a
                    href={downloadReadyUrl}
                    download={fileInfo.filename}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98] text-white text-sm font-semibold rounded-xl shadow-lg shadow-blue-500/25 transition-all text-center"
                  >
                    <Download size={18} />
                    <span>Download File ({formatBytes(fileInfo.sizeBytes)})</span>
                  </a>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

