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

export type GroupKind = 'vulnerable' | 'epidemic' | 'partner' | 'resource';

/** Person-based layers enrol people; place-based layers pin locations */
export type GroupMemberKind = 'person' | 'place';

export const GROUP_MEMBER_KIND: Record<GroupKind, GroupMemberKind> = {
  vulnerable: 'person',
  epidemic: 'person',
  partner: 'place',
  resource: 'place'
};

export type LatLngTuple = [number, number];

/**
 * Where a feature sits on the map. 'home' has no coordinate of its own — it
 * follows the linked person's house, so a corrected house pin moves it too.
 */
export type FeatureGeometry =
  | { type: 'home' }
  | { type: 'point'; lat: number; lng: number }
  | { type: 'circle'; lat: number; lng: number; radius: number }
  | { type: 'polygon'; path: LatLngTuple[] }
  | { type: 'line'; path: LatLngTuple[]; weight: number };

export type GeometryKind = FeatureGeometry['type'];

/** The person a feature was created from, when it came out of a person search */
export interface FeaturePerson {
  person_id: number;
  house_id: number;
  hn?: string;
  house_address?: string;
  village_moo?: number;
  /** Epidemic layers only — the disease itself is carried by the layer name */
  treatment_start_date?: string;
}

/** One entry inside a layer */
export interface LayerFeature {
  id: string;
  name: string;
  geometry: FeatureGeometry;
  /** A single attribute the user names themselves, e.g. "ผู้ประสานงาน" = "สมชาย" */
  attribute?: { key: string; value: string };
  person?: FeaturePerson;
}

/** Default stroke width for line features, in pixels */
export const DEFAULT_LINE_WEIGHT = 4;

/** One map layer, created and named by the user */
export interface LayerSetting {
  id: string;
  /** Decides whether features are people or places, and how the layer is drawn */
  kind: GroupKind;
  name: string;
  /** Whether the layer is drawn on the map */
  visible: boolean;
  features: LayerFeature[];
}

/** The built-in layers. Their id matches the kind so settings saved before
 *  layers were editable still resolve. */
export const DEFAULT_LAYERS: LayerSetting[] = [
  { id: 'vulnerable', kind: 'vulnerable', name: 'กลุ่มติดตามต่อเนื่อง', visible: true, features: [] },
  { id: 'epidemic', kind: 'epidemic', name: 'กลุ่มระบาดวิทยาและควบคุมโรค', visible: true, features: [] },
  { id: 'partner', kind: 'partner', name: 'ภาคีเครือข่าย', visible: true, features: [] },
  { id: 'resource', kind: 'resource', name: 'ทรัพยากรสุขภาพ', visible: true, features: [] }
];

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
