import React, { useState, useEffect, useCallback, useRef } from "react";
import { Input, Empty, Popconfirm, message } from "antd";
import {
  DeleteOutlined,
  PictureOutlined,
  PaperClipOutlined,
} from "@ant-design/icons";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
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
import { getDb } from "../database";
import FolderTree from "./FolderTree";
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

const { TextArea } = Input;

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
  const [draftUpdatedAt, setDraftUpdatedAt] = useState(0);
  const [renamingNoteId, setRenamingNoteId] = useState<string | null>(null);

  // ── Debounced auto-save ──
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<{ title?: string; content?: string } | null>(null);
  const activeIdRef = useRef<string | null>(null);

  // Keep ref in sync with state
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);

  // ── Data loading ──
  const refreshFolders = useCallback(async () => {
    const folders: Folder[] = await loadFolders();
    setFlatFolders(folders);
    setFolderNodes(buildTree(folders));
    const counts = await countNotesByFolder();
    setNoteCounts(counts);
  }, []);

  const loadAllNotes = useCallback(async () => {
    const all = await loadNotes(selectedFolderId);
    setNotes(all);
  }, [selectedFolderId]);

  useEffect(() => { refreshFolders(); loadAllNotes(); }, []);
  useEffect(() => { loadAllNotes(); }, [selectedFolderId, loadAllNotes]);

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
    // Sync tree data with the saved draft
    setNotes((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n,
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
            setDraftUpdatedAt(n.updatedAt);
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
      setRenamingNoteId(null);
      await updateNote(noteId, { title: t });
      setNotes((prev) =>
        prev.map((n) => (n.id === noteId ? { ...n, title: t } : n)),
      );
      if (activeId === noteId) setDraftTitle(t);
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
      setDraftUpdatedAt(Date.now());

      // Queue debounced save
      pendingRef.current = { ...pendingRef.current, [field]: value };
      scheduleSave();
    },
    [],
  );

  const handleAttachFile = useCallback(
    async (imageOnly: boolean) => {
      const id = activeIdRef.current;
      if (!id) return;
      const filters = imageOnly
        ? [{ name: "图片", extensions: ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"] as string[] }]
        : [{ name: "所有文件", extensions: ["*"] as string[] }];

      const selected = await open({ multiple: false, filters });
      if (!selected) return;

      try {
        const result = await invoke<{
          storage_name: string; original_name: string; mime_type: string; file_size: number;
        }>("import_note_file", { sourcePath: selected, noteId: id });

        const db = await getDb();
        await db.execute(
          "INSERT INTO note_files (id, note_id, file_name, original_name, mime_type, file_size) VALUES ($1, $2, $3, $4, $5, $6)",
          [crypto.randomUUID(), id, result.storage_name, result.original_name, result.mime_type, result.file_size],
        );

        const ref = result.mime_type.startsWith("image/")
          ? `\n![${result.original_name}](file://${result.storage_name})\n`
          : `\n[${result.original_name}](file://${result.storage_name})\n`;

        setDraftContent((prev) => prev + ref);
        pendingRef.current = { ...pendingRef.current, content: draftContent + ref };
        scheduleSave();
        message.success(`已添加 ${result.original_name}`);
      } catch (err) {
        message.error("文件导入失败");
        console.error(err);
      }
    },
    [draftContent],
  );

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
        onSelectFolder={handleFolderSelect}
        onSelectNote={handleNoteSelect}
        onCreateNote={handleCreate}
        onFinishRenameNote={handleFinishRenameNote}
        onRefresh={refreshFolders}
      />

      <main className="notes-editor">
        {!activeId ? (
          <div className="notes-editor-empty">
            <Empty description="选择或创建一篇笔记" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          </div>
        ) : (
          <>
            <div className="notes-toolbar">
              <button className="notes-toolbar-btn" title="插入图片" onClick={() => handleAttachFile(true)}>
                <PictureOutlined /> 图片
              </button>
              <button className="notes-toolbar-btn" title="附加文件" onClick={() => handleAttachFile(false)}>
                <PaperClipOutlined /> 文件
              </button>
            </div>

            <div className="notes-editor-header">
              <Input
                className="notes-editor-title"
                variant="borderless"
                placeholder="标题"
                value={draftTitle}
                onChange={(e) => handleChange("title", e.target.value)}
              />
              <span className="notes-edit-time">{formatTime(draftUpdatedAt)}</span>
              <Popconfirm title="确定删除这篇笔记？" onConfirm={() => handleDelete(activeId)} okText="删除" cancelText="取消">
                <button className="notes-delete-btn" title="删除">
                  <DeleteOutlined />
                </button>
              </Popconfirm>
            </div>

            <TextArea
              className="notes-editor-content"
              placeholder="开始写点什么..."
              variant="borderless"
              value={draftContent}
              onChange={(e) => handleChange("content", e.target.value)}
            />
          </>
        )}
      </main>
    </div>
  );
};

export default Notes;
