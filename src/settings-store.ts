import { Store } from "@tauri-apps/plugin-store";

let store: Store | null = null;

async function getStore(): Promise<Store> {
  if (!store) {
    store = await Store.load("settings.json");
  }
  return store;
}

export interface WebdavConfig {
  url: string;
  username: string;
  password: string;
}

export interface SyncConfig {
  method: string; // "webdav" | "none" | future values
  webdav: WebdavConfig;
  lastSyncAt: string | null;
}

export async function getSyncConfig(): Promise<SyncConfig> {
  const s = await getStore();
  return {
    method: ((await s.get<string>("sync.method")) ?? "none") as SyncConfig["method"],
    webdav: {
      url: (await s.get<string>("sync.webdav.url")) ?? "",
      username: (await s.get<string>("sync.webdav.username")) ?? "",
      password: (await s.get<string>("sync.webdav.password")) ?? "",
    },
    lastSyncAt: (await s.get<string>("sync.lastSyncAt")) ?? null,
  };
}

export async function setSyncConfig(config: SyncConfig): Promise<void> {
  const s = await getStore();
  await s.set("sync.method", config.method);
  await s.set("sync.webdav.url", config.webdav.url);
  await s.set("sync.webdav.username", config.webdav.username);
  await s.set("sync.webdav.password", config.webdav.password);
  await s.save();
}

export async function setLastSyncAt(iso: string): Promise<void> {
  const s = await getStore();
  await s.set("sync.lastSyncAt", iso);
  await s.save();
}
