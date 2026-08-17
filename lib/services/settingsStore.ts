import {
  DEFAULT_VULNERABLE_CRITERIA,
  EpidemicCase,
  VulnerableCriteria
} from '../types/gis';

const STORAGE_KEY = 'bms-gis-settings';

export interface AppSettings {
  vulnerableCriteria: VulnerableCriteria;
  epidemicCases: EpidemicCase[];
  showHeatmap: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  vulnerableCriteria: DEFAULT_VULNERABLE_CRITERIA,
  epidemicCases: [],
  showHeatmap: false
};

/**
 * Settings live in localStorage so the /setting page and the map page keep the
 * same configuration across navigations.
 */
export function loadSettings(): AppSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      vulnerableCriteria: { ...DEFAULT_VULNERABLE_CRITERIA, ...(parsed.vulnerableCriteria || {}) },
      epidemicCases: Array.isArray(parsed.epidemicCases) ? parsed.epidemicCases : [],
      showHeatmap: !!parsed.showHeatmap
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn('Failed to persist settings:', err);
  }
}
