/**
 * GIS & Catchment Data Types & Constants
 */

export const DEFAULT_MAP_CENTER: [number, number] = [16.821100, 100.265900]; // Phitsanulok
export const DEFAULT_ZOOM = 14;

export const TILE_PROVIDERS = {
  osm: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>'
  }
};

export type HealthRiskCategory = 'normal' | 'chronic' | 'vulnerable' | 'mch' | 'epidemic' | 'unmapped';

/** Tunable rules that decide which houses count as vulnerable */
export interface VulnerableCriteria {
  elderlyAge: number;
  includeDisabled: boolean;
  includeBedridden: boolean;
}

export const DEFAULT_VULNERABLE_CRITERIA: VulnerableCriteria = {
  elderlyAge: 75,
  includeDisabled: true,
  includeBedridden: true
};

export type GroupKind = 'vulnerable' | 'epidemic';

/** A person enrolled in a follow-up list */
export interface GroupMember {
  person_id: number;
  house_id: number;
  person_name: string;
  hn?: string;
  house_address: string;
  village_moo: number;
  /** Epidemic lists only — the disease itself is carried by the list name */
  treatment_start_date?: string;
}

/** A named follow-up list inside one group */
export interface GroupList {
  id: string;
  group: GroupKind;
  name: string;
  members: GroupMember[];
  /** Whether this list's houses are highlighted on the map */
  activeOnMap: boolean;
  created_date: string;
}

export interface Resident {
  person_id: number;
  house_id: number;
  hn?: string;
  cid?: string;
  pname: string;
  fname: string;
  lname: string;
  birthdate?: string;
  age?: number;
  sex: string; // '1' = Male, '2' = Female
  house_regist_type_id?: number; // 1 = เจ้าบ้าน, 2 = ผู้อาศัย
  chronic_diseases?: string[];
  is_elderly?: boolean;
  is_disabled?: boolean;
  is_bedridden?: boolean;
  is_pregnant?: boolean;
  has_infant?: boolean;
  blood_group?: string;
  pttype_name?: string;
  phone_number?: string;
}

export interface House {
  house_id: number;
  village_id: number;
  village_moo: number;
  village_name: string;
  address: string;
  road?: string;
  census_id?: string;
  latitude: number | null;
  longitude: number | null;
  family_count?: number;
  head_person_id?: number;
  head_person_name?: string;
  residents: Resident[];
  primary_health_category: HealthRiskCategory;
  has_chronic: boolean;
  has_vulnerable: boolean;
  has_mch: boolean;
  has_epidemic?: boolean;
  last_survey_date?: string;
  notes?: string;
}

export interface Village {
  village_id: number;
  village_moo: number;
  village_name: string;
  village_code?: string;
  /** Sub-district name without the "ตำบล" prefix. Not yet sourced from HOSxP. */
  tambon_name?: string;
  latitude?: number;
  longitude?: number;
  total_houses?: number;
  total_population?: number;
}

export interface CatchmentStats {
  totalHouses: number;
  geocodedHouses: number;
  unmappedHouses: number;
  percentGeocoded: number;
  totalResidents: number;
  chronicPatients: number;
  vulnerablePeople: number;
  mchCount: number;
  villagesCount: number;
}

export interface FilterOptions {
  selectedVillageId: number | 'all';
  searchQuery: string;
  healthCategory: HealthRiskCategory | 'all';
  coordinateStatus: 'all' | 'geocoded' | 'unmapped';
  showHeatmap: boolean;
}
