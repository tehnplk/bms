import { AddonContext } from '../types/bms';
import {
  DEFAULT_VULNERABLE_CRITERIA,
  GroupList,
  VulnerableCriteria
} from '../types/gis';

const STORAGE_BASE = 'https://hosxp-marketplace.bmscloud.in.th/api/v1/addon/storage';
/** Key charset is [A-Za-z0-9./:-] — underscores are rejected by the reference client */
const SETTINGS_KEY = 'settings/app';
const LOCAL_FALLBACK_KEY = 'bms-gis-settings';

export interface AppSettings {
  vulnerableCriteria: VulnerableCriteria;
  groupLists: GroupList[];
  showHeatmap: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  vulnerableCriteria: DEFAULT_VULNERABLE_CRITERIA,
  groupLists: [],
  showHeatmap: false
};

/** Version of the stored value, used for optimistic concurrency on write */
let knownVersion: number | undefined;

function normalise(raw: any): AppSettings {
  if (!raw || typeof raw !== 'object') return DEFAULT_SETTINGS;
  return {
    vulnerableCriteria: { ...DEFAULT_VULNERABLE_CRITERIA, ...(raw.vulnerableCriteria || {}) },
    groupLists: Array.isArray(raw.groupLists) ? raw.groupLists : [],
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
