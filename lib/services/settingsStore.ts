import { AddonContext } from '../types/bms';
import {
  DEFAULT_LAYERS,
  DEFAULT_VULNERABLE_CRITERIA,
  GroupKind,
  LayerFeature,
  LayerSetting,
  VulnerableCriteria
} from '../types/gis';

const STORAGE_BASE = 'https://hosxp-marketplace.bmscloud.in.th/api/v1/addon/storage';
/** Key charset is [A-Za-z0-9./:-] — underscores are rejected by the reference client */
const SETTINGS_KEY = 'settings/app';
const LOCAL_FALLBACK_KEY = 'bms-gis-settings';

export interface AppSettings {
  vulnerableCriteria: VulnerableCriteria;
  layers: LayerSetting[];
  showHeatmap: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  vulnerableCriteria: DEFAULT_VULNERABLE_CRITERIA,
  layers: DEFAULT_LAYERS,
  showHeatmap: false
};

/** Version of the stored value, used for optimistic concurrency on write */
let knownVersion: number | undefined;

const KINDS: GroupKind[] = ['vulnerable', 'epidemic', 'partner', 'resource'];

const GEOMETRY_TYPES = ['home', 'point', 'circle', 'polygon', 'line'];

/** Fallback ids for features stored before they had one — unique across the load */
let featureSeq = 0;

function isPath(p: any): boolean {
  return Array.isArray(p) && p.length >= 2 && p.every((c) => Array.isArray(c) && c.length === 2);
}

/**
 * Features gained a geometry when the add-methods were introduced. Entries
 * saved before that were either a person (no coordinate — the house carried it)
 * or a pinned place, so both shapes are lifted onto the new model here.
 */
function normaliseFeature(raw: any): LayerFeature | null {
  if (!raw || typeof raw !== 'object') return null;

  const person = typeof raw.person_id === 'number'
    ? {
        person_id: raw.person_id,
        house_id: raw.house_id,
        hn: raw.hn,
        house_address: raw.house_address,
        village_moo: raw.village_moo,
        treatment_start_date: raw.treatment_start_date
      }
    : raw.person;

  let geometry: any = raw.geometry;
  if (!geometry || !GEOMETRY_TYPES.includes(geometry.type)) {
    geometry = typeof raw.latitude === 'number' && typeof raw.longitude === 'number'
      ? { type: 'point', lat: raw.latitude, lng: raw.longitude }
      : { type: 'home' };
  }
  // A geometry that lost its coordinates cannot be drawn; only 'home' may have none
  if (geometry.type === 'point' && typeof geometry.lat !== 'number') return null;
  if (geometry.type === 'circle' && (typeof geometry.lat !== 'number' || typeof geometry.radius !== 'number')) return null;
  if ((geometry.type === 'polygon' || geometry.type === 'line') && !isPath(geometry.path)) return null;
  if (geometry.type === 'home' && !person) return null;

  const name = raw.name || raw.place_name || raw.person_name;
  return {
    id: raw.id || raw.place_id || `feature-${++featureSeq}`,
    name: typeof name === 'string' && name.trim() ? name : 'ไม่ระบุชื่อ',
    geometry,
    attribute: raw.attribute?.key
      ? { key: String(raw.attribute.key), value: String(raw.attribute.value ?? '') }
      : (raw.note ? { key: 'หมายเหตุ', value: String(raw.note) } : undefined),
    ...(person ? { person } : {})
  };
}

function normaliseFeatures(raw: any): LayerFeature[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normaliseFeature).filter((f): f is LayerFeature => f !== null);
}

/**
 * Layers are user-editable, so the stored array is authoritative — but entries
 * are sanitised and settings saved before layers existed fall back to the
 * built-in set. Older entries carry no id; there it matches the kind.
 */
function normaliseLayers(raw: any, rawGroupLists: any): LayerSetting[] {
  const base: LayerSetting[] = Array.isArray(raw)
    ? // An empty array is a real state (every layer deleted), not a missing field
      raw
        .filter((l) => l && KINDS.includes(l.kind) && typeof l.name === 'string' && l.name.trim())
        .map((l) => ({
          id: typeof l.id === 'string' && l.id ? l.id : (l.kind as string),
          kind: l.kind as GroupKind,
          name: l.name as string,
          visible: l.visible !== false,
          features: normaliseFeatures(l.features)
        }))
    : DEFAULT_LAYERS.map((l) => ({ ...l, features: [] }));

  // Sub-groups were removed: lift the members of any stored list into its layer
  const legacyLists: any[] = Array.isArray(rawGroupLists) ? rawGroupLists : [];
  if (!legacyLists.length) return base;
  return base.map((layer) => ({
    ...layer,
    features: [
      ...layer.features,
      ...legacyLists.filter((l) => l && l.group === layer.id).flatMap((l) => normaliseFeatures(l.members))
    ]
  }));
}

function normalise(raw: any): AppSettings {
  if (!raw || typeof raw !== 'object') return DEFAULT_SETTINGS;
  return {
    vulnerableCriteria: { ...DEFAULT_VULNERABLE_CRITERIA, ...(raw.vulnerableCriteria || {}) },
    layers: normaliseLayers(raw.layers, raw.groupLists),
    showHeatmap: !!raw.showHeatmap
  };
}

function canUseUserStorage(ctx: AddonContext): boolean {
  return !!(ctx.session && ctx.sessionId && ctx.mktToken && !ctx.isMock);
}

function readHeaders(ctx: AddonContext): Record<string, string> {
  return {
    'X-Marketplace-Token': ctx.mktToken as string,
    'X-BMS-Session-Id': ctx.sessionId as string
  };
}

// --- local fallback, used in mock mode and when the cloud call fails ---------

function loadLocal(): AppSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(LOCAL_FALLBACK_KEY);
    return raw ? normalise(JSON.parse(raw)) : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveLocal(settings: AppSettings) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_FALLBACK_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn('Failed to cache settings locally:', err);
  }
}

// --- BMS User Storage -------------------------------------------------------

/**
 * Read the addon settings from BMS User Storage (per user, per hospital, per addon).
 * Falls back to the local cache in mock mode or when the request fails, so the
 * app keeps working offline.
 */
export async function loadSettings(ctx: AddonContext): Promise<AppSettings> {
  if (!canUseUserStorage(ctx)) return loadLocal();

  try {
    const res = await fetch(`${STORAGE_BASE}/${SETTINGS_KEY}`, {
      headers: readHeaders(ctx)
    });

    // A missing key is the normal state before the first save
    if (res.status === 404) {
      knownVersion = undefined;
      return DEFAULT_SETTINGS;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = await res.json();
    const record = json.data ?? json;
    knownVersion = record.version;
    const settings = normalise(record.value);
    saveLocal(settings);
    return settings;
  } catch (err) {
    console.warn('Failed to read settings from BMS User Storage, using local cache:', err);
    return loadLocal();
  }
}

/**
 * Write the addon settings back. Sends expectedVersion so a concurrent write
 * from another tab is rejected with 409 instead of silently overwritten; on
 * conflict the remote value wins and is returned to the caller.
 */
export async function saveSettings(
  ctx: AddonContext,
  settings: AppSettings
): Promise<{ ok: boolean; conflictWith?: AppSettings; message?: string }> {
  saveLocal(settings);
  if (!canUseUserStorage(ctx)) return { ok: true };

  try {
    const res = await fetch(`${STORAGE_BASE}/${SETTINGS_KEY}`, {
      method: 'PUT',
      headers: { 'X-BMS-Session-Id': ctx.sessionId as string, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        marketplace_token: ctx.mktToken,
        value: settings,
        ...(knownVersion !== undefined ? { expectedVersion: knownVersion } : {})
      })
    });

    if (res.status === 409) {
      // Someone else wrote first — take their version so the next save is clean
      const remote = await loadSettings(ctx);
      return { ok: false, conflictWith: remote, message: 'มีการแก้ไขจากอีกหน้าต่างหนึ่ง ระบบดึงค่าล่าสุดมาแล้ว' };
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = await res.json();
    const record = json.data ?? json;
    knownVersion = record.version;
    return { ok: true };
  } catch (err: any) {
    console.warn('Failed to write settings to BMS User Storage:', err);
    return { ok: false, message: `บันทึกขึ้น BMS ไม่สำเร็จ: ${err.message}` };
  }
}
