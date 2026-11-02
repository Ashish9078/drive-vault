'use client';

import React, { useState } from 'react';
import {
  FolderPlus,
  X,
  Folder,
  ArrowRight,
  MoveRight,
  Check,
  Loader2
} from 'lucide-react';

interface FolderManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableFolders: string[];
  selectedFile?: {
    id: string;
    filename: string;
    virtualPath: string;
  } | null;
  onFolderCreated: (folderPath: string) => void;
  onFileMoved?: () => void;
}

export default function FolderManageModal({
  isOpen,
  onClose,
  availableFolders,
  selectedFile,
  onFolderCreated,
  onFileMoved,
}: FolderManageModalProps) {
  const [folderName, setFolderName] = useState('');
  const [targetFolder, setTargetFolder] = useState(selectedFile?.virtualPath || '/');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName.trim()) return;

    let cleanName = folderName.trim().replace(/^\/+|\/+$/g, '');
    if (!cleanName.startsWith('/')) {
      cleanName = `/${cleanName}`;
    }

    onFolderCreated(cleanName);
    setFolderName('');
    onClose();
  };

  const handleMoveFile = async () => {
    if (!selectedFile) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/files', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'move',
          fileId: selectedFile.id,
          virtualPath: targetFolder,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to move file');
      }

      if (onFileMoved) onFileMoved();
      onClose();
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || 'Move failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {selectedFile ? <MoveRight size={18} /> : <FolderPlus size={18} />}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">
                {selectedFile ? 'Move File to Folder' : 'Create Virtual Folder'}
              </h3>
              <p className="text-xs text-slate-400">
                {selectedFile ? selectedFile.filename : 'Organize files across Google Drive accounts'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* MOVE FILE MODE */}
          {selectedFile ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Select Destination Folder:</label>
                <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                  <button
                    type="button"
                    onClick={() => setTargetFolder('/')}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                      targetFolder === '/'
                        ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800/40'
                    }`}
                  >
                    <span className="flex items-center space-x-2">
                      <Folder size={14} className="text-amber-400" />
                      <span>Root / (Default directory)</span>
                    </span>
                    {targetFolder === '/' && <Check size={14} className="text-amber-400" />}
                  </button>

                  {availableFolders.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setTargetFolder(f)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                        targetFolder === f
                          ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                          : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800/40'
                      }`}
                    >
                      <span className="flex items-center space-x-2 font-mono">
                        <Folder size={14} className="text-amber-400" />
                        <span>{f}</span>
                      </span>
                      {targetFolder === f && <Check size={14} className="text-amber-400" />}
                    </button>
                  ))}
                </div>
              </div>

              {error && <p className="text-xs text-rose-400">{error}</p>}

              <button
                type="button"
                onClick={handleMoveFile}
                disabled={isSubmitting}
                className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-xl shadow-lg transition-all disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <>
                    <MoveRight size={14} />
                    <span>Confirm Move</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            /* CREATE FOLDER MODE */
            <form onSubmit={handleCreateFolder} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Folder Name:</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 font-mono text-xs">
                    /
                  </div>
                  <input
                    type="text"
                    value={folderName}
                    onChange={(e) => setFolderName(e.target.value)}
                    placeholder="e.g. Work, Photos, Documents"
                    autoFocus
                    required
                    className="w-full pl-6 pr-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <p className="text-[11px] text-slate-400">
                  Virtual folders group files across multiple connected Google Drive accounts seamlessly.
                </p>
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-xl shadow-lg transition-all"
              >
                <FolderPlus size={14} />
                <span>Create Folder</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

