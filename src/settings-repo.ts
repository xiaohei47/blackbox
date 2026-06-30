import { Store } from "@tauri-apps/plugin-store";

const KEY_AUTO_SAVE = "note.autoSave";

let store: Store | null = null;

async function getStore(): Promise<Store> {
  if (!store) store = await Store.load("settings.json");
  return store;
}

export async function getAutoSave(): Promise<boolean> {
  const s = await getStore();
  const val = await s.get<boolean>(KEY_AUTO_SAVE);
  return val !== false; // default: true
}

export async function setAutoSave(val: boolean): Promise<void> {
  const s = await getStore();
  await s.set(KEY_AUTO_SAVE, val);
  await s.save();
}
