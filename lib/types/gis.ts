/**
 * GIS & Catchment Data Types & Constants
 */

export const DEFAULT_MAP_CENTER: [number, number] = [16.821100, 100.265900]; // Phitsanulok
export const DEFAULT_ZOOM = 14;

export type HealthRiskCategory = 'normal' | 'chronic' | 'vulnerable' | 'mch' | 'unmapped';

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
  last_survey_date?: string;
  notes?: string;
}

export interface Village {
  village_id: number;
  village_moo: number;
  village_name: string;
  village_code?: string;
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
