import Database from "@tauri-apps/plugin-sql";

let db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (!db) {
    db = await Database.load("sqlite:myhome.db");
  }
  return db;
}

export interface NoteRow {
  id: string;
  title: string;
  content: string;
  folder_id: string | null;
  is_pinned: number;
  is_archived: number;
  color: string | null;
  reminder_at: string | null;
  has_files: number;
  created_at: string;
  updated_at: string;
}
