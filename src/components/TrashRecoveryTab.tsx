'use client';

import React, { useState, useEffect } from 'react';
import {
  Trash2,
  RotateCcw,
  AlertTriangle,
  FileText,
  RefreshCw,
  HardDrive,
  ShieldAlert,
  Loader2,
  CheckCircle2
} from 'lucide-react';

interface TrashRecoveryProps {
  onRestoreComplete: () => void;
}

interface DeletedFile {
  id: string;
  filename: string;
  sizeBytes: string;
  mimeType: string;
  virtualPath: string;
  deletedAt: string;
  driveAccount?: { email: string; displayName?: string } | null;
}

export default function TrashRecoveryTab({ onRestoreComplete }: TrashRecoveryProps) {
  const [deletedFiles, setDeletedFiles] = useState<DeletedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  const fetchTrash = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/files?trash=true&limit=100');
      const data = await res.json();
      setDeletedFiles(data.files || []);
    } catch (err) {
      console.error('Failed to load trash:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrash();
  }, []);

  const formatBytes = (bytesStr: string) => {
    const bytes = Number(bytesStr);
    if (isNaN(bytes) || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleRestore = async (fileId: string) => {
    setActionId(fileId);
    try {
      const res = await fetch('/api/files', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore', fileId }),
      });
      if (res.ok) {
        await fetchTrash();
        onRestoreComplete();
      }
    } catch (err) {
      console.error('Failed to restore file:', err);
    } finally {
      setActionId(null);
    }
  };

  const handlePermanentDelete = async (fileId: string, filename: string) => {
    if (!confirm(`PERMANENT DELETION: Are you sure you want to permanently erase "${filename}" from Google Drive cloud? This cannot be undone.`)) {
      return;
    }

    setActionId(fileId);
    try {
      const res = await fetch('/api/files', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId, permanent: true }),
      });
      if (res.ok) {
        await fetchTrash();
        onRestoreComplete();
      }
    } catch (err) {
      console.error('Failed to permanently delete file:', err);
    } finally {
      setActionId(null);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-slate-400 flex flex-col items-center justify-center">
        <RefreshCw size={36} className="animate-spin text-rose-400 mb-3" />
        <p className="text-sm font-medium">Loading Recycle Bin files...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Informative Header Alert */}
      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center space-x-3 text-xs text-amber-300">
        <AlertTriangle size={18} className="shrink-0 text-amber-400" />
        <span>
          Files in Recycle Bin can be restored at any time. When permanently deleted, they are erased from both DriveVault and your linked Google Drive accounts.
        </span>
      </div>

      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <Trash2 size={18} className="text-rose-400" />
              <span>DriveVault Recycle Bin</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {deletedFiles.length} file(s) awaiting restore or permanent deletion.
            </p>
          </div>
          <button
            onClick={fetchTrash}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>
        </div>

        {deletedFiles.length === 0 ? (
          <div className="py-12 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-slate-800/80 text-slate-400 flex items-center justify-center mb-2">
              <Trash2 size={24} />
            </div>
            <h4 className="text-sm font-semibold text-slate-200">Recycle Bin is Empty</h4>
            <p className="text-xs text-slate-400 mt-0.5">No deleted files are currently staged in the trash.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {deletedFiles.map((file) => (
              <div
                key={file.id}
                className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-center space-x-3 truncate">
                  <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 shrink-0">
                    <FileText size={20} />
                  </div>
                  <div className="truncate">
                    <h4 className="text-sm font-semibold text-slate-100 truncate">{file.filename}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {formatBytes(file.sizeBytes)} • Moved to trash on {new Date(file.deletedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    onClick={() => handleRestore(file.id)}
                    disabled={actionId === file.id}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors shadow-sm disabled:opacity-50"
                  >
                    {actionId === file.id ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <RotateCcw size={13} />
                    )}
                    <span>Restore</span>
                  </button>

                  <button
                    onClick={() => handlePermanentDelete(file.id, file.filename)}
                    disabled={actionId === file.id}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-rose-600/90 hover:bg-rose-500 text-white text-xs font-medium rounded-lg transition-colors shadow-sm disabled:opacity-50"
                  >
                    {actionId === file.id ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Trash2 size={13} />
                    )}
                    <span>Erase Permanently</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

