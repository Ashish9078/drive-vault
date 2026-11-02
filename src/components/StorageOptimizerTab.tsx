'use client';

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Trash2,
  AlertTriangle,
  HardDrive,
  Copy,
  Folder,
  RefreshCw,
  CheckCircle2,
  Loader2
} from 'lucide-react';

interface StorageOptimizerProps {
  onRefreshData: () => void;
}

interface DuplicateGroup {
  filename: string;
  sizeBytes: string;
  copiesCount: number;
  wastedBytes: string;
  files: Array<{
    id: string;
    filename: string;
    sizeBytes: string;
    virtualPath: string;
    driveAccount?: { email: string; displayName?: string } | null;
    createdAt: string;
  }>;
}

interface LargeFile {
  id: string;
  filename: string;
  sizeBytes: string;
  virtualPath: string;
  driveAccount?: { email: string; displayName?: string } | null;
  createdAt: string;
}

export default function StorageOptimizerTab({ onRefreshData }: StorageOptimizerProps) {
  const [loading, setLoading] = useState(true);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [largeFiles, setLargeFiles] = useState<LargeFile[]>([]);
  const [wastedBytes, setWastedBytes] = useState('0');
  const [totalScanned, setTotalScanned] = useState(0);
  const [cleaningId, setCleaningId] = useState<string | null>(null);

  const fetchAnalysis = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/storage-optimizer');
      const data = await res.json();
      setDuplicateGroups(data.duplicateGroups || []);
      setLargeFiles(data.largeFiles || []);
      setWastedBytes(data.wastedBytes || '0');
      setTotalScanned(data.totalScanned || 0);
    } catch (err) {
      console.error('Failed to load storage analysis:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalysis();
  }, []);

  const formatBytes = (bytesStr: string) => {
    const bytes = Number(bytesStr);
    if (isNaN(bytes) || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleCleanDuplicate = async (keepFileId: string, removeFileIds: string[]) => {
    if (!confirm(`Delete ${removeFileIds.length} duplicate copy/copies to recycle bin?`)) return;

    setCleaningId(keepFileId);
    try {
      for (const id of removeFileIds) {
        await fetch('/api/files', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileId: id, permanent: false }),
        });
      }
      await fetchAnalysis();
      onRefreshData();
    } catch (err) {
      console.error('Failed to clean duplicates:', err);
    } finally {
      setCleaningId(null);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-slate-400 flex flex-col items-center justify-center">
        <RefreshCw size={36} className="animate-spin text-cyan-400 mb-3" />
        <p className="text-sm font-medium">Scanning multi-account storage pool for duplicates & large files...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Metric Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/60 border border-slate-800 shadow-lg">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Sparkles size={22} />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Potential Space Saved</p>
              <h3 className="text-xl font-bold text-white mt-0.5">{formatBytes(wastedBytes)}</h3>
            </div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/60 border border-slate-800 shadow-lg">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Copy size={22} />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Duplicate File Clusters</p>
              <h3 className="text-xl font-bold text-white mt-0.5">{duplicateGroups.length} Groups</h3>
            </div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/60 border border-slate-800 shadow-lg">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <HardDrive size={22} />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Total Files Inspected</p>
              <h3 className="text-xl font-bold text-white mt-0.5">{totalScanned} Files</h3>
            </div>
          </div>
        </div>
      </div>

      {/* DUPLICATE FILES FINDER */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <Copy size={18} className="text-amber-400" />
              <span>Duplicate File Finder</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Identical files replicated across different Google Drive accounts or directories.
            </p>
          </div>
          <button
            onClick={fetchAnalysis}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <RefreshCw size={14} />
            <span>Rescan</span>
          </button>
        </div>

        {duplicateGroups.length === 0 ? (
          <div className="py-10 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-2 border border-emerald-500/20">
              <CheckCircle2 size={24} />
            </div>
            <h4 className="text-sm font-semibold text-slate-200">No Duplicates Found</h4>
            <p className="text-xs text-slate-400 mt-0.5">Your Google Drive storage pool is completely optimized!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {duplicateGroups.map((group, idx) => {
              const keepFile = group.files[0];
              const duplicatesToRemove = group.files.slice(1).map((f) => f.id);

              return (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1 truncate flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-semibold text-slate-100 truncate">{group.filename}</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                        {group.copiesCount} copies ({formatBytes(group.wastedBytes)} wasted)
                      </span>
                    </div>

                    <div className="text-xs text-slate-400 space-y-1">
                      {group.files.map((file, fIdx) => (
                        <div key={file.id} className="flex items-center space-x-2">
                          <span className="font-mono text-[10px] text-slate-500">
                            {fIdx === 0 ? '[Original]' : `[Copy #${fIdx}]`}
                          </span>
                          <span className="text-cyan-300 font-mono">{file.virtualPath || '/'}</span>
                          <span>•</span>
                          <span>{file.driveAccount?.displayName || file.driveAccount?.email || 'Drive Account'}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => handleCleanDuplicate(keepFile.id, duplicatesToRemove)}
                    disabled={cleaningId === keepFile.id}
                    className="flex items-center justify-center space-x-1.5 px-3.5 py-2 bg-amber-600/90 hover:bg-amber-500 text-white text-xs font-semibold rounded-xl shadow-md transition-all shrink-0 disabled:opacity-50"
                  >
                    {cleaningId === keepFile.id ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Recycling...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 size={14} />
                        <span>Keep 1 & Recycle {duplicatesToRemove.length} Copies</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* TOP 10 LARGEST FILES */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center space-x-2">
            <HardDrive size={18} className="text-blue-400" />
            <span>Top Space-Consuming Files</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">The largest individual files consuming your aggregated pool quota.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2.5 font-medium">Filename</th>
                <th className="py-2.5 font-medium">Virtual Path</th>
                <th className="py-2.5 font-medium">Host Drive</th>
                <th className="py-2.5 font-medium text-right">Size</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {largeFiles.map((file) => (
                <tr key={file.id} className="hover:bg-slate-800/30">
                  <td className="py-2.5 text-slate-200 font-medium truncate max-w-[200px]">{file.filename}</td>
                  <td className="py-2.5 text-cyan-300 font-mono">{file.virtualPath || '/'}</td>
                  <td className="py-2.5 text-slate-400">
                    {file.driveAccount?.displayName || file.driveAccount?.email || 'Unified Drive'}
                  </td>
                  <td className="py-2.5 text-right font-semibold text-slate-100">{formatBytes(file.sizeBytes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

