'use client';

import React, { useState, useMemo } from 'react';
import {
  Search,
  Download,
  Trash2,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  Archive,
  FileCode,
  File,
  Folder,
  FolderOpen,
  ChevronUp,
  ChevronDown,
  Layers,
  ArrowUpDown,
  Eye,
  X,
  HardDrive,
  Database,
  ArrowLeft,
  Calendar,
  Shield,
  ExternalLink,
  ChevronRight,
  FolderPlus,
  AlertTriangle,
  Lock,
  Unlock,
  ArrowRight,
  Loader2,
  CheckCircle2,
  Share2,
  FolderSync,
} from 'lucide-react';
import ShareModal from './ShareModal';
import FilePreviewModal from './FilePreviewModal';
import FolderManageModal from './FolderManageModal';
import { getDriveLetter, Account } from './WindowsDrivesView';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getFileIcon(mimeType: string, filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  if (mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
    return <ImageIcon size={19} className="text-purple-400" />;
  }
  if (mimeType.startsWith('video/') || ['mp4', 'mkv', 'webm', 'mov', 'avi'].includes(ext)) {
    return <Film size={19} className="text-pink-400" />;
  }
  if (mimeType.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(ext)) {
    return <Music size={19} className="text-cyan-400" />;
  }
  if (mimeType.includes('zip') || mimeType.includes('archive') || ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return <Archive size={19} className="text-amber-400" />;
  }
  if (mimeType.includes('text') || mimeType.includes('pdf') || ['pdf', 'txt', 'doc', 'docx', 'md'].includes(ext)) {
    return <FileText size={19} className="text-blue-400" />;
  }
  if (mimeType.includes('code') || mimeType.includes('javascript') || ['js', 'ts', 'tsx', 'json', 'py', 'sql', 'sh'].includes(ext)) {
    return <FileCode size={19} className="text-emerald-400" />;
  }
  return <File size={19} className="text-slate-400" />;
}

export interface FileData {
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
  driveAccount: {
    email: string;
    displayName: string;
  } | null;
  chunks: Array<{
    id: string;
    chunkIndex: number;
    sizeBytes: string;
    driveAccount: { email: string };
  }>;
}

interface FileBrowserProps {
  files: FileData[];
  accounts: Account[];
  selectedDriveId: string | null;
  onSelectDrive: (driveId: string | null) => void;
  onDelete: (fileId: string) => void;
  onSearch: (query: string) => void;
  onSort: (sortBy: string, sortOrder: string) => void;
  sortBy: string;
  sortOrder: string;
  totalFiles: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  currentFolder: string;
  onFolderChange: (folder: string) => void;
}

export default function FileBrowser({
  files,
  accounts,
  selectedDriveId,
  onSelectDrive,
  onDelete,
  onSearch,
  onSort,
  sortBy,
  sortOrder,
  totalFiles,
  page,
  totalPages,
  onPageChange,
  currentFolder,
  onFolderChange,
}: FileBrowserProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [previewFile, setPreviewFile] = useState<FileData | null>(null);
  const [shareTargetFile, setShareTargetFile] = useState<FileData | null>(null);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [moveTargetFile, setMoveTargetFile] = useState<FileData | null>(null);
  const [customFolders, setCustomFolders] = useState<string[]>([]);

  // 3-Step Security Deletion Workflow State
  const [deletingFile, setDeletingFile] = useState<FileData | null>(null);
  const [deleteStep, setDeleteStep] = useState<1 | 2 | 3>(1);
  const [confirmAcknowledge, setConfirmAcknowledge] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const startDeleteWorkflow = (file: FileData) => {
    setDeletingFile(file);
    setDeleteStep(1);
    setConfirmAcknowledge(false);
    setConfirmText('');
    setIsDeleting(false);
  };

  const cancelDeleteWorkflow = () => {
    setDeletingFile(null);
    setDeleteStep(1);
    setConfirmAcknowledge(false);
    setConfirmText('');
    setIsDeleting(false);
  };

  const executeFinalDelete = async () => {
    if (!deletingFile) return;
    try {
      setIsDeleting(true);
      await onDelete(deletingFile.id);
      if (previewFile?.id === deletingFile.id) {
        setPreviewFile(null);
      }
      cancelDeleteWorkflow();
    } catch (error) {
      console.error('Delete failed:', error);
      setIsDeleting(false);
    }
  };

  // Find active drive account details if a single drive is selected
  const activeDrive = useMemo(() => {
    if (!selectedDriveId) return null;
    const index = accounts.findIndex(a => a.id === selectedDriveId);
    const account = accounts.find(a => a.id === selectedDriveId);
    if (!account) return null;
    return {
      ...account,
      driveLetter: getDriveLetter(index >= 0 ? index : 0),
    };
  }, [selectedDriveId, accounts]);

  // Extract unique folders from the files list
  const availableFolders = useMemo(() => {
    const foldersSet = new Set<string>();
    customFolders.forEach(f => foldersSet.add(f));
    files.forEach(f => {
      if (f.virtualPath && f.virtualPath !== '/') {
        foldersSet.add(f.virtualPath);
      }
    });
    return Array.from(foldersSet).sort();
  }, [files, customFolders]);

  // Filter files by current folder
  const displayedFiles = useMemo(() => {
    if (currentFolder === 'ALL') return files;
    if (currentFolder === '/') {
      return files.filter(f => !f.virtualPath || f.virtualPath === '/');
    }
    return files.filter(f => f.virtualPath === currentFolder);
  }, [files, currentFolder]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    onSearch(e.target.value);
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      onSort(field, sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      onSort(field, 'asc');
    }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortBy !== field) return <ArrowUpDown size={12} className="sort-icon-inactive" />;
    return sortOrder === 'asc' 
      ? <ChevronUp size={14} className="sort-icon-active" /> 
      : <ChevronDown size={14} className="sort-icon-active" />;
  };

  return (
    <div className="file-browser">
      {/* WINDOWS EXPLORER TOP ADDRESS BAR & BREADCRUMBS */}
      <div className="win-address-bar">
        <div className="win-address-controls">
          <button
            onClick={() => {
              if (currentFolder !== 'ALL') {
                onFolderChange('ALL');
              } else if (selectedDriveId) {
                onSelectDrive(null);
              }
            }}
            disabled={!selectedDriveId && currentFolder === 'ALL'}
            className="win-nav-arrow"
            title="Go up one level (Back)"
          >
            <ArrowLeft size={16} />
          </button>
        </div>

        {/* Windows Explorer Breadcrumb Path */}
        <div className="win-breadcrumbs">
          <button
            onClick={() => {
              onSelectDrive(null);
              onFolderChange('ALL');
            }}
            className={`win-crumb ${!selectedDriveId && currentFolder === 'ALL' ? 'active' : ''}`}
          >
            <HardDrive size={14} />
            <span>This PC</span>
          </button>

          <ChevronRight size={13} className="win-crumb-sep" />

          {activeDrive ? (
            <button
              onClick={() => onFolderChange('ALL')}
              className={`win-crumb ${currentFolder === 'ALL' ? 'active' : ''}`}
            >
              <span className="win-crumb-badge">{activeDrive.driveLetter}</span>
              <span>{activeDrive.displayName || activeDrive.email.split('@')[0]}</span>
            </button>
          ) : (
            <button
              onClick={() => onFolderChange('ALL')}
              className={`win-crumb ${currentFolder === 'ALL' ? 'active' : ''}`}
            >
              <Database size={13} />
              <span>Unified Pool (V:)</span>
            </button>
          )}

          {currentFolder !== 'ALL' && (
            <>
              <ChevronRight size={13} className="win-crumb-sep" />
              <span className="win-crumb active">
                <FolderOpen size={14} className="text-amber-400" />
                <span>{currentFolder.replace('/', '') || 'Root'}</span>
              </span>
            </>
          )}
        </div>

        {/* Search Input */}
        <div className="file-browser-search">
          <Search size={15} className="file-browser-search-icon" />
          <input
            type="text"
            placeholder={activeDrive ? `Search in ${activeDrive.driveLetter}...` : "Search across all drives..."}
            value={searchQuery}
            onChange={handleSearch}
            className="file-browser-search-input"
          />
        </div>
      </div>

      {/* ACTIVE DRIVE BANNER (WHEN INSIDE A SPECIFIC GOOGLE DRIVE) */}
      {activeDrive && (
        <div className="win-active-drive-banner">
          <div className="win-active-drive-left">
            <div className="win-active-drive-badge">
              <span>{activeDrive.driveLetter}</span>
            </div>
            <div>
              <h3 className="win-active-drive-title">
                Google Drive ({activeDrive.driveLetter}) — {activeDrive.displayName || activeDrive.email}
              </h3>
              <p className="win-active-drive-sub">
                Account: {activeDrive.email} • {formatBytes(Number(activeDrive.usedBytes))} used of {formatBytes(Number(activeDrive.totalBytes))}
              </p>
            </div>
          </div>
          <button
            onClick={() => onSelectDrive(null)}
            className="win-exit-drive-btn"
          >
            <ArrowLeft size={14} />
            <span>Exit to Unified Pool (V:)</span>
          </button>
        </div>
      )}

      {/* FOLDERS DIRECTORY ROW (WINDOWS FOLDER CHIPS) */}
      <div className="win-folder-row flex items-center justify-between">
        <div className="flex items-center space-x-3 overflow-x-auto py-1">
          <div className="win-folder-row-title shrink-0">
            <Folder size={15} className="text-amber-400" />
            <span>Folders & Directories:</span>
          </div>

          <div className="win-folder-chips">
            <button
              onClick={() => onFolderChange('ALL')}
              className={`win-folder-chip ${currentFolder === 'ALL' ? 'active' : ''}`}
            >
              <Layers size={14} />
              <span>All Files ({files.length})</span>
            </button>

            <button
              onClick={() => onFolderChange('/')}
              className={`win-folder-chip ${currentFolder === '/' ? 'active' : ''}`}
            >
              <Folder size={14} />
              <span>Root / ({files.filter(f => !f.virtualPath || f.virtualPath === '/').length})</span>
            </button>

            {availableFolders.map((folder) => {
              const count = files.filter(f => f.virtualPath === folder).length;
              return (
                <button
                  key={folder}
                  onClick={() => onFolderChange(folder)}
                  className={`win-folder-chip ${currentFolder === folder ? 'active' : ''}`}
                >
                  <Folder size={14} className="text-amber-400" />
                  <span>{folder.replace('/', '')}</span>
                  <span className="win-folder-chip-count">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={() => {
            setMoveTargetFile(null);
            setIsFolderModalOpen(true);
          }}
          className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:text-white bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl transition-all shadow-sm shrink-0"
        >
          <FolderPlus size={14} />
          <span>New Folder</span>
        </button>
      </div>

      {/* FILE TABLE LIST */}
      <div className="file-browser-table-wrapper">
        <table className="file-browser-table">
          <thead>
            <tr>
              <th
                className="file-th-sortable"
                onClick={() => handleSort('filename')}
              >
                <span>Name</span>
                <SortIcon field="filename" />
              </th>
              <th
                className="file-th-sortable"
                onClick={() => handleSort('sizeBytes')}
              >
                <span>Size</span>
                <SortIcon field="sizeBytes" />
              </th>
              <th>Folder Path</th>
              <th>Host Google Drive</th>
              <th
                className="file-th-sortable"
                onClick={() => handleSort('createdAt')}
              >
                <span>Date Modified</span>
                <SortIcon field="createdAt" />
              </th>
              <th className="text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayedFiles.length === 0 && (
              <tr>
                <td colSpan={6} className="file-empty-state">
                  <div className="file-empty-inner">
                    <File size={40} className="file-empty-icon" />
                    <p>No files in this directory</p>
                    <p className="file-empty-hint">
                      Upload files to this drive and folder using the upload zone above.
                    </p>
                  </div>
                </td>
              </tr>
            )}
            {displayedFiles.map((file) => {
              const driveIndex = accounts.findIndex(a => a.id === file.driveAccountId);
              const driveLetter = file.driveAccountId ? getDriveLetter(driveIndex >= 0 ? driveIndex : 0) : 'V:';

              return (
                <tr
                  key={file.id}
                  className="file-row cursor-pointer"
                  onClick={() => setPreviewFile(file)}
                  title="Click to preview file & download details"
                >
                  <td>
                    <div className="file-cell-name">
                      {getFileIcon(file.mimeType, file.filename)}
                      <div>
                        <span className="file-cell-filename">{file.filename}</span>
                        {file.isChunked && (
                          <span className="file-cell-chunked">
                            Multi-Drive Chunked ({file.totalChunks} drives)
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="file-cell-size font-medium">
                    {formatBytes(Number(file.sizeBytes))}
                  </td>
                  <td
                    className="file-cell-folder"
                    onClick={(e) => {
                      e.stopPropagation();
                      onFolderChange(file.virtualPath || '/');
                    }}
                  >
                    <span className="file-folder-badge clickable" title={`Filter by folder: ${file.virtualPath || '/'}`}>
                      <Folder size={11} className="text-amber-400" />
                      <span>{file.virtualPath || '/'}</span>
                    </span>
                  </td>
                  <td
                    className="file-cell-drive"
                    onClick={(e) => {
                      if (file.driveAccountId) {
                        e.stopPropagation();
                        onSelectDrive(file.driveAccountId);
                      }
                    }}
                  >
                    {file.isChunked ? (
                      <div className="file-drive-list">
                        <span className="win-drive-inline-badge master">V: Virtual Pool</span>
                        <span className="text-xs text-indigo-300">({file.chunks.length} chunks)</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 cursor-pointer" title={`Enter Drive ${driveLetter}`}>
                        <span className="win-drive-inline-badge">{driveLetter}</span>
                        <span className="file-drive-chip">
                          {file.driveAccount?.displayName || file.driveAccount?.email.split('@')[0] || 'Google Drive'}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="file-cell-date">
                    {new Date(file.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="file-cell-actions">
                      {/* Preview Button */}
                      <button
                        onClick={() => setPreviewFile(file)}
                        className="file-action-btn file-action-preview"
                        title="Preview File"
                      >
                        <Eye size={14} />
                      </button>

                      {/* Share Button */}
                      <button
                        onClick={() => setShareTargetFile(file)}
                        className="file-action-btn file-action-share hover:text-indigo-400"
                        title="Create secure share link"
                      >
                        <Share2 size={14} />
                      </button>

                      {/* Move Folder Button */}
                      <button
                        onClick={() => {
                          setMoveTargetFile(file);
                          setIsFolderModalOpen(true);
                        }}
                        className="file-action-btn file-action-move hover:text-amber-400"
                        title="Move to another folder"
                      >
                        <FolderSync size={14} />
                      </button>

                      {/* Download Button */}
                      <a
                        href={`/api/download?fileId=${file.id}`}
                        download={file.filename}
                        className="file-action-btn file-action-download"
                        title={`Download from ${file.isChunked ? 'Drive Pool' : driveLetter}`}
                      >
                        <Download size={14} />
                      </a>

                      {/* Delete Button (3-Step Security) */}
                      <button
                        onClick={() => startDeleteWorkflow(file)}
                        className="file-action-btn file-action-delete"
                        title="Delete file (3-Step Security Verification)"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="file-pagination">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="file-page-btn"
          >
            Previous
          </button>
          <span className="file-page-info">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="file-page-btn"
          >
            Next
          </button>
        </div>
      )}

      {/* FOLDER MANAGE & MOVE MODAL */}
      <FolderManageModal
        isOpen={isFolderModalOpen}
        onClose={() => {
          setIsFolderModalOpen(false);
          setMoveTargetFile(null);
        }}
        availableFolders={availableFolders}
        selectedFile={moveTargetFile}
        onFolderCreated={(newFolder) => {
          setCustomFolders((prev) => Array.from(new Set([...prev, newFolder])));
          onFolderChange(newFolder);
        }}
        onFileMoved={() => {
          onFolderChange(currentFolder);
        }}
      />

      {/* SHARE MODAL */}
      <ShareModal
        file={shareTargetFile}
        isOpen={!!shareTargetFile}
        onClose={() => setShareTargetFile(null)}
      />

      {/* FULL-FEATURED IN-APP FILE PREVIEW & MEDIA PLAYER */}
      <FilePreviewModal
        file={previewFile}
        isOpen={!!previewFile}
        onClose={() => setPreviewFile(null)}
        onDownload={(fileId, filename) => {
          const a = document.createElement('a');
          a.href = `/api/download?fileId=${fileId}`;
          a.download = filename;
          a.click();
        }}
      />

      {/* 3-STEP FILE DELETION SECURITY CONFIRMATION MODAL */}
      {deletingFile && (
        <div className="file-modal-overlay" onClick={cancelDeleteWorkflow}>
          <div
            className="file-delete-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="file-delete-modal-header">
              <div className="file-delete-modal-title-row">
                <div className="file-delete-shield-icon">
                  <Shield size={20} className="text-red-400" />
                </div>
                <div>
                  <h3 className="file-delete-modal-title">
                    3-Step File Deletion Security Lock
                  </h3>
                  <p className="file-delete-modal-sub">
                    Accidental Click Protection • Step {deleteStep} of 3
                  </p>
                </div>
              </div>
              <button
                onClick={cancelDeleteWorkflow}
                disabled={isDeleting}
                className="file-modal-close"
                title="Cancel deletion"
              >
                <X size={18} />
              </button>
            </div>

            {/* Stepper Progress Bar */}
            <div className="file-delete-stepper">
              <div className={`file-delete-step-item ${deleteStep >= 1 ? 'active' : ''} ${deleteStep > 1 ? 'completed' : ''}`}>
                <div className="file-delete-step-circle">
                  {deleteStep > 1 ? <CheckCircle2 size={13} /> : '1'}
                </div>
                <span className="file-delete-step-label">1. Verify File</span>
              </div>
              <div className={`file-delete-step-line ${deleteStep >= 2 ? 'active' : ''}`} />
              <div className={`file-delete-step-item ${deleteStep >= 2 ? 'active' : ''} ${deleteStep > 2 ? 'completed' : ''}`}>
                <div className="file-delete-step-circle">
                  {deleteStep > 2 ? <CheckCircle2 size={13} /> : '2'}
                </div>
                <span className="file-delete-step-label">2. Cloud Warning</span>
              </div>
              <div className={`file-delete-step-line ${deleteStep >= 3 ? 'active' : ''}`} />
              <div className={`file-delete-step-item ${deleteStep === 3 ? 'active' : ''}`}>
                <div className="file-delete-step-circle">
                  {deleteStep === 3 ? <Lock size={12} /> : '3'}
                </div>
                <span className="file-delete-step-label">3. Code Unlock</span>
              </div>
            </div>

            {/* STEP 1: Verify File Identity */}
            {deleteStep === 1 && (
              <div className="file-delete-body">
                <div className="file-delete-alert step1">
                  <AlertTriangle size={20} className="text-amber-400 shrink-0" />
                  <div>
                    <h4 className="font-semibold text-amber-200 text-sm">Step 1: Verify Selected File</h4>
                    <p className="text-xs text-amber-300/80 mt-0.5">
                      Check the file name, size, and location to ensure you did not accidentally tap or click the wrong item.
                    </p>
                  </div>
                </div>

                <div className="file-delete-card-preview">
                  <div className="flex items-center gap-3">
                    {getFileIcon(deletingFile.mimeType, deletingFile.filename)}
                    <div className="overflow-hidden">
                      <div className="font-semibold text-white truncate text-sm">
                        {deletingFile.filename}
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                        <span>{formatBytes(Number(deletingFile.sizeBytes))}</span>
                        <span>•</span>
                        <span className="text-amber-300 font-mono">{deletingFile.virtualPath || '/'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-700/60 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400 block">Host Drive:</span>
                      <span className="font-semibold text-slate-200">
                        {deletingFile.isChunked
                          ? 'Multi-Drive Virtual Pool'
                          : deletingFile.driveAccount?.displayName || deletingFile.driveAccount?.email || 'Google Drive'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Folder Location:</span>
                      <span className="font-mono text-cyan-300">{deletingFile.virtualPath || '/'}</span>
                    </div>
                  </div>
                </div>

                <div className="file-delete-footer">
                  <button
                    onClick={cancelDeleteWorkflow}
                    className="file-delete-cancel-btn"
                  >
                    Cancel (Keep File Safe)
                  </button>
                  <button
                    onClick={() => setDeleteStep(2)}
                    className="file-delete-next-btn"
                  >
                    <span>Proceed to Step 2</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: Cloud Risk Warning & Mandatory Acknowledgment */}
            {deleteStep === 2 && (
              <div className="file-delete-body">
                <div className="file-delete-alert step2">
                  <AlertTriangle size={22} className="text-red-400 shrink-0" />
                  <div>
                    <h4 className="font-semibold text-red-200 text-sm">Step 2: Permanent Cloud Deletion Warning</h4>
                    <p className="text-xs text-red-300/80 mt-1 leading-relaxed">
                      This action will permanently erase <strong className="text-white">"{deletingFile.filename}"</strong> from Google Drive.
                    </p>
                  </div>
                </div>

                <div className="file-delete-warning-box">
                  <ul className="text-xs space-y-2 text-slate-300">
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
                      <span>This file will <strong>NOT</strong> go to Google Drive recycle bin or trash.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
                      <span>Once deleted from the cloud, this file cannot be recovered.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
                      <span>Your DriveVault virtual pool storage quota will be freed up immediately.</span>
                    </li>
                  </ul>
                </div>

                {/* Mandatory Checkbox */}
                <label className="file-delete-checkbox-label">
                  <input
                    type="checkbox"
                    checked={confirmAcknowledge}
                    onChange={(e) => setConfirmAcknowledge(e.target.checked)}
                    className="file-delete-checkbox"
                  />
                  <span className="text-xs text-slate-200 select-none font-medium">
                    I understand that this file will be permanently removed from Google Drive and cannot be recovered.
                  </span>
                </label>

                <div className="file-delete-footer">
                  <button
                    onClick={() => setDeleteStep(1)}
                    className="file-delete-cancel-btn"
                  >
                    ⬅ Back to Step 1
                  </button>
                  <button
                    onClick={() => setDeleteStep(3)}
                    disabled={!confirmAcknowledge}
                    className="file-delete-next-btn danger"
                  >
                    <span>Proceed to Final Step 3</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: Security Code Unlock */}
            {deleteStep === 3 && (
              <div className="file-delete-body">
                <div className="file-delete-alert step3">
                  <Lock size={22} className="text-red-400 shrink-0" />
                  <div>
                    <h4 className="font-semibold text-red-200 text-sm">Step 3 of 3: Type Security Code to Unlock</h4>
                    <p className="text-xs text-red-300/80 mt-1">
                      To prevent accidental touchscreen taps or mouse misclicks, type <strong className="text-white underline">DELETE</strong> in capital letters below:
                    </p>
                  </div>
                </div>

                <div className="file-delete-code-input-box">
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Security Authorization Code:
                  </label>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="Type DELETE to authorize"
                    autoFocus
                    disabled={isDeleting}
                    className={`file-delete-code-input ${confirmText.trim().toUpperCase() === 'DELETE' ? 'valid' : ''}`}
                  />
                  <div className="file-delete-code-hint">
                    {confirmText.trim().toUpperCase() === 'DELETE' ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 size={13} /> Code verified — Final deletion authorized
                      </span>
                    ) : (
                      <span className="text-slate-400">
                        Type exact word: <code className="text-red-400 font-bold bg-red-950/40 px-1 py-0.5 rounded border border-red-500/30">DELETE</code>
                      </span>
                    )}
                  </div>
                </div>

                <div className="file-delete-footer">
                  <button
                    onClick={() => setDeleteStep(2)}
                    disabled={isDeleting}
                    className="file-delete-cancel-btn"
                  >
                    ⬅ Back to Step 2
                  </button>

                  <button
                    onClick={executeFinalDelete}
                    disabled={confirmText.trim().toUpperCase() !== 'DELETE' || isDeleting}
                    className="file-delete-final-btn"
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        <span>Deleting File from Cloud...</span>
                      </>
                    ) : confirmText.trim().toUpperCase() === 'DELETE' ? (
                      <>
                        <Unlock size={15} />
                        <span>Permanently Delete File</span>
                      </>
                    ) : (
                      <>
                        <Lock size={15} />
                        <span>Locked (Type DELETE)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
