import React, { useState, useEffect, useCallback, useRef } from "react";
import { Input, Empty, message } from "antd";
import { appDataDir } from "@tauri-apps/api/path";
import { getAutoSave } from "../settings-repo";
import type { Note } from "../notes-repo";
import {
  loadNotes,
  createNote,
  updateNote,
  deleteNote,
  countNotesByFolder,
} from "../notes-repo";
import type { Folder, FolderNode } from "../folders-repo";
import { loadFolders, buildTree } from "../folders-repo";
import FolderTree from "./FolderTree";
import RichEditor from "./RichEditor";
import "./Notes.css";

function formatTime(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${mo}-${day} ${h}:${mi}`;
}

const Notes: React.FC = () => {
  // ── List data (updated on save, drives the tree) ──
  const [notes, setNotes] = useState<Note[]>([]);
  const [folderNodes, setFolderNodes] = useState<FolderNode[]>([]);
  const [flatFolders, setFlatFolders] = useState<Folder[]>([]);
  const [noteCounts, setNoteCounts] = useState<Map<string, number>>(new Map());
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  // ── Editor drafts (updated on every keystroke, drives the editor only) ──
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [renamingNoteId, setRenamingNoteId] = useState<string | null>(null);

  // ── Debounced auto-save ──
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<{ title?: string; content?: string } | null>(null);
  const activeIdRef = useRef<string | null>(null);

  // Keep ref in sync with state
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);

  // ── Auto-save setting ──
  const [autoSave, setAutoSaveState] = useState(true);
  const autoSaveRef = useRef(true);
  useEffect(() => { autoSaveRef.current = autoSave; }, [autoSave]);

  // Load auto-save setting on mount
  useEffect(() => {
    getAutoSave().then(setAutoSaveState);
  }, []);

  // ── App data dir for image paste ──
  const [appDataDirPath, setAppDataDirPath] = useState("");
  useEffect(() => {
    appDataDir().then(setAppDataDirPath);
  }, []);

  // ── Data loading ──
  const refreshFolders = useCallback(async () => {
    const folders: Folder[] = await loadFolders();
    setFlatFolders(folders);
    setFolderNodes(buildTree(folders));
    const counts = await countNotesByFolder();
    setNoteCounts(counts);
  }, []);

  const loadAllNotes = useCallback(async () => {
    const all = await loadNotes();
    setNotes(all);
  }, []);

  useEffect(() => { refreshFolders(); loadAllNotes(); }, []);

  // ── Save helpers ──
  async function flushPendingSave() {
    const id = activeIdRef.current;
    const p = pendingRef.current;
    if (!id || !p) return;
    pendingRef.current = null;
    const patch: { title?: string; content?: string } = {};
    if (p.title !== undefined) patch.title = p.title;
    if (p.content !== undefined) patch.content = p.content;
    await updateNote(id, patch);
    const now = Date.now();
    // Sync tree data with the saved draft
    setNotes((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, ...patch, updatedAt: now } : n,
      ),
    );
  }

  // Flush on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      flushPendingSave();
    };
  }, []);

  // ── Ctrl+S / Cmd+S keyboard shortcut ──
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
        flushPendingSave().then(() => {
          message.success("已保存");
        });
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function scheduleSave() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(flushPendingSave, 800);
  }

  // ── Switch active note (flush first, then load draft) ──
  const switchToNote = useCallback((noteId: string | null) => {
    // Flush any pending save first
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    flushPendingSave().then(() => {
      setActiveId(noteId);
      if (noteId) {
        setNotes((prev) => {
          const n = prev.find((x) => x.id === noteId);
          if (n) {
            setDraftTitle(n.title);
            setDraftContent(n.content);
          }
          return prev;
        });
      }
    });
  }, []);

  // ── Handlers ──
  const handleFolderSelect = useCallback((folderId: string | null) => {
    setSelectedFolderId(folderId);
  }, []);

  const handleNoteSelect = useCallback((noteId: string) => {
    switchToNote(noteId);
  }, [switchToNote]);

  const handleCreate = useCallback(async () => {
    const note = await createNote(selectedFolderId);
    setNotes((prev) => [note, ...prev]);
    setRenamingNoteId(note.id);
    switchToNote(note.id);
    refreshFolders();
  }, [selectedFolderId, refreshFolders, switchToNote]);

  const handleFinishRenameNote = useCallback(
    async (noteId: string, title: string) => {
      const t = title.trim() || "未命名笔记";
      setNotes((prev) =>
        prev.map((n) => (n.id === noteId ? { ...n, title: t } : n)),
      );
      if (activeId === noteId) setDraftTitle(t);
      setRenamingNoteId(null);
      await updateNote(noteId, { title: t });
    },
    [activeId],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteNote(id);
      setNotes((prev) => {
        const next = prev.filter((n) => n.id !== id);
        if (activeId === id) {
          if (next.length > 0) switchToNote(next[0].id);
          else { setActiveId(null); setDraftTitle(""); setDraftContent(""); }
        }
        return next;
      });
      refreshFolders();
    },
    [activeId, refreshFolders, switchToNote],
  );

  // ── Editor change (only touches draft state, not notes[]) ──
  const handleChange = useCallback(
    (field: "title" | "content", value: string) => {
      // Update draft (instant UI, no tree re-render)
      if (field === "title") setDraftTitle(value);
      else setDraftContent(value);

      // Queue debounced save
      pendingRef.current = { ...pendingRef.current, [field]: value };
      if (autoSaveRef.current) scheduleSave();
    },
    [],
  );

  const handleEditorUpdate = useCallback(
    (html: string) => {
      setDraftContent(html);
      pendingRef.current = { ...pendingRef.current, content: html };
      if (autoSaveRef.current) scheduleSave();
    },
    [],
  );

  // ── Dirty state (unsaved changes exist) ──
  const isDirty = pendingRef.current !== null;
  const activeNote = activeId ? notes.find((n) => n.id === activeId) : undefined;

  return (
    <div className="notes-layout">
      <FolderTree
        nodes={folderNodes}
        flatFolders={flatFolders}
        notes={notes}
        selectedFolderId={selectedFolderId}
        selectedNoteId={activeId}
        renamingNoteId={renamingNoteId}
        noteCounts={noteCounts}
        onStartRenameNote={setRenamingNoteId}
        onSelectFolder={handleFolderSelect}
        onSelectNote={handleNoteSelect}
        onCreateNote={handleCreate}
        onFinishRenameNote={handleFinishRenameNote}
        onDeleteNote={handleDelete}
        onRefresh={refreshFolders}
      />

      <main className="notes-editor">
        {!activeId ? (
          <div className="notes-editor-empty">
            <Empty description="选择或创建一篇笔记" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          </div>
        ) : (
          <>
            <div className="notes-editor-header">
              <Input
                className="notes-editor-title"
                variant="borderless"
                placeholder="标题"
                value={draftTitle}
                onChange={(e) => handleChange("title", e.target.value)}
              />
              <span className="notes-edit-time">{formatTime(activeNote?.updatedAt ?? 0)}</span>
              {!autoSave && isDirty && <span className="notes-dirty-dot" />}
            </div>

            <RichEditor
              key={activeId}
              content={draftContent}
              noteId={activeId}
              appDataDir={appDataDirPath}
              onUpdate={handleEditorUpdate}
            />
          </>
        )}
      </main>
    </div>
  );
};

export default Notes;
