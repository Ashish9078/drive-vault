'use client';

import React, { useState, useEffect } from 'react';
import {
  History,
  FileUp,
  Download,
  Trash2,
  Share2,
  RefreshCw,
  FolderSync,
  Edit2,
  Star,
  CheckCircle2,
  Clock
} from 'lucide-react';

interface AuditLogItem {
  id: string;
  action: string;
  details: string;
  userEmail?: string | null;
  createdAt: string;
}

export default function ActivityAuditTab() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/audit-logs?limit=50');
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const getActionBadge = (action: string) => {
    switch (action.toLowerCase()) {
      case 'upload':
        return (
          <span className="flex items-center space-x-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-medium">
            <FileUp size={12} />
            <span>Upload</span>
          </span>
        );
      case 'download':
        return (
          <span className="flex items-center space-x-1 px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[11px] font-medium">
            <Download size={12} />
            <span>Download</span>
          </span>
        );
      case 'share':
        return (
          <span className="flex items-center space-x-1 px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[11px] font-medium">
            <Share2 size={12} />
            <span>Share</span>
          </span>
        );
      case 'delete':
        return (
          <span className="flex items-center space-x-1 px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[11px] font-medium">
            <Trash2 size={12} />
            <span>Delete</span>
          </span>
        );
      case 'restore':
        return (
          <span className="flex items-center space-x-1 px-2 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20 text-[11px] font-medium">
            <CheckCircle2 size={12} />
            <span>Restore</span>
          </span>
        );
      case 'move':
        return (
          <span className="flex items-center space-x-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[11px] font-medium">
            <FolderSync size={12} />
            <span>Move</span>
          </span>
        );
      case 'rename':
        return (
          <span className="flex items-center space-x-1 px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[11px] font-medium">
            <Edit2 size={12} />
            <span>Rename</span>
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px] font-medium">
            {action}
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-slate-400 flex flex-col items-center justify-center">
        <RefreshCw size={36} className="animate-spin text-indigo-400 mb-3" />
        <p className="text-sm font-medium">Loading activity audit log timeline...</p>
      </div>
    );
  }

  return (
    <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-base font-bold text-white flex items-center space-x-2">
            <History size={18} className="text-indigo-400" />
            <span>Storage Pool Activity & Audit Timeline</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time tracking of file transfers, deletions, link shares, and movement.
          </p>
        </div>
        <button
          onClick={fetchLogs}
          className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
        >
          <RefreshCw size={14} />
          <span>Refresh</span>
        </button>
      </div>

      {logs.length === 0 ? (
        <div className="py-12 text-center text-slate-400">
          <Clock size={36} className="mx-auto mb-2 text-slate-500" />
          <h4 className="text-sm font-semibold text-slate-200">No Activity Logged Yet</h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Actions like file moves, renames, shares, and deletions will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {logs.map((log) => (
            <div
              key={log.id}
              className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between gap-4"
            >
              <div className="flex items-center space-x-3 truncate">
                {getActionBadge(log.action)}
                <span className="text-xs text-slate-200 font-medium truncate">{log.details}</span>
              </div>
              <span className="text-[11px] text-slate-400 shrink-0 font-mono">
                {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} •{' '}
                {new Date(log.createdAt).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

