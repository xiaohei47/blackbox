import { getDb, type NoteRow } from "./database";

export interface Note {
  id: string;
  title: string;
  content: string;
  folderId: string | null;
  color: string | null;
  is_pinned: boolean;
  createdAt: number;
  updatedAt: number;
}

function rowToNote(row: NoteRow): Note {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    folderId: row.folder_id,
    color: row.color,
    is_pinned: row.is_pinned === 1,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

function nowISO(): string {
  return new Date().toISOString();
}

export async function loadNotes(
  folderId?: string | null,
  includeArchived?: boolean,
): Promise<Note[]> {
  const db = await getDb();
  let sql = includeArchived
    ? "SELECT * FROM notes"
    : "SELECT * FROM notes WHERE is_archived = 0";
  const params: unknown[] = [];

  if (folderId !== undefined) {
    if (folderId === null) {
      sql += " AND folder_id IS NULL";
    } else {
      sql += " AND folder_id = $1";
      params.push(folderId);
    }
  }

  sql += " ORDER BY is_pinned DESC, updated_at DESC";

  if (params.length > 0) {
    const rows = await db.select<NoteRow[]>(sql, params);
    return rows.map(rowToNote);
  }
  const rows = await db.select<NoteRow[]>(sql);
  return rows.map(rowToNote);
}

/** Count notes per folder (including archived) */
export async function countNotesByFolder(): Promise<Map<string, number>> {
  const db = await getDb();
  const rows = await db.select<{ folder_id: string | null; c: number }[]>(
    "SELECT folder_id, COUNT(*) as c FROM notes GROUP BY folder_id",
  );
  const map = new Map<string, number>();
  for (const r of rows) {
    if (r.folder_id) map.set(r.folder_id, r.c);
  }
  return map;
}

export async function createNote(folderId?: string | null): Promise<Note> {
  const db = await getDb();
  const now = nowISO();
  const id = crypto.randomUUID();
  const note: NoteRow = {
    id,
    title: "未命名笔记",
    content: "",
    folder_id: folderId ?? null,
    is_pinned: 0,
    is_archived: 0,
    color: null,
    reminder_at: null,
    has_files: 0,
    created_at: now,
    updated_at: now,
  };
  await db.execute(
    `INSERT INTO notes (id, title, content, folder_id, is_pinned, is_archived, color, reminder_at, has_files, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      note.id,
      note.title,
      note.content,
      note.folder_id,
      note.is_pinned,
      note.is_archived,
      note.color,
      note.reminder_at,
      note.has_files,
      note.created_at,
      note.updated_at,
    ],
  );
  return rowToNote(note);
}

export async function updateNote(
  id: string,
  patch: Partial<Pick<Note, "title" | "content" | "folderId" | "color" | "is_pinned">>,
): Promise<void> {
  const db = await getDb();
  const sets: string[] = [];
  const vals: unknown[] = [];

  if (patch.title !== undefined) {
    sets.push("title = $1");
    vals.push(patch.title);
  }
  if (patch.content !== undefined) {
    sets.push("content = $" + (vals.length + 1));
    vals.push(patch.content);
  }
  if (patch.folderId !== undefined) {
    sets.push("folder_id = $" + (vals.length + 1));
    vals.push(patch.folderId);
  }
  if (patch.color !== undefined) {
    sets.push("color = $" + (vals.length + 1));
    vals.push(patch.color);
  }
  if (patch.is_pinned !== undefined) {
    sets.push("is_pinned = $" + (vals.length + 1));
    vals.push(patch.is_pinned ? 1 : 0);
  }

  if (sets.length === 0) return;

  sets.push("updated_at = $" + (vals.length + 1));
  vals.push(nowISO());
  vals.push(id);

  await db.execute(
    `UPDATE notes SET ${sets.join(", ")} WHERE id = $${vals.length}`,
    vals,
  );
}

export async function deleteNote(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM notes WHERE id = $1", [id]);
}
