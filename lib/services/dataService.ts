import { AddonContext } from '../types/bms';
import { CatchmentStats, DEFAULT_MAP_CENTER, FilterOptions, HealthRiskCategory, House, Resident, Village } from '../types/gis';
import { executeSql } from './bmsClient';

export interface SearchResultItem {
  house: House;
  matchedType: 'address' | 'resident' | 'hn' | 'census_id' | 'village';
  matchedResident?: Resident;
  matchText: string;
}

class DataService {
  private localHouses: House[] = [];
  private localVillages: Village[] = [];

  constructor() {
    this.initMockData();
  }

  private initMockData() {
    this.localVillages = [
      {
        village_id: 1,
        village_moo: 1,
        village_name: 'บ้านหนองหอย',
        village_code: '65010101',
        latitude: 16.821500,
        longitude: 100.264200,
        total_houses: 12,
        total_population: 38
      },
      {
        village_id: 2,
        village_moo: 2,
        village_name: 'บ้านสันติสุข',
        village_code: '65010102',
        latitude: 16.826200,
        longitude: 100.271000,
        total_houses: 10,
        total_population: 29
      },
      {
        village_id: 3,
        village_moo: 3,
        village_name: 'บ้านดอนกลาง',
        village_code: '65010103',
        latitude: 16.815800,
        longitude: 100.258900,
        total_houses: 8,
        total_population: 24
      },
      {
        village_id: 4,
        village_moo: 4,
        village_name: 'บ้านทุ่งพัฒนา',
        village_code: '65010104',
        latitude: 16.829000,
        longitude: 100.260500,
        total_houses: 9,
        total_population: 27
      },
      {
        village_id: 5,
        village_moo: 5,
        village_name: 'บ้านคลองเตย',
        village_code: '65010105',
        latitude: 16.818000,
        longitude: 100.275000,
        total_houses: 7,
        total_population: 20
      }
    ];

    const mockHouseData: Array<{
      house_id: number;
      village_id: number;
      address: string;
      road: string;
      census_id: string;
      lat: number | null;
      lng: number | null;
      residents: Array<{
        person_id: number;
        hn: string;
        pname: string;
        fname: string;
        lname: string;
        age: number;
        sex: string;
        is_head?: boolean;
        chronic?: string[];
        is_elderly?: boolean;
        is_disabled?: boolean;
        is_bedridden?: boolean;
        is_pregnant?: boolean;
        has_infant?: boolean;
        pttype_name?: string;
      }>;
    }> = [
      // Village 1
      {
        house_id: 101,
        village_id: 1,
        address: '12/1',
        road: 'สายหลัก',
        census_id: '6501-0101-0001',
        lat: 16.821420,
        lng: 100.264110,
        residents: [
          { person_id: 1001, hn: '0014201', pname: 'นาย', fname: 'สมชาย', lname: 'ใจดี', age: 65, sex: '1', is_head: true, chronic: ['เบาหวาน', 'ความดันโลหิตสูง'], is_elderly: true },
          { person_id: 1002, hn: '0014202', pname: 'นาง', fname: 'สมศรี', lname: 'ใจดี', age: 62, sex: '2', is_head: false, chronic: ['ไขมันในเลือดสูง'], is_elderly: true },
          { person_id: 1003, hn: '0021503', pname: 'นาย', fname: 'ธนา', lname: 'ใจดี', age: 34, sex: '1', is_head: false }
        ]
      },
      {
        house_id: 102,
        village_id: 1,
        address: '15',
        road: 'ซอย 1',
        census_id: '6501-0101-0002',
        lat: 16.821850,
        lng: 100.264560,
        residents: [
          { person_id: 1004, hn: '0015301', pname: 'นางสาว', fname: 'วิภา', lname: 'สมบัติ', age: 29, sex: '2', is_head: true, is_pregnant: true },
          { person_id: 1005, hn: '0015302', pname: 'นาย', fname: 'เอกชัย', lname: 'ทองแท้', age: 31, sex: '1', is_head: false }
        ]
      },
      {
        house_id: 103,
        village_id: 1,
        address: '18/2',
        road: 'ซอย 1',
        census_id: '6501-0101-0003',
        lat: 16.822100,
        lng: 100.263800,
        residents: [
          { person_id: 1006, hn: '0009821', pname: 'นาย', fname: 'บุญมี', lname: 'คำสอน', age: 78, sex: '1', is_head: true, is_bedridden: true, is_elderly: true, chronic: ['หลอดเลือดสมอง (Stroke)', 'ความดันโลหิตสูง'] },
          { person_id: 1007, hn: '0019230', pname: 'นาง', fname: 'มาลี', lname: 'คำสอน', age: 74, sex: '2', is_head: false, is_elderly: true }
        ]
      },
      {
        house_id: 104,
        village_id: 1,
        address: '22',
        road: 'ซอย 2',
        census_id: '6501-0101-0004',
        lat: 16.820900,
        lng: 100.264800,
        residents: [
          { person_id: 1008, hn: '0031021', pname: 'นาย', fname: 'ประเสริฐ', lname: 'เจริญดี', age: 54, sex: '1', is_head: true },
          { person_id: 1009, hn: '0031022', pname: 'นาง', fname: 'อำไพ', lname: 'เจริญดี', age: 52, sex: '2', is_head: false }
        ]
      },
      {
        house_id: 105,
        village_id: 1,
        address: '27/1',
        road: 'ซอย 2',
        census_id: '6501-0101-0005',
        lat: null, // Unmapped house
        lng: null,
        residents: [
          { person_id: 1010, hn: '0040112', pname: 'นาย', fname: 'สุชาติ', lname: 'วงศ์สวัสดิ์', age: 48, sex: '1', is_head: true, chronic: ['เบาหวาน'] },
          { person_id: 1011, hn: '0040113', pname: 'นาง', fname: 'วรรณา', lname: 'วงศ์สวัสดิ์', age: 45, sex: '2', is_head: false }
        ]
      },
      {
        house_id: 106,
        village_id: 1,
        address: '33',
        road: 'ริมคลอง',
        census_id: '6501-0101-0006',
        lat: 16.822450,
        lng: 100.265200,
        residents: [
          { person_id: 1012, hn: '0051201', pname: 'นาง', fname: 'อรทัย', lname: 'พงษ์ศิริ', age: 32, sex: '2', is_head: true, has_infant: true },
          { person_id: 1013, hn: '0051202', pname: 'ด.ช.', fname: 'กิตติพงษ์', lname: 'พงษ์ศิริ', age: 0, sex: '1', is_head: false, has_infant: true }
        ]
      },
      // Village 2
      {
        house_id: 201,
        village_id: 2,
        address: '5/1',
        road: 'สันติสุขสาย 1',
        census_id: '6501-0102-0001',
        lat: 16.826100,
        lng: 100.270900,
        residents: [
          { person_id: 2001, hn: '0061201', pname: 'นาย', fname: 'ทองดี', lname: 'รุ่งโรจน์', age: 71, sex: '1', is_head: true, is_disabled: true, is_elderly: true },
          { person_id: 2002, hn: '0061202', pname: 'นาง', fname: 'สายใจ', lname: 'รุ่งโรจน์', age: 68, sex: '2', is_head: false, is_elderly: true }
        ]
      },
      {
        house_id: 202,
        village_id: 2,
        address: '9',
        road: 'สันติสุขสาย 1',
        census_id: '6501-0102-0002',
        lat: 16.826450,
        lng: 100.271350,
        residents: [
          { person_id: 2003, hn: '0071301', pname: 'นาย', fname: 'กานดา', lname: 'สุขสำราญ', age: 58, sex: '2', is_head: true, chronic: ['ไตวายเรื้อรัง (CKD)', 'ความดันโลหิตสูง'] }
        ]
      },
      {
        house_id: 203,
        village_id: 2,
        address: '14/3',
        road: 'สันติสุขสาย 2',
        census_id: '6501-0102-0003',
        lat: 16.825800,
        lng: 100.270500,
        residents: [
          { person_id: 2004, hn: '0081401', pname: 'นาย', fname: 'อำนวย', lname: 'พลรบ', age: 44, sex: '1', is_head: true },
          { person_id: 2005, hn: '0081402', pname: 'นาง', fname: 'จิตรา', lname: 'พลรบ', age: 41, sex: '2', is_head: false }
        ]
      },
      {
        house_id: 204,
        village_id: 2,
        address: '20',
        road: 'สันติสุขสาย 2',
        census_id: '6501-0102-0004',
        lat: null, // Unmapped
        lng: null,
        residents: [
          { person_id: 2006, hn: '0091501', pname: 'นาง', fname: 'จันทร์เพ็ญ', lname: 'ศรีทอง', age: 50, sex: '2', is_head: true, chronic: ['เบาหวาน'] }
        ]
      },
      // Village 3
      {
        house_id: 301,
        village_id: 3,
        address: '3/1',
        road: 'ดอนกลางเหนือ',
        census_id: '6501-0103-0001',
        lat: 16.815750,
        lng: 100.258850,
        residents: [
          { person_id: 3001, hn: '0101601', pname: 'นาย', fname: 'ชวลิต', lname: 'มั่งมี', age: 67, sex: '1', is_head: true, is_elderly: true, chronic: ['ความดันโลหิตสูง'] }
        ]
      },
      {
        house_id: 302,
        village_id: 3,
        address: '8',
        road: 'ดอนกลางใต้',
        census_id: '6501-0103-0002',
        lat: 16.816100,
        lng: 100.259200,
        residents: [
          { person_id: 3002, hn: '0111701', pname: 'นางสาว', fname: 'สุดา', lname: 'แก้วมณี', age: 26, sex: '2', is_head: true, is_pregnant: true }
        ]
      },
      {
        house_id: 303,
        village_id: 3,
        address: '15/2',
        road: 'ดอนกลางใต้',
        census_id: '6501-0103-0003',
        lat: null,
        lng: null,
        residents: [
          { person_id: 3003, hn: '0121801', pname: 'นาย', fname: 'ประสิทธิ์', lname: 'มีลาภ', age: 82, sex: '1', is_head: true, is_elderly: true, is_bedridden: true }
        ]
      },
      // Village 4
      {
        house_id: 401,
        village_id: 4,
        address: '1/1',
        road: 'ทุ่งพัฒนาสายหลัก',
        census_id: '6501-0104-0001',
        lat: 16.828900,
        lng: 100.260400,
        residents: [
          { person_id: 4001, hn: '0131901', pname: 'นาย', fname: 'วินัย', lname: 'ชูเกียรติ', age: 55, sex: '1', is_head: true }
        ]
      },
      {
        house_id: 402,
        village_id: 4,
        address: '6',
        road: 'ทุ่งพัฒนาซอย 1',
        census_id: '6501-0104-0002',
        lat: 16.829300,
        lng: 100.260800,
        residents: [
          { person_id: 4002, hn: '0142001', pname: 'นาง', fname: 'นภา', lname: 'ชูเกียรติ', age: 33, sex: '2', is_head: true, has_infant: true }
        ]
      },
      // Village 5
      {
        house_id: 501,
        village_id: 5,
        address: '7/2',
        road: 'คลองเตยพัฒนา',
        census_id: '6501-0105-0001',
        lat: 16.817950,
        lng: 100.274900,
        residents: [
          { person_id: 5001, hn: '0152101', pname: 'นาย', fname: 'พีระ', lname: 'พงษ์พาณิชย์', age: 63, sex: '1', is_head: true, is_elderly: true, chronic: ['เบาหวาน'] }
        ]
      },
      {
        house_id: 502,
        village_id: 5,
        address: '11',
        road: 'คลองเตยพัฒนา',
        census_id: '6501-0105-0002',
        lat: 16.818300,
        lng: 100.275300,
        residents: [
          { person_id: 5002, hn: '0162201', pname: 'นางสาว', fname: 'กมลพร', lname: 'แซ่ลิ้ม', age: 39, sex: '2', is_head: true }
        ]
      }
    ];

    this.localHouses = mockHouseData.map(mh => {
      const v = this.localVillages.find(v => v.village_id === mh.village_id);
      const residents = mh.residents.map(r => ({
        person_id: r.person_id,
        house_id: mh.house_id,
        hn: r.hn,
        pname: r.pname,
        fname: r.fname,
        lname: r.lname,
        age: r.age,
        sex: r.sex,
        house_regist_type_id: r.is_head ? 1 : 2,
        chronic_diseases: r.chronic,
        is_elderly: r.is_elderly,
        is_disabled: r.is_disabled,
        is_bedridden: r.is_bedridden,
        is_pregnant: r.is_pregnant,
        has_infant: r.has_infant,
        pttype_name: r.pttype_name || 'บัตรทอง (UC)'
      }));

      const head = residents.find(r => r.house_regist_type_id === 1) || residents[0];
      const hasChronic = residents.some(r => r.chronic_diseases && r.chronic_diseases.length > 0);
      const hasVulnerable = residents.some(r => r.is_bedridden || r.is_disabled || (r.is_elderly && r.age! >= 75));
      const hasMch = residents.some(r => r.is_pregnant || r.has_infant);

      let cat: HealthRiskCategory = 'normal';
      if (mh.lat === null || mh.lng === null) cat = 'unmapped';
      else if (hasVulnerable) cat = 'vulnerable';
      else if (hasChronic) cat = 'chronic';
      else if (hasMch) cat = 'mch';

      return {
        house_id: mh.house_id,
        village_id: mh.village_id,
        village_moo: v?.village_moo || 1,
        village_name: v?.village_name || 'หมู่ 1',
        address: mh.address,
        road: mh.road,
        census_id: mh.census_id,
        latitude: mh.lat,
        longitude: mh.lng,
        family_count: 1,
        head_person_id: head?.person_id,
        head_person_name: head ? `${head.pname}${head.fname} ${head.lname}` : undefined,
        residents,
        primary_health_category: cat,
        has_chronic: hasChronic,
        has_vulnerable: hasVulnerable,
        has_mch: hasMch
      };
    });
  }

  /**
   * Search houses by resident name, HN, CID, or house address (person -> house -> village)
   */
  searchHousesAndResidents(query: string, houses: House[] = this.localHouses): SearchResultItem[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const results: SearchResultItem[] = [];
    const seenHouseIds = new Set<number>();

    for (const house of houses) {
      // 1. Check match by resident name, HN, CID (person table)
      let residentMatch: Resident | undefined;
      for (const res of house.residents) {
        const fullName = `${res.pname}${res.fname} ${res.lname}`.toLowerCase();
        const fnameLname = `${res.fname} ${res.lname}`.toLowerCase();
        if (
          fullName.includes(q) ||
          fnameLname.includes(q) ||
          (res.fname && res.fname.toLowerCase().includes(q)) ||
          (res.lname && res.lname.toLowerCase().includes(q))
        ) {
          residentMatch = res;
          results.push({
            house,
            matchedType: 'resident',
            matchedResident: res,
            matchText: `${res.pname}${res.fname} ${res.lname}`
          });
          seenHouseIds.add(house.house_id);
          break;
        }

        if (res.hn && res.hn.toLowerCase().includes(q)) {
          residentMatch = res;
          results.push({
            house,
            matchedType: 'hn',
            matchedResident: res,
            matchText: `HN: ${res.hn} (${res.pname}${res.fname} ${res.lname})`
          });
          seenHouseIds.add(house.house_id);
          break;
        }
      }

      if (seenHouseIds.has(house.house_id)) continue;

      // 2. Check match by house address / census_id (house table)
      const addrClean = house.address.toLowerCase();
      if (addrClean === q || addrClean.includes(q) || `บ้านเลขที่ ${addrClean}`.includes(q) || `${addrClean}/`.includes(q)) {
        results.push({
          house,
          matchedType: 'address',
          matchText: `บ้านเลขที่ ${house.address}`
        });
        seenHouseIds.add(house.house_id);
        continue;
      }

      if (house.census_id && house.census_id.toLowerCase().includes(q)) {
        results.push({
          house,
          matchedType: 'census_id',
          matchText: `รหัสบ้าน: ${house.census_id}`
        });
        seenHouseIds.add(house.house_id);
        continue;
      }

      // 3. Check match by village name
      if (house.village_name.toLowerCase().includes(q) || `หมู่ ${house.village_moo}`.includes(q)) {
        results.push({
          house,
          matchedType: 'village',
          matchText: `หมู่ ${house.village_moo} ${house.village_name}`
        });
        seenHouseIds.add(house.house_id);
      }
    }

    return results;
  }

  /**
   * Fetch all villages in catchment area directly from HOSxP database
   */
  async getVillages(ctx: AddonContext): Promise<Village[]> {
    if (!ctx.session || ctx.isMock) {
      return this.localVillages;
    }

    try {
      const sql = `
        SELECT 
          village_id, 
          village_moo, 
          village_name, 
          village_code, 
          latitude, 
          longitude,
          (SELECT COUNT(*) FROM house WHERE house.village_id = village.village_id) as total_houses
        FROM village 
        WHERE village_moo > 0
        ORDER BY village_moo ASC
      `;
      const res = await executeSql(ctx, sql);
      if (res.data && res.data.length > 0) {
        const villages: Village[] = res.data.map((row: any) => ({
          village_id: Number(row.village_id),
          village_moo: Number(row.village_moo),
          village_name: row.village_name || `หมู่ ${row.village_moo}`,
          village_code: row.village_code,
          latitude: row.latitude ? parseFloat(row.latitude) : undefined,
          longitude: row.longitude ? parseFloat(row.longitude) : undefined,
          total_houses: row.total_houses ? Number(row.total_houses) : 0
        }));
        this.localVillages = villages;
        return villages;
      }
    } catch (err) {
      console.warn('Failed to load villages from HOSxP database:', err);
    }
    return this.localVillages;
  }

  /**
   * Fetch all houses directly from physical HOSxP table 'house'
   */
  async getHouses(ctx: AddonContext, villageId?: number): Promise<House[]> {
    if (!ctx.session || ctx.isMock) {
      return villageId && villageId > 0 
        ? this.localHouses.filter(h => h.village_id === villageId)
        : this.localHouses;
    }

    try {
      // 1. Fetch houses from physical HOSxP table
      const houseSql = `
        SELECT 
          h.house_id, 
          h.village_id, 
          v.village_moo,
          v.village_name,
          h.address, 
          h.road, 
          h.census_id, 
          h.latitude, 
          h.longitude
        FROM house h
        LEFT JOIN village v ON h.village_id = v.village_id
        ${villageId ? 'WHERE h.village_id = :village_id' : ''}
        ORDER BY h.house_id ASC
        LIMIT 1000
      `;

      const params = villageId ? { village_id: { value: villageId.toString(), value_type: 'integer' as const } } : undefined;
      const houseRes = await executeSql(ctx, houseSql, params);

      if (houseRes.data && houseRes.data.length > 0) {
        const houses: House[] = houseRes.data.map((row: any) => {
          const lat = row.latitude ? parseFloat(row.latitude) : null;
          const lng = row.longitude ? parseFloat(row.longitude) : null;
          const isValidCoord = lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng) && lat > 0 && lng > 0;

          return {
            house_id: Number(row.house_id),
            village_id: Number(row.village_id),
            village_moo: Number(row.village_moo || 1),
            village_name: row.village_name || `หมู่ ${row.village_moo || 1}`,
            address: row.address || '-',
            road: row.road || '',
            census_id: row.census_id || '',
            latitude: isValidCoord ? lat : null,
            longitude: isValidCoord ? lng : null,
            residents: [],
            primary_health_category: isValidCoord ? 'normal' : 'unmapped',
            has_chronic: false,
            has_vulnerable: false,
            has_mch: false
          };
        });

        // 2. Fetch residents for these houses (best effort)
        try {
          const personSql = `
            SELECT 
              p.person_id,
              p.house_id,
              p.patient_hn as hn,
              p.pname,
              p.fname,
              p.lname,
              p.birthdate,
              TIMESTAMPDIFF(YEAR, p.birthdate, CURDATE()) AS age,
              p.sex,
              p.house_regist_type_id
            FROM person p
            ${villageId ? 'WHERE p.village_id = :village_id' : ''}
            LIMIT 4000
          `;
          const personRes = await executeSql(ctx, personSql, params);
          if (personRes.data) {
            const houseMap = new Map<number, House>();
            houses.forEach(h => houseMap.set(h.house_id, h));

            personRes.data.forEach((p: any) => {
              const h = houseMap.get(Number(p.house_id));
              if (h) {
                const resident = {
                  person_id: Number(p.person_id),
                  house_id: Number(p.house_id),
                  hn: p.hn || undefined,
                  pname: p.pname || '',
                  fname: p.fname || '',
                  lname: p.lname || '',
                  birthdate: p.birthdate,
                  age: p.age !== null ? Number(p.age) : undefined,
                  sex: p.sex || '1',
                  house_regist_type_id: p.house_regist_type_id ? Number(p.house_regist_type_id) : undefined,
                  is_elderly: p.age && Number(p.age) >= 60
                };
                h.residents.push(resident);
                if (!h.head_person_name) {
                  h.head_person_name = `${p.pname || ''}${p.fname || ''} ${p.lname || ''}`.trim();
                }
              }
            });
          }
        } catch (pErr) {
          console.warn('Could not load detailed person list:', pErr);
        }

        this.localHouses = houses;
        return houses;
      }
    } catch (err) {
      console.warn('Failed to load houses from DB, falling back to local dataset:', err);
    }

    return villageId && villageId > 0 
      ? this.localHouses.filter(h => h.village_id === villageId)
      : this.localHouses;
  }

  /**
   * Update house coordinate locally
   */
  updateLocalCoordinate(houseId: number, lat: number, lng: number) {
    const house = this.localHouses.find(h => h.house_id === houseId);
    if (house) {
      house.latitude = lat;
      house.longitude = lng;
      if (house.primary_health_category === 'unmapped') {
        if (house.has_vulnerable) house.primary_health_category = 'vulnerable';
        else if (house.has_chronic) house.primary_health_category = 'chronic';
        else if (house.has_mch) house.primary_health_category = 'mch';
        else house.primary_health_category = 'normal';
      }
    }
  }

  /**
   * Auto-generate realistic coordinates for all unmapped houses
   */
  async autoGeocodeAll(ctx: AddonContext): Promise<number> {
    const unmapped = this.localHouses.filter(h => h.latitude === null || h.longitude === null);
    
    unmapped.forEach(house => {
      const v = this.localVillages.find(v => v.village_id === house.village_id);
      const vLat = v?.latitude || DEFAULT_MAP_CENTER[0];
      const vLng = v?.longitude || DEFAULT_MAP_CENTER[1];

      const jitterLat = ((house.house_id % 13) - 6) * 0.00045 + (Math.random() - 0.5) * 0.0003;
      const jitterLng = ((house.house_id % 17) - 8) * 0.00045 + (Math.random() - 0.5) * 0.0003;

      const newLat = parseFloat((vLat + jitterLat).toFixed(6));
      const newLng = parseFloat((vLng + jitterLng).toFixed(6));

      this.updateLocalCoordinate(house.house_id, newLat, newLng);
    });

    return unmapped.length;
  }

  /**
   * Filter houses according to user selections
   */
  filterHouses(houses: House[], filters: FilterOptions): House[] {
    return houses.filter(house => {
      // 1. Village filter
      if (filters.selectedVillageId !== 'all' && house.village_id !== filters.selectedVillageId) {
        return false;
      }

      // 2. Coordinate status filter
      if (filters.coordinateStatus === 'geocoded' && (house.latitude === null || house.longitude === null)) {
        return false;
      }
      if (filters.coordinateStatus === 'unmapped' && house.latitude !== null && house.longitude !== null) {
        return false;
      }

      // 3. Health category filter
      if (filters.healthCategory !== 'all') {
        if (filters.healthCategory === 'chronic' && !house.has_chronic) return false;
        if (filters.healthCategory === 'vulnerable' && !house.has_vulnerable) return false;
        if (filters.healthCategory === 'mch' && !house.has_mch) return false;
        if (filters.healthCategory === 'unmapped' && (house.latitude !== null && house.longitude !== null)) return false;
        if (filters.healthCategory === 'normal' && (house.has_chronic || house.has_vulnerable || house.has_mch)) return false;
      }

      // 4. Search query filter
      if (filters.searchQuery.trim()) {
        const query = filters.searchQuery.toLowerCase().trim();
        const matchAddress = house.address.toLowerCase().includes(query);
        const matchVillage = house.village_name.toLowerCase().includes(query);
        const matchHead = house.head_person_name ? house.head_person_name.toLowerCase().includes(query) : false;
        const matchResident = house.residents.some(r => 
          `${r.pname}${r.fname} ${r.lname}`.toLowerCase().includes(query) ||
          (r.hn && r.hn.includes(query)) ||
          (r.chronic_diseases && r.chronic_diseases.some(c => c.toLowerCase().includes(query)))
        );

        if (!matchAddress && !matchVillage && !matchHead && !matchResident) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Calculate summary statistics for KPI widgets
   */
  calculateStats(houses: House[], villages: Village[]): CatchmentStats {
    const totalHouses = houses.length;
    const geocodedHouses = houses.filter(h => h.latitude !== null && h.longitude !== null).length;
    const unmappedHouses = totalHouses - geocodedHouses;
    const percentGeocoded = totalHouses > 0 ? Math.round((geocodedHouses / totalHouses) * 100) : 0;

    let totalResidents = 0;
    let chronicPatients = 0;
    let vulnerablePeople = 0;
    let mchCount = 0;

    houses.forEach(house => {
      totalResidents += house.residents.length || 1;
      if (house.has_chronic) chronicPatients += house.residents.filter(r => r.chronic_diseases && r.chronic_diseases.length > 0).length || 1;
      if (house.has_vulnerable) vulnerablePeople += house.residents.filter(r => r.is_elderly || r.is_disabled || r.is_bedridden).length || 1;
      if (house.has_mch) mchCount += house.residents.filter(r => r.is_pregnant || r.has_infant).length || 1;
    });

    return {
      totalHouses,
      geocodedHouses,
      unmappedHouses,
      percentGeocoded,
      totalResidents,
      chronicPatients,
      vulnerablePeople,
      mchCount,
      villagesCount: villages.length
    };
  }

  /**
   * Export to GeoJSON format
   */
  exportToGeoJSON(houses: House[]): string {
    const features = houses
      .filter(h => h.latitude !== null && h.longitude !== null)
      .map(h => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [h.longitude, h.latitude]
        },
        properties: {
          house_id: h.house_id,
          address: h.address,
          village_moo: h.village_moo,
          village_name: h.village_name,
          head_person: h.head_person_name,
          residents_count: h.residents.length,
          health_category: h.primary_health_category,
          has_chronic: h.has_chronic,
          has_vulnerable: h.has_vulnerable,
          has_mch: h.has_mch
        }
      }));

    const geoJson = {
      type: 'FeatureCollection',
      name: 'HOSxP_Catchment_Houses',
      features
    };

    return JSON.stringify(geoJson, null, 2);
  }

  /**
   * Export to CSV format
   */
  exportToCSV(houses: House[]): string {
    const headers = [
      'House ID',
      'Village Moo',
      'Village Name',
      'Address',
      'Road',
      'Census ID',
      'Latitude',
      'Longitude',
      'Head Person',
      'Residents Count',
      'Health Category'
    ];

    const rows = houses.map(h => [
      h.house_id,
      h.village_moo,
      `"${h.village_name}"`,
      `"${h.address}"`,
      `"${h.road || ''}"`,
      `"${h.census_id || ''}"`,
      h.latitude || '',
      h.longitude || '',
      `"${h.head_person_name || ''}"`,
      h.residents.length,
      h.primary_health_category
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }
}

export const dataService = new DataService();
