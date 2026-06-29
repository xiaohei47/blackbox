import { getDb } from "./database";

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
}

export interface FolderNode {
  folder: Folder;
  children: FolderNode[];
  depth: number;
}

function generateId(): string {
  return crypto.randomUUID();
}

interface FolderRow {
  id: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
}

function mapRow(row: FolderRow): Folder {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parent_id,
    sortOrder: row.sort_order,
  };
}

/** Build a nested tree from flat folder list */
export function buildTree(
  folders: Folder[],
  parentId: string | null = null,
  depth = 0,
): FolderNode[] {
  return folders
    .filter((f) => f.parentId === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((folder) => ({
      folder,
      children: buildTree(folders, folder.id, depth + 1),
      depth,
    }));
}

export async function loadFolders(): Promise<Folder[]> {
  const db = await getDb();
  const rows = await db.select<FolderRow[]>(
    "SELECT id, name, parent_id, sort_order FROM folders ORDER BY sort_order, name",
  );
  return rows.map(mapRow);
}

export async function createFolder(
  name: string,
  parentId: string | null = null,
): Promise<Folder> {
  const db = await getDb();
  const id = generateId();

  // Get next sort_order for this parent
  let sortOrder = 0;
  if (parentId === null) {
    const rows = await db.select<{ m: number }[]>(
      "SELECT COALESCE(MAX(sort_order), -1) + 1 as m FROM folders WHERE parent_id IS NULL",
    );
    sortOrder = rows[0]?.m ?? 0;
  } else {
    const rows = await db.select<{ m: number }[]>(
      "SELECT COALESCE(MAX(sort_order), -1) + 1 as m FROM folders WHERE parent_id = $1",
      [parentId],
    );
    sortOrder = rows[0]?.m ?? 0;
  }

  await db.execute(
    "INSERT INTO folders (id, name, parent_id, sort_order) VALUES ($1, $2, $3, $4)",
    [id, name, parentId, sortOrder],
  );
  return { id, name, parentId, sortOrder };
}

export async function renameFolder(id: string, name: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE folders SET name = $1 WHERE id = $2", [name, id]);
}

export async function deleteFolder(id: string): Promise<void> {
  const db = await getDb();
  const folder = await db.select<{ parent_id: string | null }[]>(
    "SELECT parent_id FROM folders WHERE id = $1",
    [id],
  );
  if (folder.length > 0) {
    const parentId = folder[0].parent_id;
    await db.execute(
      "UPDATE folders SET parent_id = $1 WHERE parent_id = $2",
      [parentId, id],
    );
    await db.execute(
      "UPDATE notes SET folder_id = $1 WHERE folder_id = $2",
      [parentId, id],
    );
  }
  await db.execute("DELETE FROM folders WHERE id = $1", [id]);
}

export async function moveFolder(
  id: string,
  newParentId: string | null,
): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE folders SET parent_id = $1 WHERE id = $2", [
    newParentId,
    id,
  ]);
}
