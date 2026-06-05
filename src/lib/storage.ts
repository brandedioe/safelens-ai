// src/lib/storage.ts — v2
// Version 2 adds the family_profiles store.
// All functions silently no-op if idb is not installed.

let _db: any = null;

export interface FamilyProfile {
  id:         string;
  name:       string;
  type:       'self' | 'child' | 'elderly' | 'pregnant' | 'custom';
  allergies:  string[];
  medications: string[];
  conditions: string[];
  aboutMe?: string;
  isActive:   boolean;
  createdAt:  number;
}

async function getDB() {
  if (typeof window === 'undefined') return null;
  if (_db) return _db;
  try {
    const { openDB } = await import('idb');
    _db = await openDB('safelens-v1', 2, {
      upgrade(db, oldVersion) {
        // v1 stores
        if (oldVersion < 1) {
          db.createObjectStore('products',        { keyPath: 'barcode' });
          db.createObjectStore('scans',           { keyPath: 'id' });
          db.createObjectStore('profile',         { keyPath: 'id' });
        }
        // v2 adds family profiles
        if (oldVersion < 2) {
          db.createObjectStore('family_profiles', { keyPath: 'id' });
        }
      },
    });
    return _db;
  } catch { return null; }
}

// ── Products ──────────────────────────────────────────────────
export async function getCachedProduct(barcode: string) {
  try { return (await (await getDB())?.get('products', barcode)) ?? null; }
  catch { return null; }
}
export async function cacheProduct(barcode: string, data: unknown) {
  try { await (await getDB())?.put('products', { barcode, data, savedAt: Date.now() }); }
  catch {}
}

// ── Scans ─────────────────────────────────────────────────────
export async function saveScan(barcode: string, result: unknown) {
  try {
    const id = barcode + '-' + Date.now();
    await (await getDB())?.put('scans', { id, barcode, result, scannedAt: Date.now() });
  } catch {}
}
export async function getScanHistory(limit = 40) {
  try {
    const all: any[] = (await (await getDB())?.getAll('scans')) ?? [];
    return all.sort((a, b) => b.scannedAt - a.scannedAt).slice(0, limit);
  } catch { return []; }
}
export async function clearScanHistory() {
  try { await (await getDB())?.clear('scans'); } catch {}
}

// ── Legacy single profile ─────────────────────────────────────
export async function getProfile() {
  try { return (await (await getDB())?.get('profile', 'default')) ?? null; }
  catch { return null; }
}
export async function saveProfile(profile: { allergies: string[]; medications: string[] }) {
  try { await (await getDB())?.put('profile', { id: 'default', ...profile }); }
  catch {}
}

// ── Family profiles ───────────────────────────────────────────
export async function getFamilyProfiles(): Promise<FamilyProfile[]> {
  try {
    const all: FamilyProfile[] = (await (await getDB())?.getAll('family_profiles')) ?? [];
    return all.sort((a, b) => a.createdAt - b.createdAt);
  } catch { return []; }
}
export async function saveFamilyProfile(profile: FamilyProfile) {
  try { await (await getDB())?.put('family_profiles', profile); }
  catch {}
}
export async function deleteFamilyProfile(id: string) {
  try { await (await getDB())?.delete('family_profiles', id); }
  catch {}
}
export async function setActiveProfile(id: string) {
  try {
    const db = await getDB();
    if (!db) return;
    const all: FamilyProfile[] = (await db.getAll('family_profiles')) ?? [];
    for (const p of all) {
      p.isActive = p.id === id;
      await db.put('family_profiles', p);
    }
  } catch {}
}
export async function getActiveProfile(): Promise<FamilyProfile | null> {
  try {
    const all = await getFamilyProfiles();
    return all.find(p => p.isActive) ?? all[0] ?? null;
  } catch { return null; }
}