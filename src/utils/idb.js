/**
 * IndexedDB helpers for auto-save recovery of large recordings.
 * @module utils/idb
 */

const DB_NAME = 'MotionCaptureStudio';
const DB_VERSION = 1;
const STORE = 'recordings';

/**
 * Open IndexedDB database.
 * @returns {Promise<IDBDatabase>}
 */
export function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * @param {string} id
 * @param {*} data
 * @returns {Promise<void>}
 */
export async function idbPut(id, data) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ id, data, updatedAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * @param {string} id
 * @returns {Promise<*|null>}
 */
export async function idbGet(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result?.data ?? null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function idbDelete(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
