import type { WebdavConfig } from "./settings-store";
import type { Note } from "./notes-repo";
import type { Folder } from "./folders-repo";
import { loadNotes, updateNote, deleteNote } from "./notes-repo";
import {
  loadFolders,
  createFolder,
  deleteFolder,
} from "./folders-repo";

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
  // Ensure protocol
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  return url;
}

function authHeader(username: string, password: string): string {
  return "Basic " + btoa(`${username}:${password}`);
}

/** Test WebDAV connection by fetching the root */
export async function testWebdavConnection(
  config: WebdavConfig,
): Promise<{ ok: boolean; message: string }> {
  try {
    const url = normalizeUrl(config.url);
    const res = await fetch(url, {
      method: "PROPFIND",
      headers: {
        Authorization: authHeader(config.username, config.password),
        Depth: "0",
      },
    });

    if (res.status === 207 || res.status === 200 || res.status === 404) {
      return { ok: true, message: "连接成功" };
    }
    if (res.status === 401) {
      return { ok: false, message: "认证失败，请检查用户名和密码" };
    }
    return {
      ok: false,
      message: `服务器返回 ${res.status} ${res.statusText}`,
    };
  } catch (err) {
    return {
      ok: false,
      message: `无法连接: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/** Download sync file from WebDAV */
async function downloadSync(
  config: WebdavConfig,
): Promise<SyncData | null> {
  const url = normalizeUrl(config.url);
  const res = await fetch(url + SYNC_FILE, {
    method: "GET",
    headers: {
      Authorization: authHeader(config.username, config.password),
    },
  });
  if (res.status === 404) return null;
  if (!res.ok)
    throw new Error(`下载同步文件失败: ${res.status} ${res.statusText}`);
  return res.json();
}

/** Upload sync file to WebDAV */
async function uploadSync(
  config: WebdavConfig,
  data: SyncData,
): Promise<void> {
  const url = normalizeUrl(config.url);
  const res = await fetch(url + SYNC_FILE, {
    method: "PUT",
    headers: {
      Authorization: authHeader(config.username, config.password),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!res.ok)
    throw new Error(`上传同步文件失败: ${res.status} ${res.statusText}`);
}

/** Collect local data for sync */
async function collectLocalData(): Promise<{
  notes: Note[];
  folders: Folder[];
}> {
  const notes = await loadNotes();
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
async function applyRemoteData(data: SyncData): Promise<number> {
  let count = 0;

  // Merge folders
  const localFolders = await loadFolders();
  const localFolderMap = new Map(localFolders.map((f) => [f.id, f]));
  const remoteFolderIds = new Set(data.folders.map((f) => f.id));

  for (const rf of data.folders) {
    const lf = localFolderMap.get(rf.id);
    if (!lf) {
      // New folder from remote
      await createFolder(rf.name, rf.parentId);
      count++;
    }
  }

  // Delete local folders that aren't in remote (if remote isn't empty)
  if (data.folders.length > 0) {
    for (const lf of localFolders) {
      if (!remoteFolderIds.has(lf.id)) {
        await deleteFolder(lf.id);
      }
    }
  }

  // Merge notes: last-write-wins
  const localNotes = await loadNotes();
  const localNoteMap = new Map(localNotes.map((n) => [n.id, n]));

  for (const rn of data.notes) {
    const ln = localNoteMap.get(rn.id);
    if (!ln || rn.updatedAt > ln.updatedAt) {
      // Remote is newer or doesn't exist locally → update local
      await updateNote(rn.id, { title: rn.title, content: rn.content });
      count++;
    }
  }

  // Delete local notes not in remote (if remote has notes)
  if (data.notes.length > 0) {
    const remoteNoteIds = new Set(data.notes.map((n) => n.id));
    for (const ln of localNotes) {
      if (!remoteNoteIds.has(ln.id)) {
        await deleteNote(ln.id);
        count++;
      }
    }
  }

  return count;
}

/** Main sync function */
export async function syncWithWebdav(
  config: WebdavConfig,
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
      // Merge: apply remote changes locally
      pulled = await applyRemoteData(remote);

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

    return { success: true, syncedAt, pulled, pushed };
  } catch (err) {
    return {
      success: false,
      syncedAt,
      pulled: 0,
      pushed: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
