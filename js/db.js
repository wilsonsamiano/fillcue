const DB_NAME = "fillcue";
const DB_VERSION = 1;

export function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("fills")) {
        const fills = db.createObjectStore("fills", { keyPath: "id" });
        fills.createIndex("byDate", "date");
      }
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllFills() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction("fills", "readonly");
    const req = t.objectStore("fills").getAll();
    req.onsuccess = () => {
      const rows = req.result || [];
      rows.sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.time || "").localeCompare(String(b.time || "")));
      resolve(rows);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveFill(fill) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction("fills", "readwrite");
    t.objectStore("fills").put(fill);
    t.oncomplete = () => resolve(fill);
    t.onerror = () => reject(t.error);
  });
}

export async function deleteFill(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction("fills", "readwrite");
    t.objectStore("fills").delete(id);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function getSetting(key, fallback) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction("settings", "readonly");
    const req = t.objectStore("settings").get(key);
    req.onsuccess = () => resolve(req.result ? req.result.value : fallback);
    req.onerror = () => reject(req.error);
  });
}

export async function setSetting(key, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction("settings", "readwrite");
    t.objectStore("settings").put({ key, value });
    t.oncomplete = () => resolve(value);
    t.onerror = () => reject(t.error);
  });
}

export function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : "f" + Date.now() + Math.random().toString(16).slice(2);
}

export const DEFAULT_SETTINGS = {
  vehicle: "2015 Toyota Highlander XLE",
  tankGal: 19.2,
  usableGal: 18.5,
  epaCity: 18,
  epaHwy: 24,
  epaComb: 20,
};
