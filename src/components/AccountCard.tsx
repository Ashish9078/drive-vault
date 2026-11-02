'use client';

import React from 'react';
import {
  RefreshCw,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  XCircle,
} from 'lucide-react';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

interface Account {
  id: string;
  email: string;
  displayName: string;
  profilePicture: string;
  totalBytes: string;
  usedBytes: string;
  status: string;
  lastSyncAt: string | null;
}

interface AccountCardProps {
  account: Account;
  onSync: (accountId: string) => void;
  onDelete: (accountId: string) => void;
  syncing: boolean;
}

export default function AccountCard({ account, onSync, onDelete, syncing }: AccountCardProps) {
  const totalBytes = Number(account.totalBytes);
  const usedBytes = Number(account.usedBytes);
  const freeBytes = totalBytes - usedBytes;
  const percentUsed = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0;

  const statusConfig: Record<string, { icon: React.ReactNode; label: string; className: string }> = {
    active: {
      icon: <CheckCircle2 size={14} />,
      label: 'Active',
      className: 'account-status-active',
    },
    needs_reauth: {
      icon: <AlertTriangle size={14} />,
      label: 'Needs Reauth',
      className: 'account-status-reauth',
    },
    syncing: {
      icon: <Loader2 size={14} className="animate-spin" />,
      label: 'Syncing...',
      className: 'account-status-syncing',
    },
    error: {
      icon: <XCircle size={14} />,
      label: 'Error',
      className: 'account-status-error',
    },
  };

  const status = statusConfig[account.status] || statusConfig.active;

  const getBarColor = () => {
    if (percentUsed < 50) return 'bg-gradient-to-r from-emerald-500 to-teal-400';
    if (percentUsed < 75) return 'bg-gradient-to-r from-amber-500 to-yellow-400';
    return 'bg-gradient-to-r from-red-500 to-rose-400';
  };

  return (
    <div className="account-card">
      {/* Decorative glow */}
      <div className="account-card-glow" />

      <div className="account-card-content">
        {/* Header */}
        <div className="account-card-header">
          <div className="account-card-avatar-row">
            <div className="account-card-avatar">
              {account.profilePicture ? (
                <img
                  src={account.profilePicture}
                  alt={account.displayName}
                  className="account-card-avatar-img"
                />
              ) : (
                <span className="account-card-avatar-letter">
                  {account.email[0].toUpperCase()}
                </span>
              )}
            </div>
            <div className="account-card-info">
              <p className="account-card-name">
                {account.displayName || account.email.split('@')[0]}
              </p>
              <p className="account-card-email">{account.email}</p>
            </div>
          </div>

          <div className={`account-status-badge ${status.className}`}>
            {status.icon}
            <span>{status.label}</span>
          </div>
        </div>

        {/* Storage bar */}
        <div className="account-card-storage">
          <div className="account-card-storage-labels">
            <span>{formatBytes(usedBytes)}</span>
            <span>{formatBytes(totalBytes)}</span>
          </div>
          <div className="account-card-bar-track">
            <div
              className={`account-card-bar-fill ${getBarColor()}`}
              style={{ width: `${Math.min(percentUsed, 100)}%` }}
            />
          </div>
          <div className="account-card-storage-meta">
            <span>{percentUsed.toFixed(1)}% used</span>
            <span>{formatBytes(freeBytes)} free</span>
          </div>
        </div>

        {/* Actions */}
        <div className="account-card-actions">
          <button
            onClick={() => onSync(account.id)}
            disabled={syncing || account.status === 'syncing'}
            className="account-action-btn account-action-sync"
          >
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            <span>Sync</span>
          </button>

          {account.status === 'needs_reauth' && (
            <a
              href="/api/auth"
              className="account-action-btn account-action-reauth"
            >
              <AlertTriangle size={14} />
              <span>Reauth</span>
            </a>
          )}

          <button
            onClick={() => onDelete(account.id)}
            className="account-action-btn account-action-delete"
          >
            <Trash2 size={14} />
          </button>
        </div>

        {/* Last sync */}
        {account.lastSyncAt && (
          <p className="account-card-sync-time">
            Last synced: {new Date(account.lastSyncAt).toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}
