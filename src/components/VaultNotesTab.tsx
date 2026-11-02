'use client';

import React, { useState, useMemo } from 'react';
import {
  FileText,
  Plus,
  Search,
  Pin,
  PinOff,
  Trash2,
  Edit3,
  Copy,
  Check,
  HardDrive,
  Folder,
  Tag,
  Sparkles,
  Calendar,
  X,
  AlertTriangle,
  Layers,
  ArrowRight,
  Database,
  ExternalLink,
} from 'lucide-react';
import { Account, getDriveLetter } from './WindowsDrivesView';
import { FileData } from './FileBrowser';

export interface DriveNoteData {
  id: string;
  title: string;
  content: string;
  category: string;
  driveLetter: string | null;
  driveAccountId: string | null;
  color: string;
  isPinned: boolean;
  tags: string;
  createdAt: string;
  updatedAt: string;
  driveAccount: {
    id: string;
    email: string;
    displayName: string;
  } | null;
}

interface VaultNotesTabProps {
  notes: DriveNoteData[];
  accounts: Account[];
  files: FileData[];
  onRefreshNotes: () => void;
  onNavigateToDrive?: (driveId: string | null) => void;
}

const COLOR_OPTIONS = [
  { id: 'amber', label: 'Amber Sticky', border: '#f59e0b', bg: 'rgba(245, 158, 11, 0.08)', text: '#fde68a' },
  { id: 'cyan', label: 'Cyber Cyan', border: '#06b6d4', bg: 'rgba(6, 182, 212, 0.08)', text: '#a5f3fc' },
  { id: 'emerald', label: 'Emerald Safe', border: '#10b981', bg: 'rgba(16, 185, 129, 0.08)', text: '#a7f3d0' },
  { id: 'purple', label: 'Neon Purple', border: '#a855f7', bg: 'rgba(168, 85, 247, 0.08)', text: '#e9d5ff' },
  { id: 'rose', label: 'Crimson Alert', border: '#f43f5e', bg: 'rgba(244, 63, 94, 0.08)', text: '#fecdd3' },
];

const TEMPLATES = [
  {
    name: 'Drive File Mapping',
    title: 'Drive {DRIVE} File Inventory',
    content: "📁 Drive {DRIVE} Allocation:\n• Stored Folder: /Documents\n• Primary Use: Core records and shared media\n• Keep safe: Do not modify without verifying pool quota.",
    category: 'mapping',
  },
  {
    name: 'Important Reminder',
    title: '⚠️ Urgent: Drive {DRIVE} File Retention',
    content: "Notice:\n• File: [Specify file name here]\n• Stored on: Drive {DRIVE}\n• Critical rule: Keep until Q4 audit is complete.",
    category: 'reminder',
  },
  {
    name: 'Multi-Drive Split Log',
    title: '📦 Large Chunked File Mapping',
    content: "File: [File_Name.zip] is split across:\n• Chunk 1 -> Drive (C:)\n• Chunk 2 -> Drive (D:)\n• Total pool size: [X] GB",
    category: 'mapping',
  },
];

export default function VaultNotesTab({
  notes,
  accounts,
  files,
  onRefreshNotes,
  onNavigateToDrive,
}: VaultNotesTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilterDrive, setSelectedFilterDrive] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<DriveNoteData | null>(null);
  const [copiedNoteId, setCopiedNoteId] = useState<string | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('reminder');
  const [selectedDriveId, setSelectedDriveId] = useState<string>('');
  const [color, setColor] = useState('amber');
  const [isPinned, setIsPinned] = useState(false);
  const [tags, setTags] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filtered notes
  const filteredNotes = useMemo(() => {
    return notes.filter((n) => {
      // Search query
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchTitle = n.title.toLowerCase().includes(q);
        const matchContent = n.content.toLowerCase().includes(q);
        const matchTags = n.tags.toLowerCase().includes(q);
        const matchDrive = (n.driveLetter || '').toLowerCase().includes(q);
        if (!matchTitle && !matchContent && !matchTags && !matchDrive) return false;
      }

      // Drive filter
      if (selectedFilterDrive !== 'all') {
        if (selectedFilterDrive === 'pool') {
          if (n.driveLetter !== 'V:' && n.driveAccountId !== null) return false;
        } else if (n.driveAccountId !== selectedFilterDrive) {
          return false;
        }
      }

      // Category filter
      if (selectedCategory !== 'all' && n.category !== selectedCategory) {
        return false;
      }

      return true;
    });
  }, [notes, searchQuery, selectedFilterDrive, selectedCategory]);

  const openNewNoteModal = () => {
    setEditingNote(null);
    setTitle('');
    setContent('');
    setCategory('reminder');
    setSelectedDriveId(accounts[0]?.id || '');
    setColor('amber');
    setIsPinned(false);
    setTags('');
    setIsEditorOpen(true);
  };

  const openEditNoteModal = (note: DriveNoteData) => {
    setEditingNote(note);
    setTitle(note.title);
    setContent(note.content);
    setCategory(note.category);
    setSelectedDriveId(note.driveAccountId || '');
    setColor(note.color || 'amber');
    setIsPinned(note.isPinned);
    setTags(note.tags);
    setIsEditorOpen(true);
  };

  const handleApplyTemplate = (tmpl: typeof TEMPLATES[0]) => {
    const accIndex = accounts.findIndex(a => a.id === selectedDriveId);
    const letter = accIndex >= 0 ? getDriveLetter(accIndex) : '(C:)';
    setTitle(tmpl.title.replace('{DRIVE}', letter));
    setContent(tmpl.content.replaceAll('{DRIVE}', letter));
    setCategory(tmpl.category);
  };

  const handleAttachFile = (file: FileData) => {
    const snippet = `\n• File: ${file.filename} (${file.virtualPath || '/'}, Host: ${file.driveAccount?.displayName || file.driveAccount?.email || 'Pool'})`;
    setContent((prev) => prev + snippet);
  };

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    setIsSubmitting(true);
    try {
      const accIndex = accounts.findIndex(a => a.id === selectedDriveId);
      const driveLetter = selectedDriveId ? getDriveLetter(accIndex >= 0 ? accIndex : 0) : null;

      if (editingNote) {
        // Update
        await fetch('/api/notes', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingNote.id,
            title,
            content,
            category,
            driveLetter,
            driveAccountId: selectedDriveId || null,
            color,
            isPinned,
            tags,
          }),
        });
      } else {
        // Create
        await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            content,
            category,
            driveLetter,
            driveAccountId: selectedDriveId || null,
            color,
            isPinned,
            tags,
          }),
        });
      }

      setIsEditorOpen(false);
      onRefreshNotes();
    } catch (error) {
      console.error('Failed to save note:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTogglePin = async (note: DriveNoteData) => {
    try {
      await fetch('/api/notes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: note.id,
          isPinned: !note.isPinned,
        }),
      });
      onRefreshNotes();
    } catch (error) {
      console.error('Failed to toggle pin:', error);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Delete this reminder note?')) return;
    try {
      await fetch('/api/notes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: noteId }),
      });
      onRefreshNotes();
    } catch (error) {
      console.error('Failed to delete note:', error);
    }
  };

  const handleCopyNote = (note: DriveNoteData) => {
    const text = `${note.title}\nDrive: ${note.driveLetter || 'Unified Pool'}\n\n${note.content}`;
    navigator.clipboard.writeText(text);
    setCopiedNoteId(note.id);
    setTimeout(() => setCopiedNoteId(null), 2000);
  };

  return (
    <div className="vault-notes-container">
      {/* Top Banner / Controls Header */}
      <div className="vault-notes-header">
        <div className="vault-notes-title-group">
          <div className="vault-notes-icon-box">
            <FileText size={24} className="text-amber-400" />
            <span className="vault-notes-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="vault-notes-title">Vault Reminders & Drive Notes</h2>
              <span className="vault-notes-count-badge">
                {notes.length} {notes.length === 1 ? 'Note' : 'Notes'}
              </span>
            </div>
            <p className="vault-notes-subtitle">
              Record which files belong to which Google Drive • Track cloud mappings & important memos
            </p>
          </div>
        </div>

        {/* Action Button */}
        <button onClick={openNewNoteModal} className="vault-notes-add-btn">
          <Plus size={16} />
          <span>New Drive Reminder</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="vault-notes-toolbar">
        {/* Search Input */}
        <div className="vault-notes-search">
          <Search size={15} className="vault-notes-search-icon" />
          <input
            type="text"
            placeholder="Search notes, tags, files or drive letters (e.g. C:, Quantum)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="vault-notes-search-input"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-white">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter by Drive */}
        <div className="vault-notes-filter-drive">
          <HardDrive size={14} className="text-cyan-400" />
          <select
            value={selectedFilterDrive}
            onChange={(e) => setSelectedFilterDrive(e.target.value)}
            className="vault-notes-select"
          >
            <option value="all">All Drives (Overview)</option>
            <option value="pool">Unified Virtual Pool (V:)</option>
            {accounts.map((acc, idx) => (
              <option key={acc.id} value={acc.id}>
                Google Drive ({getDriveLetter(idx)}) - {acc.displayName || acc.email}
              </option>
            ))}
          </select>
        </div>

        {/* Category Pill Toggle */}
        <div className="vault-notes-category-pills">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`vault-cat-pill ${selectedCategory === 'all' ? 'active' : ''}`}
          >
            All
          </button>
          <button
            onClick={() => setSelectedCategory('reminder')}
            className={`vault-cat-pill ${selectedCategory === 'reminder' ? 'active' : ''}`}
          >
            Reminders
          </button>
          <button
            onClick={() => setSelectedCategory('mapping')}
            className={`vault-cat-pill ${selectedCategory === 'mapping' ? 'active' : ''}`}
          >
            Drive Mapping
          </button>
        </div>
      </div>

      {/* NOTES GRID */}
      {filteredNotes.length === 0 ? (
        <div className="vault-notes-empty">
          <FileText size={48} className="text-slate-600 mb-3" />
          <h3 className="text-base font-semibold text-slate-300">No Reminder Notes Found</h3>
          <p className="text-xs text-slate-400 max-w-sm text-center mt-1">
            {searchQuery || selectedFilterDrive !== 'all'
              ? 'No notes match your active search or drive filter. Try clearing filters.'
              : 'Write your first note to remember which files belong to which Google Drive account!'}
          </p>
          <button onClick={openNewNoteModal} className="vault-notes-empty-btn mt-4">
            <Plus size={15} />
            <span>Create First Drive Reminder Note</span>
          </button>
        </div>
      ) : (
        <div className="vault-notes-grid">
          {filteredNotes.map((note) => {
            const colorMeta = COLOR_OPTIONS.find(c => c.id === note.color) || COLOR_OPTIONS[0];

            return (
              <div
                key={note.id}
                className={`vault-note-card ${note.isPinned ? 'pinned' : ''}`}
                style={{
                  borderColor: colorMeta.border,
                  backgroundColor: colorMeta.bg,
                }}
              >
                {/* Note Top Bar */}
                <div className="vault-note-top">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {note.driveLetter ? (
                      <span
                        className="vault-note-drive-badge cursor-pointer"
                        title="Click to view this drive's files"
                        onClick={() => onNavigateToDrive && onNavigateToDrive(note.driveAccountId)}
                      >
                        <HardDrive size={11} />
                        <span>Drive ({note.driveLetter})</span>
                      </span>
                    ) : (
                      <span className="vault-note-drive-badge pool">
                        <Database size={11} />
                        <span>Unified Pool (V:)</span>
                      </span>
                    )}

                    <span className="vault-note-cat-badge">
                      {note.category}
                    </span>
                  </div>

                  {/* Pin / Actions */}
                  <div className="vault-note-actions">
                    <button
                      onClick={() => handleTogglePin(note)}
                      className={`vault-note-action-btn ${note.isPinned ? 'active' : ''}`}
                      title={note.isPinned ? 'Unpin note' : 'Pin note to top'}
                    >
                      {note.isPinned ? <Pin size={13} className="text-amber-400" /> : <PinOff size={13} />}
                    </button>
                    <button
                      onClick={() => handleCopyNote(note)}
                      className="vault-note-action-btn"
                      title="Copy note text"
                    >
                      {copiedNoteId === note.id ? (
                        <Check size={13} className="text-emerald-400" />
                      ) : (
                        <Copy size={13} />
                      )}
                    </button>
                    <button
                      onClick={() => openEditNoteModal(note)}
                      className="vault-note-action-btn"
                      title="Edit note"
                    >
                      <Edit3 size={13} />
                    </button>
                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      className="vault-note-action-btn delete"
                      title="Delete note"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Note Title */}
                <h3 className="vault-note-card-title" style={{ color: colorMeta.text }}>
                  {note.title}
                </h3>

                {/* Account detail if attached */}
                {note.driveAccount && (
                  <div className="vault-note-account-row">
                    <span className="text-slate-400">Account:</span>
                    <span className="text-slate-200 font-medium">
                      {note.driveAccount.displayName || note.driveAccount.email}
                    </span>
                  </div>
                )}

                {/* Note Content */}
                <div className="vault-note-content">
                  {note.content.split('\n').map((line, idx) => (
                    <p key={idx} className={line.startsWith('•') ? 'vault-note-bullet' : ''}>
                      {line}
                    </p>
                  ))}
                </div>

                {/* Tags if present */}
                {note.tags && (
                  <div className="vault-note-tags">
                    {note.tags.split(',').map((tag, idx) => (
                      <span key={idx} className="vault-note-tag-chip">
                        #{tag.trim()}
                      </span>
                    ))}
                  </div>
                )}

                {/* Note Card Footer */}
                <div className="vault-note-footer">
                  <span className="vault-note-date">
                    <Calendar size={11} />
                    <span>{new Date(note.updatedAt).toLocaleDateString()}</span>
                  </span>

                  {note.driveAccountId && onNavigateToDrive && (
                    <button
                      onClick={() => onNavigateToDrive(note.driveAccountId)}
                      className="vault-note-jump-btn"
                      title="Open this Google Drive in File Explorer"
                    >
                      <span>Open Drive ({note.driveLetter})</span>
                      <ArrowRight size={11} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* NOTE CREATION / EDITING MODAL */}
      {isEditorOpen && (
        <div className="file-modal-overlay" onClick={() => setIsEditorOpen(false)}>
          <div
            className="vault-note-editor-card"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="vault-note-editor-header">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-amber-400" />
                <h3 className="font-semibold text-white">
                  {editingNote ? 'Edit Drive Reminder Note' : 'Create New Drive Reminder Note'}
                </h3>
              </div>
              <button
                onClick={() => setIsEditorOpen(false)}
                className="file-modal-close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Template Inserter */}
            <div className="vault-note-templates-bar">
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Sparkles size={12} className="text-amber-400" />
                <span>Quick Templates:</span>
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {TEMPLATES.map((tmpl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleApplyTemplate(tmpl)}
                    className="vault-note-template-chip"
                  >
                    {tmpl.name}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSaveNote} className="vault-note-form">
              {/* Title input */}
              <div className="vault-note-form-group">
                <label className="vault-note-label">Note Title:</label>
                <input
                  type="text"
                  placeholder="e.g. Drive (C:) holds personal photos and project code"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="vault-note-input"
                />
              </div>

              {/* Drive selector & Category row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="vault-note-form-group">
                  <label className="vault-note-label">Target Google Drive:</label>
                  <select
                    value={selectedDriveId}
                    onChange={(e) => setSelectedDriveId(e.target.value)}
                    className="vault-note-input"
                  >
                    <option value="">Unified Virtual Pool (V:)</option>
                    {accounts.map((acc, idx) => (
                      <option key={acc.id} value={acc.id}>
                        Drive ({getDriveLetter(idx)}) — {acc.displayName || acc.email}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="vault-note-form-group">
                  <label className="vault-note-label">Category:</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="vault-note-input"
                  >
                    <option value="reminder">Reminder ⏰</option>
                    <option value="mapping">Drive Mapping 🗺️</option>
                    <option value="backup">Backup Notice 🛡️</option>
                    <option value="general">General Memo 📝</option>
                  </select>
                </div>
              </div>

              {/* Content text area */}
              <div className="vault-note-form-group">
                <div className="flex items-center justify-between mb-1">
                  <label className="vault-note-label mb-0">Reminder Content & File List:</label>
                  {/* File attacher shortcut */}
                  {files.length > 0 && (
                    <div className="text-xs text-slate-400 flex items-center gap-1">
                      <span>Quick attach file:</span>
                      <select
                        onChange={(e) => {
                          const file = files.find(f => f.id === e.target.value);
                          if (file) handleAttachFile(file);
                          e.target.value = '';
                        }}
                        className="vault-note-file-attach-select"
                        defaultValue=""
                      >
                        <option value="" disabled>Select file to insert...</option>
                        {files.map(f => (
                          <option key={f.id} value={f.id}>
                            {f.filename} ({f.virtualPath || '/'})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <textarea
                  rows={6}
                  placeholder="Write which files are stored in this drive, folders, reminders, or special instructions..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  required
                  className="vault-note-textarea"
                />
              </div>

              {/* Color & Pin options */}
              <div className="flex items-center justify-between flex-wrap gap-3 py-2 border-t border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Card Color:</span>
                  <div className="flex items-center gap-1.5">
                    {COLOR_OPTIONS.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setColor(c.id)}
                        className={`vault-color-swatch ${color === c.id ? 'active' : ''}`}
                        style={{ backgroundColor: c.border }}
                        title={c.label}
                      />
                    ))}
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isPinned}
                    onChange={(e) => setIsPinned(e.target.checked)}
                    className="accent-amber-400"
                  />
                  <span className="text-xs text-slate-300 font-medium">Pin note to top 📌</span>
                </label>
              </div>

              {/* Tags input */}
              <div className="vault-note-form-group">
                <label className="vault-note-label">Tags (comma separated):</label>
                <input
                  type="text"
                  placeholder="e.g. photos, personal, 2026, backup"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  className="vault-note-input"
                />
              </div>

              {/* Modal Footer Buttons */}
              <div className="vault-note-editor-footer">
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="vault-note-cancel-btn"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="vault-note-save-btn"
                >
                  <Plus size={15} />
                  <span>{editingNote ? 'Update Note' : 'Save Reminder Note'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
