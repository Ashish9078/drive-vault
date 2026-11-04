'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  HardDrive,
  FileText,
  Sparkles,
  Trash2,
  History,
} from 'lucide-react';
import StorageHeader from '@/components/StorageHeader';
import WindowsDrivesView, { Account } from '@/components/WindowsDrivesView';
import UploadZone from '@/components/UploadZone';
import FileBrowser from '@/components/FileBrowser';
import VaultNotesTab, { DriveNoteData } from '@/components/VaultNotesTab';
import StorageOptimizerTab from '@/components/StorageOptimizerTab';
import TrashRecoveryTab from '@/components/TrashRecoveryTab';
import ActivityAuditTab from '@/components/ActivityAuditTab';

interface Stats {
  totalPool: string;
  totalUsed: string;
  totalFree: string;
  accountCount: number;
  percentUsed: number;
}

interface FileData {
  id: string;
  filename: string;
  sizeBytes: string;
  mimeType: string;
  virtualPath: string;
  googleDriveId: string | null;
  isChunked: boolean;
  totalChunks: number;
  driveAccountId: string | null;
  createdAt: string;
  driveAccount: { email: string; displayName: string } | null;
  chunks: Array<{
    id: string;
    chunkIndex: number;
    sizeBytes: string;
    driveAccount: { email: string };
  }>;
}

export default function Dashboard() {
  const [activeMainTab, setActiveMainTab] = useState<'explorer' | 'notes' | 'optimizer' | 'trash' | 'audit'>('explorer');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalPool: '0',
    totalUsed: '0',
    totalFree: '0',
    accountCount: 0,
    percentUsed: 0,
  });
  const [files, setFiles] = useState<FileData[]>([]);
  const [notes, setNotes] = useState<DriveNoteData[]>([]);
  const [user, setUser] = useState<{ id: string; email: string; name?: string; role?: string } | null>(null);
  const [syncingAccounts, setSyncingAccounts] = useState<Set<string>>(new Set());
  const [selectedDriveId, setSelectedDriveId] = useState<string | null>(null);
  const [currentFolder, setCurrentFolder] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalFiles, setTotalFiles] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (data.authenticated && data.user) {
        setUser(data.user);
        return true;
      } else {
        setUser(null);
        window.location.href = '/login';
        return false;
      }
    } catch {
      setUser(null);
      window.location.href = '/login';
      return false;
    }
  }, []);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/accounts');
      const data = await res.json();
      setAccounts(data.accounts || []);
      setStats(data.stats || stats);
    } catch (error) {
      console.error('Failed to fetch accounts:', error);
    }
  }, []);

  const fetchFiles = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        sortBy,
        sortOrder,
        page: page.toString(),
        limit: '50',
      });
      if (searchQuery) params.set('q', searchQuery);
      if (selectedDriveId) params.set('accountId', selectedDriveId);

      const res = await fetch(`/api/files?${params}`);
      const data = await res.json();
      setFiles(data.files || []);
      setTotalFiles(data.pagination?.total || 0);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (error) {
      console.error('Failed to fetch files:', error);
    }
  }, [sortBy, sortOrder, searchQuery, page, selectedDriveId]);

  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch('/api/notes');
      const data = await res.json();
      setNotes(data.notes || []);
    } catch (error) {
      console.error('Failed to fetch notes:', error);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const isAuth = await fetchUser();
      if (isAuth) {
        await Promise.all([fetchAccounts(), fetchFiles(), fetchNotes()]);
      }
      setLoading(false);
    };
    init();
  }, [fetchUser, fetchAccounts, fetchFiles, fetchNotes]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('success') === 'connected') {
        fetchAccounts();
        fetchFiles();
        window.history.replaceState({}, '', '/');
      }
    }
  }, [fetchAccounts, fetchFiles]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleConnectAccount = async () => {
    try {
      const res = await fetch('/api/auth');
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Failed to initiate auth:', error);
    }
  };

  const handleSeedDemo = async () => {
    try {
      setIsSeeding(true);
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seed_demo' }),
      });
      if (res.ok) {
        await fetchAccounts();
        await fetchFiles();
      }
    } catch (error) {
      console.error('Failed to seed demo accounts:', error);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleClearDemo = async () => {
    if (!confirm('Clear all demo accounts?')) return;
    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear_demo' }),
      });
      if (res.ok) {
        setSelectedDriveId(null);
        await fetchAccounts();
        await fetchFiles();
      }
    } catch (error) {
      console.error('Failed to clear demo accounts:', error);
    }
  };

  const handleSync = async (accountId: string) => {
    setSyncingAccounts(prev => new Set(prev).add(accountId));
    try {
      await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });
      await fetchAccounts();
      await fetchFiles();
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setSyncingAccounts(prev => {
        const next = new Set(prev);
        next.delete(accountId);
        return next;
      });
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    if (!confirm('Are you sure you want to remove this drive account? Local file records will be deleted.')) {
      return;
    }
    try {
      await fetch('/api/accounts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });
      if (selectedDriveId === accountId) setSelectedDriveId(null);
      await fetchAccounts();
      await fetchFiles();
    } catch (error) {
      console.error('Failed to delete account:', error);
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    try {
      const res = await fetch('/api/files', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId }),
      });
      if (!res.ok) {
        throw new Error('Failed to delete file');
      }
      await fetchFiles();
      await fetchAccounts();
    } catch (error) {
      console.error('Failed to delete file:', error);
      throw error;
    }
  };

  const handleSort = (field: string, order: string) => {
    setSortBy(field);
    setSortOrder(order);
    setPage(1);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setPage(1);
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner">
          <RefreshCw size={40} className="animate-spin" />
        </div>
        <p className="loading-text">Loading DriveVault Windows Storage Pool...</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Background effects */}
      <div className="dashboard-bg">
        <div className="dashboard-bg-orb dashboard-bg-orb-1" />
        <div className="dashboard-bg-orb dashboard-bg-orb-2" />
        <div className="dashboard-bg-orb dashboard-bg-orb-3" />
      </div>

      <div className="dashboard-container">
        {/* Storage Header */}
        <StorageHeader
          totalPool={Number(stats.totalPool)}
          totalUsed={Number(stats.totalUsed)}
          accountCount={stats.accountCount}
          user={user}
          onLogout={handleLogout}
        />

        {/* VAULT MAIN NAVIGATION TABS */}
        <div className="vault-main-tabs-bar">
          <button
            onClick={() => setActiveMainTab('explorer')}
            className={`vault-main-tab-btn ${activeMainTab === 'explorer' ? 'active' : ''}`}
          >
            <HardDrive size={16} />
            <span>Devices & File Explorer</span>
            <span className="vault-main-tab-count explorer">
              {accounts.length} Drives
            </span>
          </button>

          <button
            onClick={() => setActiveMainTab('notes')}
            className={`vault-main-tab-btn ${activeMainTab === 'notes' ? 'active' : ''}`}
          >
            <FileText size={16} className="text-amber-400" />
            <span>Drive Notes & Reminders</span>
            <span className="vault-main-tab-count notes">
              {notes.length} Notes
            </span>
          </button>

          <button
            onClick={() => setActiveMainTab('optimizer')}
            className={`vault-main-tab-btn ${activeMainTab === 'optimizer' ? 'active' : ''}`}
          >
            <Sparkles size={16} className="text-purple-400" />
            <span>Storage Optimizer & Clean</span>
          </button>

          <button
            onClick={() => setActiveMainTab('trash')}
            className={`vault-main-tab-btn ${activeMainTab === 'trash' ? 'active' : ''}`}
          >
            <Trash2 size={16} className="text-rose-400" />
            <span>Recycle Bin</span>
          </button>

          <button
            onClick={() => setActiveMainTab('audit')}
            className={`vault-main-tab-btn ${activeMainTab === 'audit' ? 'active' : ''}`}
          >
            <History size={16} className="text-cyan-400" />
            <span>Activity Log</span>
          </button>
        </div>

        {activeMainTab === 'explorer' && (
          <>
            {/* WINDOWS "DEVICES AND DRIVES" SECTION */}
            <section className="section">
              <WindowsDrivesView
                accounts={accounts}
                totalPool={Number(stats.totalPool)}
                totalUsed={Number(stats.totalUsed)}
                syncingAccounts={syncingAccounts}
                selectedDriveId={selectedDriveId}
                onSelectDrive={(driveId) => {
                  setSelectedDriveId(driveId);
                  setCurrentFolder('ALL');
                  setPage(1);
                }}
                onSync={handleSync}
                onDelete={handleDeleteAccount}
                onConnectAccount={handleConnectAccount}
                onSeedDemo={handleSeedDemo}
                onClearDemo={handleClearDemo}
                isSeeding={isSeeding}
                notesCount={notes.length}
                onOpenNotes={() => setActiveMainTab('notes')}
              />
            </section>

            {/* Upload Zone */}
            <section className="section">
              <UploadZone
                onUploadComplete={() => { fetchFiles(); fetchAccounts(); }}
                currentFolder={currentFolder}
              />
            </section>

            {/* File Browser */}
            <section className="section" id="file-browser-section">
              <FileBrowser
                files={files}
                accounts={accounts}
                selectedDriveId={selectedDriveId}
                onSelectDrive={(driveId) => {
                  setSelectedDriveId(driveId);
                  setCurrentFolder('ALL');
                  setPage(1);
                }}
                onDelete={handleDeleteFile}
                onSearch={handleSearch}
                onSort={handleSort}
                sortBy={sortBy}
                sortOrder={sortOrder}
                totalFiles={totalFiles}
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
                currentFolder={currentFolder}
                onFolderChange={setCurrentFolder}
              />
            </section>
          </>
        )}

        {activeMainTab === 'notes' && (
          <section className="section">
            <VaultNotesTab
              notes={notes}
              accounts={accounts}
              files={files}
              onRefreshNotes={fetchNotes}
              onNavigateToDrive={(driveId) => {
                setSelectedDriveId(driveId);
                setCurrentFolder('ALL');
                setActiveMainTab('explorer');
                setTimeout(() => {
                  document.getElementById('file-browser-section')?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
              }}
            />
          </section>
        )}

        {activeMainTab === 'optimizer' && (
          <section className="section">
            <StorageOptimizerTab
              onRefreshData={() => {
                fetchAccounts();
                fetchFiles();
              }}
            />
          </section>
        )}

        {activeMainTab === 'trash' && (
          <section className="section">
            <TrashRecoveryTab
              onRestoreComplete={() => {
                fetchAccounts();
                fetchFiles();
              }}
            />
          </section>
        )}

        {activeMainTab === 'audit' && (
          <section className="section">
            <ActivityAuditTab />
          </section>
        )}
      </div>
    </div>
  );
}
