import { invoke } from "@tauri-apps/api/core";
import type { WebdavConfig } from "./settings-store";
import type { Note } from "./notes-repo";
import type { Folder } from "./folders-repo";
import { loadNotes, updateNote, deleteNote } from "./notes-repo";
import { loadFolders, createFolder, deleteFolder } from "./folders-repo";
import { setLastSyncIds } from "./settings-store";

const SYNC_FILE = "myhome-sync.json";

interface SyncData {
  version: number;
  syncedAt: string;
  notes: Array<{
    id: string;
    title: string;
    content: string;
    folderId: string | null;
    color: string | null;
    is_pinned: boolean;
    is_archived: boolean;
    createdAt: number;
    updatedAt: number;
  }>;
  folders: Array<{
    id: string;
    name: string;
    parentId: string | null;
    sortOrder: number;
  }>;
}

interface SyncResult {
  success: boolean;
  syncedAt: string;
  pulled: number;
  pushed: number;
  error?: string;
}

function normalizeUrl(base: string): string {
  let url = base.trim();
  if (!url.endsWith("/")) url += "/";
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  return url;
}

function syncFileUrl(config: WebdavConfig): string {
  const base = normalizeUrl(config.url);
  const root = (config.remoteRoot || "blackbox-sync").replace(/^\/+|\/+$/g, "");
  return root ? `${base}${root}/${SYNC_FILE}` : `${base}${SYNC_FILE}`;
}

/** Test WebDAV connection via Rust backend (bypasses CORS) */
export async function testWebdavConnection(
  config: WebdavConfig,
): Promise<{ ok: boolean; message: string }> {
  try {
    const url = normalizeUrl(config.url);
    await invoke("webdav_test_connection", {
      url,
      username: config.username,
      password: config.password,
    });
    return { ok: true, message: "连接成功" };
  } catch (err) {
    return {
      ok: false,
      message: typeof err === "string" ? err : "连接失败",
    };
  }
}

/** Download sync file from WebDAV via Rust backend */
async function downloadSync(
  config: WebdavConfig,
): Promise<SyncData | null> {
  const fullUrl = syncFileUrl(config);
  const res = await invoke<{ body: string | null; status: number }>("webdav_get_text", {
    url: fullUrl,
    username: config.username,
    password: config.password,
  });
  if (res.body === null) return null;
  return JSON.parse(res.body);
}

/** Upload sync file to WebDAV via Rust backend */
async function uploadSync(
  config: WebdavConfig,
  data: SyncData,
): Promise<void> {
  const fullUrl = syncFileUrl(config);

  // Try creating the remote directory first (MKCOL). No-op if it already exists.
  const dirUrl = fullUrl.substring(0, fullUrl.lastIndexOf("/") + 1);
  await invoke("webdav_mkcol", {
    url: dirUrl,
    username: config.username,
    password: config.password,
  }).catch(() => {
    // Ignore mkcol errors — PUT will fail with a clear message if dir missing
  });

  await invoke("webdav_put_text", {
    url: fullUrl,
    username: config.username,
    password: config.password,
    body: JSON.stringify(data),
    contentType: "application/json",
  });
}

/** Collect local data for sync (includes archived notes) */
async function collectLocalData(): Promise<{
  notes: Note[];
  folders: Folder[];
}> {
  const notes = await loadNotes(undefined, true);
  const folders = await loadFolders();
  return { notes, folders };
}

/** Convert to sync format */
function toSyncData(
  notes: Note[],
  folders: Folder[],
  lastSyncAt: string,
): SyncData {
  return {
    version: 1,
    syncedAt: lastSyncAt,
    notes: notes.map((n) => ({
      id: n.id,
      title: n.title,
      content: n.content,
      folderId: n.folderId,
      color: n.color,
      is_pinned: n.is_pinned,
      is_archived: false,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
    })),
    folders: folders.map((f) => ({
      id: f.id,
      name: f.name,
      parentId: f.parentId,
      sortOrder: f.sortOrder,
    })),
  };
}

/** Merge remote data into local */
async function applyRemoteData(
  data: SyncData,
  lastSyncFolderIds: string[],
  lastSyncNoteIds: string[],
): Promise<number> {
  let count = 0;

  // ── Merge folders ──
  const localFolders = await loadFolders();
  const localFolderIds = new Set(localFolders.map((f) => f.id));
  const remoteFolderIds = new Set(data.folders.map((f) => f.id));

  // Collect IDs that were in the last sync
  const wasSyncedFolder = new Set(lastSyncFolderIds);

  // Delete folders that were in a previous sync but are no longer in remote
  // (propagates remote deletions) AND no longer exist locally
  for (const id of lastSyncFolderIds) {
    if (!remoteFolderIds.has(id) && !localFolderIds.has(id)) {
      // Was synced, now gone from remote AND from local → was deleted on both sides
      // No action needed locally — it's already gone
    } else if (wasSyncedFolder.has(id) && !remoteFolderIds.has(id) && localFolderIds.has(id)) {
      // Was synced before, exists locally but not in remote → remotely deleted
      // → propagate deletion locally
      await deleteFolder(id);
      count++;
    }
  }

  // Create remote folders not yet local, handling parentId dependencies.
  // Don't pull back folders that were in last sync but no longer local (intentionally deleted)
  const deletedLocalFolderIds = new Set(
    lastSyncFolderIds.filter((id) => !localFolderIds.has(id)),
  );
  const created = new Set(localFolderIds);
  let remaining = data.folders.filter(
    (rf) => !localFolderIds.has(rf.id) && !deletedLocalFolderIds.has(rf.id),
  );
  for (let i = 0; i <= remaining.length && remaining.length > 0; i++) {
    const batch = remaining.filter(
      (rf) =>
        !created.has(rf.id) &&
        (rf.parentId === null || created.has(rf.parentId)),
    );
    if (batch.length === 0) break;
    for (const rf of batch) {
      await createFolder(rf.name, rf.parentId, rf.id);
      created.add(rf.id);
      count++;
    }
    remaining = remaining.filter((rf) => !created.has(rf.id));
  }

  // ── Merge notes: last-write-wins ──
  const localNotes = await loadNotes(undefined, true);
  const localNoteMap = new Map(localNotes.map((n) => [n.id, n]));
  const remoteNoteIds = new Set(data.notes.map((n) => n.id));

  const wasSyncedNote = new Set(lastSyncNoteIds);

  // Delete notes that were in a previous sync but are no longer in remote
  // AND still exist locally → remotely deleted, propagate
  for (const id of lastSyncNoteIds) {
    if (wasSyncedNote.has(id) && !remoteNoteIds.has(id) && localNoteMap.has(id)) {
      await deleteNote(id);
      count++;
    }
  }

  // Update notes where remote is newer.
  // Don't pull back notes that were in last sync but no longer local (intentionally deleted)
  for (const rn of data.notes) {
    const ln = localNoteMap.get(rn.id);
    if (!ln && wasSyncedNote.has(rn.id)) continue;
    if (!ln || rn.updatedAt > ln.updatedAt) {
      await updateNote(rn.id, {
        title: rn.title,
        content: rn.content,
        folderId: rn.folderId,
        color: rn.color,
        is_pinned: rn.is_pinned,
      });
      count++;
    }
  }

  return count;
}

/** Main sync function */
export async function syncWithWebdav(
  config: WebdavConfig,
  lastSyncFolderIds: string[] = [],
  lastSyncNoteIds: string[] = [],
): Promise<SyncResult> {
  const syncedAt = new Date().toISOString();

  try {
    // 1. Collect local data
    const local = await collectLocalData();

    // 2. Download remote data
    let remote: SyncData | null;
    try {
      remote = await downloadSync(config);
    } catch {
      remote = null;
    }

    let pulled = 0;
    let pushed = 0;

    if (remote) {
      // Merge: apply remote changes locally (with last-sync tracking for deletions)
      pulled = await applyRemoteData(remote, lastSyncFolderIds, lastSyncNoteIds);

      // Collect merged local data and upload
      const merged = await collectLocalData();
      const uploadData = toSyncData(merged.notes, merged.folders, syncedAt);
      await uploadSync(config, uploadData);
      pushed = uploadData.notes.length + uploadData.folders.length;
    } else {
      // First sync: upload everything
      const uploadData = toSyncData(local.notes, local.folders, syncedAt);
      await uploadSync(config, uploadData);
      pushed = local.notes.length + local.folders.length;
    }

    // Persist the current ID sets as the new sync baseline
    const mergedLocal = await collectLocalData();
    setLastSyncIds(
      mergedLocal.notes.map((n) => n.id),
      mergedLocal.folders.map((f) => f.id),
    );

    return { success: true, syncedAt, pulled, pushed };
  } catch (err) {
    return {
      success: false,
      syncedAt,
      pulled: 0,
      pushed: 0,
      error: typeof err === "string" ? err : err instanceof Error ? err.message : String(err),
    };
  }
}
