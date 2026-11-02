'use client';

import React, { useState } from 'react';
import {
  HardDrive,
  Cloud,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  XCircle,
  FolderOpen,
  Plus,
  LayoutGrid,
  List,
  Sparkles,
  Filter,
  Database,
  FileText,
} from 'lucide-react';

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function getDriveLetter(index: number): string {
  // Letters C through Z (24 standard drive letters)
  const letters = [
    'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
    'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'W', 'X', 'Y', 'Z'
  ];
  if (index < letters.length) {
    return `${letters[index]}:`;
  }
  // For 25, 50, 100+ accounts:
  return `G${index + 1}:`;
}

export interface Account {
  id: string;
  email: string;
  displayName: string;
  profilePicture: string;
  totalBytes: string;
  usedBytes: string;
  status: string;
  lastSyncAt: string | null;
}

interface WindowsDrivesViewProps {
  accounts: Account[];
  totalPool: number;
  totalUsed: number;
  syncingAccounts: Set<string>;
  selectedDriveId: string | null;
  onSelectDrive: (accountId: string | null) => void;
  onSync: (accountId: string) => void;
  onDelete: (accountId: string) => void;
  onConnectAccount: () => void;
  onSeedDemo?: () => void;
  onClearDemo?: () => void;
  isSeeding?: boolean;
  notesCount?: number;
  onOpenNotes?: (accountId?: string) => void;
}

export default function WindowsDrivesView({
  accounts,
  totalPool,
  totalUsed,
  syncingAccounts,
  selectedDriveId,
  onSelectDrive,
  onSync,
  onDelete,
  onConnectAccount,
  onSeedDemo,
  onClearDemo,
  isSeeding = false,
  notesCount,
  onOpenNotes,
}: WindowsDrivesViewProps) {
  const [viewMode, setViewMode] = useState<'tiles' | 'details'>('tiles');

  const totalFree = Math.max(0, totalPool - totalUsed);
  const totalPercentUsed = totalPool > 0 ? (totalUsed / totalPool) * 100 : 0;
  const isMasterWarning = totalPercentUsed >= 90;

  return (
    <div className="windows-pc-container">
      {/* Windows Explorer Section Header */}
      <div className="win-header">
        <div className="win-header-left">
          <div className="win-icon-wrapper">
            <HardDrive size={22} className="win-pc-icon" />
            <span className="win-os-badge">Win</span>
          </div>
          <div>
            <div className="win-title-row">
              <h2 className="win-title">Devices and drives</h2>
              <span className="win-count-chip">({accounts.length + (accounts.length > 0 ? 1 : 0)})</span>
            </div>
            <p className="win-subtitle">
              Unlimited Google Drive Cloud Volumes • Windows File Explorer Mounts
            </p>
          </div>
        </div>

        {/* Header Controls */}
        <div className="win-header-actions">
          {/* View Mode Toggle */}
          <div className="win-view-toggle">
            <button
              onClick={() => setViewMode('tiles')}
              className={`win-toggle-btn ${viewMode === 'tiles' ? 'active' : ''}`}
              title="Tiles view (Windows Classic)"
            >
              <LayoutGrid size={15} />
              <span>Tiles</span>
            </button>
            <button
              onClick={() => setViewMode('details')}
              className={`win-toggle-btn ${viewMode === 'details' ? 'active' : ''}`}
              title="Details view (Table)"
            >
              <List size={15} />
              <span>Details</span>
            </button>
          </div>

          {/* Quick Demo Button if accounts are 0 */}
          {accounts.length === 0 && onSeedDemo && (
            <button
              onClick={onSeedDemo}
              disabled={isSeeding}
              className="win-demo-btn"
              title="Populate 10 Google Drives with 150GB to test Windows dashboard"
            >
              <Sparkles size={15} className={isSeeding ? 'animate-spin' : ''} />
              <span>{isSeeding ? 'Mounting...' : 'Load 10 Demo Drives'}</span>
            </button>
          )}

          {/* Reset demo if demo accounts exist */}
          {accounts.some(a => a.email.includes('demo') || a.id.startsWith('demo-')) && onClearDemo && (
            <button
              onClick={onClearDemo}
              className="win-clear-demo-btn"
              title="Clear demo accounts"
            >
              Clear Demo
            </button>
          )}

          {/* Drive Notes Shortcut */}
          {onOpenNotes && (
            <button
              onClick={() => onOpenNotes()}
              className="win-notes-shortcut-btn"
              title="Open Drive Notes & Reminders tab"
            >
              <FileText size={15} className="text-amber-400" />
              <span>Drive Notes {notesCount !== undefined ? `(${notesCount})` : ''}</span>
            </button>
          )}

          {/* Connect Drive Button — UNLIMITED, NO CAP */}
          <button
            onClick={onConnectAccount}
            className="win-add-drive-btn"
            title="Connect an additional Google Drive account (Unlimited)"
          >
            <Plus size={16} />
            <span>Map Cloud Drive</span>
          </button>
        </div>
      </div>

      {/* Selected Drive Filter Indicator */}
      {selectedDriveId && (
        <div className="win-filter-banner">
          <div className="win-filter-info">
            <Filter size={14} />
            <span>
              Filtered: Showing files exclusively stored on{' '}
              <strong>
                Drive {getDriveLetter(accounts.findIndex(a => a.id === selectedDriveId))}{' '}
                ({accounts.find(a => a.id === selectedDriveId)?.displayName || accounts.find(a => a.id === selectedDriveId)?.email})
              </strong>
            </span>
          </div>
          <button
            onClick={() => onSelectDrive(null)}
            className="win-clear-filter-btn"
          >
            Show All Drives (Unified Pool)
          </button>
        </div>
      )}

      {/* TILES VIEW (Windows Explorer Classic) */}
      {viewMode === 'tiles' && (
        <div className="win-drives-grid">
          {/* 1. MASTER VIRTUAL DRIVE (V:) */}
          {accounts.length > 0 && (
            <div
              className={`win-drive-tile win-master-drive ${selectedDriveId === null ? 'selected' : ''}`}
              onClick={() => {
                onSelectDrive(null);
                document.getElementById('file-browser-section')?.scrollIntoView({ behavior: 'smooth' });
              }}
              title="Click to enter all files across the aggregated pool"
            >
              <div className="win-drive-tile-inner">
                {/* Windows Drive Icon with Master Badge */}
                <div className="win-drive-icon-col">
                  <div className="win-drive-hardware-icon master-glow">
                    <Database size={30} className="win-master-icon" />
                    <span className="win-letter-badge master">V:</span>
                  </div>
                </div>

                {/* Drive Info & Windows Capacity Bar */}
                <div className="win-drive-info-col">
                  <div className="win-drive-label-row">
                    <span className="win-drive-name">DriveVault Unified Pool (V:)</span>
                    <span className="win-pool-tag">Virtual Multi-Mount</span>
                  </div>

                  {/* Windows Style Capacity Bar */}
                  <div className="win-progress-track">
                    <div
                      className={`win-progress-fill ${isMasterWarning ? 'danger' : 'primary'}`}
                      style={{ width: `${Math.min(totalPercentUsed, 100)}%` }}
                    />
                  </div>

                  {/* Windows Free Space Caption */}
                  <div className="win-space-caption">
                    <strong>{formatBytes(totalFree)} free</strong> of {formatBytes(totalPool)}
                  </div>

                  <div className="win-drive-footer">
                    <span className="win-drive-subtext">
                      {accounts.length} linked accounts • NTFS VFS
                    </span>
                    <div className="win-tile-actions" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => {
                          onSelectDrive(null);
                          document.getElementById('file-browser-section')?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="win-btn-enter-drive master"
                        title="Browse all files in pool"
                      >
                        <FolderOpen size={12} />
                        <span>{selectedDriveId === null ? 'Active' : 'Open Pool'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. INDIVIDUAL GOOGLE DRIVES (C:, D:, E: ...) */}
          {accounts.map((account, index) => {
            const letter = getDriveLetter(index);
            const total = Number(account.totalBytes);
            const used = Number(account.usedBytes);
            const free = Math.max(0, total - used);
            const percentUsed = total > 0 ? (used / total) * 100 : 0;
            const isWarning = percentUsed >= 90;
            const isSelected = selectedDriveId === account.id;
            const isSyncing = syncingAccounts.has(account.id);

            return (
              <div
                key={account.id}
                className={`win-drive-tile ${isSelected ? 'selected' : ''}`}
                onClick={() => {
                  onSelectDrive(isSelected ? null : account.id);
                  document.getElementById('file-browser-section')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <div className="win-drive-tile-inner">
                  {/* Drive Hardware Icon + Letter Badge */}
                  <div className="win-drive-icon-col">
                    <div className="win-drive-hardware-icon">
                      <Cloud size={28} className="win-cloud-icon" />
                      <span className="win-letter-badge">{letter}</span>
                    </div>

                    {/* Status dot */}
                    <div
                      className={`win-status-indicator ${account.status}`}
                      title={`Status: ${account.status}`}
                    />
                  </div>

                  {/* Drive Content */}
                  <div className="win-drive-info-col">
                    <div className="win-drive-label-row">
                      <span className="win-drive-name" title={account.email}>
                        Google Drive ({letter})
                      </span>
                      <span className="win-drive-user">
                        {account.displayName || account.email.split('@')[0]}
                      </span>
                    </div>

                    {/* Windows Style Storage Bar */}
                    <div className="win-progress-track">
                      <div
                        className={`win-progress-fill ${isWarning ? 'danger' : 'normal'}`}
                        style={{ width: `${Math.min(percentUsed, 100)}%` }}
                      />
                    </div>

                    {/* Windows Free of Total Text */}
                    <div className="win-space-caption">
                      <strong>{formatBytes(free)} free</strong> of {formatBytes(total)}
                    </div>

                    {/* Footer Row: Email, Enter Button, and Actions */}
                    <div className="win-drive-footer">
                      <span className="win-drive-email" title={account.email}>
                        {account.email}
                      </span>

                      <div className="win-tile-actions" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            onSelectDrive(isSelected ? null : account.id);
                            document.getElementById('file-browser-section')?.scrollIntoView({ behavior: 'smooth' });
                          }}
                          className={`win-btn-enter-drive ${isSelected ? 'active' : ''}`}
                          title={`Enter Drive (${letter}) to view its files`}
                        >
                          <FolderOpen size={12} />
                          <span>{isSelected ? 'Inside' : 'Enter'}</span>
                        </button>

                        {onOpenNotes && (
                          <button
                            onClick={() => onOpenNotes(account.id)}
                            className="win-btn-mini"
                            title={`View & write reminder notes for Drive (${letter})`}
                          >
                            <FileText size={12} className="text-amber-400" />
                          </button>
                        )}

                        <button
                          onClick={() => onSync(account.id)}
                          disabled={isSyncing || account.status === 'syncing'}
                          className="win-btn-mini"
                          title="Sync Google Drive quota & files"
                        >
                          <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
                        </button>
                        <button
                          onClick={() => onDelete(account.id)}
                          className="win-btn-mini delete"
                          title="Disconnect this Google Drive"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* 3. Empty Slot / Add Drive Card — ALWAYS AVAILABLE (NO 10 LIMIT) */}
          <div
            className="win-drive-tile win-add-slot-card"
            onClick={onConnectAccount}
            title="Click to mount another Google Drive account (Unlimited)"
          >
            <div className="win-add-slot-inner">
              <div className="win-add-slot-icon">
                <Plus size={26} />
                <span className="win-letter-badge empty">
                  {getDriveLetter(accounts.length)}
                </span>
              </div>
              <div className="win-add-slot-text">
                <span className="win-add-slot-title">
                  Mount Next Drive ({getDriveLetter(accounts.length)})
                </span>
                <span className="win-add-slot-desc">
                  Connect 50, 100+ accounts • 15GB pooled per drive
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DETAILS VIEW (Windows Explorer Table List) */}
      {viewMode === 'details' && (
        <div className="win-details-wrapper">
          <table className="win-details-table">
            <thead>
              <tr>
                <th className="win-th">Drive Letter</th>
                <th className="win-th">Drive Name / Account</th>
                <th className="win-th">File System / Type</th>
                <th className="win-th text-right">Free Space</th>
                <th className="win-th text-right">Total Capacity</th>
                <th className="win-th">Capacity Usage</th>
                <th className="win-th">Status</th>
                <th className="win-th text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {/* Virtual Pool Row */}
              <tr
                className={`win-tr master ${selectedDriveId === null ? 'selected-row' : ''}`}
                onClick={() => onSelectDrive(null)}
              >
                <td className="win-td">
                  <div className="win-drive-td-badge master">
                    <Database size={16} />
                    <span>(V:)</span>
                  </div>
                </td>
                <td className="win-td">
                  <span className="font-semibold text-white">DriveVault Virtual Pool (Unified)</span>
                </td>
                <td className="win-td text-muted">Cloud VFS Multi-Mount</td>
                <td className="win-td text-right font-medium text-emerald-400">
                  {formatBytes(totalFree)} free
                </td>
                <td className="win-td text-right text-slate-300">{formatBytes(totalPool)}</td>
                <td className="win-td">
                  <div className="win-details-bar-wrapper">
                    <div className="win-progress-track table-bar">
                      <div
                        className={`win-progress-fill ${isMasterWarning ? 'danger' : 'primary'}`}
                        style={{ width: `${Math.min(totalPercentUsed, 100)}%` }}
                      />
                    </div>
                    <span className="win-details-percent">{totalPercentUsed.toFixed(1)}%</span>
                  </div>
                </td>
                <td className="win-td">
                  <span className="win-status-badge active">
                    <CheckCircle2 size={12} /> Active Pool
                  </span>
                </td>
                <td className="win-td text-center">
                  <button
                    onClick={(e) => { e.stopPropagation(); onSelectDrive(null); }}
                    className="win-btn-table"
                  >
                    View All Files
                  </button>
                </td>
              </tr>

              {/* Individual Drives Rows */}
              {accounts.map((account, index) => {
                const letter = getDriveLetter(index);
                const total = Number(account.totalBytes);
                const used = Number(account.usedBytes);
                const free = Math.max(0, total - used);
                const percentUsed = total > 0 ? (used / total) * 100 : 0;
                const isWarning = percentUsed >= 90;
                const isSelected = selectedDriveId === account.id;
                const isSyncing = syncingAccounts.has(account.id);

                return (
                  <tr
                    key={account.id}
                    className={`win-tr ${isSelected ? 'selected-row' : ''}`}
                    onClick={() => onSelectDrive(isSelected ? null : account.id)}
                  >
                    <td className="win-td">
                      <div className="win-drive-td-badge">
                        <HardDrive size={15} />
                        <span>({letter})</span>
                      </div>
                    </td>
                    <td className="win-td">
                      <div className="win-account-cell">
                        <span className="win-cell-name">
                          {account.displayName || account.email.split('@')[0]}
                        </span>
                        <span className="win-cell-email">{account.email}</span>
                      </div>
                    </td>
                    <td className="win-td text-muted">Google Drive (OAuth 2.0)</td>
                    <td className="win-td text-right font-medium text-cyan-300">
                      {formatBytes(free)} free
                    </td>
                    <td className="win-td text-right text-slate-300">{formatBytes(total)}</td>
                    <td className="win-td">
                      <div className="win-details-bar-wrapper">
                        <div className="win-progress-track table-bar">
                          <div
                            className={`win-progress-fill ${isWarning ? 'danger' : 'normal'}`}
                            style={{ width: `${Math.min(percentUsed, 100)}%` }}
                          />
                        </div>
                        <span className="win-details-percent">{percentUsed.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="win-td">
                      <span className={`win-status-badge ${account.status}`}>
                        {account.status === 'active' && <CheckCircle2 size={12} />}
                        {account.status === 'syncing' && <Loader2 size={12} className="animate-spin" />}
                        {account.status === 'needs_reauth' && <AlertTriangle size={12} />}
                        {account.status === 'error' && <XCircle size={12} />}
                        <span>{account.status}</span>
                      </span>
                    </td>
                    <td className="win-td text-center" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => onSync(account.id)}
                          disabled={isSyncing}
                          className="win-btn-mini"
                          title="Sync Drive"
                        >
                          <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
                        </button>
                        <button
                          onClick={() => onDelete(account.id)}
                          className="win-btn-mini delete"
                          title="Remove Drive"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty State when no drives are connected */}
      {accounts.length === 0 && (
        <div className="win-empty-box">
          <div className="win-empty-content">
            <HardDrive size={52} className="win-empty-icon" />
            <h3 className="win-empty-title">No Google Drives Mounted</h3>
            <p className="win-empty-desc">
              Mount your Google Drive accounts (15GB each, 50, 100+ accounts supported) to form an unlimited unified storage pool.
              Each drive will appear here with its assigned drive letter and live free space.
            </p>
            <div className="win-empty-buttons">
              <button onClick={onConnectAccount} className="win-btn-primary">
                <Plus size={16} />
                <span>Connect Google Drive</span>
              </button>
              {onSeedDemo && (
                <button
                  onClick={onSeedDemo}
                  disabled={isSeeding}
                  className="win-btn-secondary"
                >
                  <Sparkles size={16} className={isSeeding ? 'animate-spin' : ''} />
                  <span>Mount Demo Drives</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
