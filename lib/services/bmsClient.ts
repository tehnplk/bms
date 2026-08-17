import { AddonContext, BMSApiResponse, BMSSessionInfo, SqlQueryParams } from '../types/bms';

const APP_ID = 'bms-hosxp-catchment-gis';
const BMS_GATEWAY_URL = 'https://hosxp-marketplace.bmscloud.in.th/api/v1/session/resolve';

/**
 * Clean session params from current URL without reloading page
 */
export function cleanUrlParams() {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    const paramsToClean = ['session_id', 'bms_session_id', 'bms_url', 'jwt', 'mkt_token', 'marketplace_token'];
    let changed = false;

    paramsToClean.forEach(p => {
      if (url.searchParams.has(p)) {
        url.searchParams.delete(p);
        changed = true;
      }
    });

    if (changed) {
      window.history.replaceState({}, document.title, url.pathname + (url.searchParams.toString() ? `?${url.searchParams.toString()}` : ''));
    }
  } catch (e) {
    console.warn('Failed to clean URL params:', e);
  }
}

/**
 * Parse initial context from URL query string
 */
export function parseInitialParams(): {
  sessionId?: string;
  bmsUrl?: string;
  jwt?: string;
  mktToken?: string;
  hn?: string;
  personId?: string;
  houseId?: string;
  villageId?: string;
} {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  return {
    sessionId: params.get('session_id') || params.get('bms_session_id') || undefined,
    bmsUrl: params.get('bms_url') || undefined,
    jwt: params.get('jwt') || params.get('token') || undefined,
    mktToken: params.get('mkt_token') || params.get('marketplace_token') || undefined,
    hn: params.get('hn') || undefined,
    personId: params.get('person_id') || undefined,
    houseId: params.get('house_id') || undefined,
    villageId: params.get('village_id') || undefined
  };
}

/**
 * Resolve BMS session GUID to obtain connection info
 */
export async function resolveSession(sessionId: string): Promise<BMSSessionInfo> {
  const res = await fetch(`${BMS_GATEWAY_URL}?session_id=${encodeURIComponent(sessionId)}`, {
    headers: {
      Accept: 'application/json'
    }
  });

  if (!res.ok) {
    throw new Error(`Failed to resolve BMS session: HTTP ${res.status}`);
  }

  const data = await res.json();
  if (data.status !== 'success' && !data.bms_url) {
    throw new Error(data.message || 'Invalid session response from BMS Gateway');
  }

  return {
    bmsUrl: data.bms_url,
    jwt: data.jwt || data.token,
    hospitalCode: data.hospital_code || 'HOSP',
    hospitalName: data.hospital_name || data.hospital_code || 'โรงพยาบาลบริการ',
    databaseType: data.database_type || 'MariaDB',
    userName: data.user_name,
    userRole: data.user_role
  };
}

/**
 * Bootstrap the Addon Context
 */
export async function bootstrapAddon(): Promise<AddonContext> {
  const initParams = parseInitialParams();

  // 1. If direct session ID provided
  if (initParams.sessionId) {
    try {
      const session = await resolveSession(initParams.sessionId);
      cleanUrlParams();
      return {
        session,
        sessionId: initParams.sessionId,
        mktToken: initParams.mktToken,
        readOnly: !initParams.mktToken,
        isMock: false,
        hn: initParams.hn,
        personId: initParams.personId,
        houseId: initParams.houseId,
        villageId: initParams.villageId
      };
    } catch (err) {
      console.warn('BMS session resolve failed, falling back to mock mode:', err);
    }
  }

  // 2. If direct BMS URL & JWT passed (direct dev tunnel)
  if (initParams.bmsUrl && initParams.jwt) {
    const session: BMSSessionInfo = {
      bmsUrl: initParams.bmsUrl,
      jwt: initParams.jwt,
      hospitalCode: 'HOSP_DEV',
      hospitalName: 'ระบบจำลอง HOSxP (BMS Direct Tunnel)',
      databaseType: 'MariaDB'
    };
    cleanUrlParams();
    return {
      session,
      sessionId: 'direct-dev',
      mktToken: initParams.mktToken,
      readOnly: !initParams.mktToken,
      isMock: false,
      hn: initParams.hn,
      personId: initParams.personId,
      houseId: initParams.houseId,
      villageId: initParams.villageId
    };
  }

  // 3. Check for Local BMS Dev Portal (port 45011)
  try {
    const localDevUrl = 'http://127.0.0.1:45011';
    const localJwt = '3769D0BA-21B7-4C8A-9D3E-8FED11698E5D';
    const localMktToken = '1E2ABE52-4B23-4071-A7E6-FE353D3EFF1C';

    const testRes = await fetch(`${localDevUrl}/api/sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localJwt}`
      },
      body: JSON.stringify({
        sql: 'SELECT 1 as live_test',
        app: APP_ID,
        'marketplace-token': localMktToken
      })
    });

    if (testRes.ok) {
      const data = await testRes.json();
      if (data.MessageCode === 200) {
        return {
          session: {
            bmsUrl: localDevUrl,
            jwt: localJwt,
            hospitalCode: 'DEV99',
            hospitalName: 'BMS Dev Portal Hospital',
            databaseType: 'MariaDB (Embedded)'
          },
          sessionId: 'bms-dev-portal-local',
          mktToken: localMktToken,
          readOnly: false,
          isMock: false,
          hn: initParams.hn,
          personId: initParams.personId,
          houseId: initParams.houseId,
          villageId: initParams.villageId
        };
      }
    }
  } catch (e) {
    // Local portal not responding, fallback to mock
  }

  // 4. Fallback to Mock Context
  return {
    session: null,
    sessionId: undefined,
    mktToken: undefined,
    readOnly: false,
    isMock: true,
    hn: initParams.hn,
    personId: initParams.personId,
    houseId: initParams.houseId,
    villageId: initParams.villageId
  };
}

/**
 * Execute SQL via /api/sql endpoint (Read-Only)
 */
export async function executeSql<T = any>(
  ctx: AddonContext,
  sql: string,
  params?: SqlQueryParams
): Promise<BMSApiResponse<T>> {
  if (ctx.isMock || !ctx.session) {
    throw new Error('Cannot execute SQL in mock mode');
  }

  const endpoint = `${ctx.session.bmsUrl}/api/sql`;
  const body: Record<string, any> = {
    sql,
    app: APP_ID
  };

  if (params && Object.keys(params).length > 0) {
    body.params = params;
  }

  if (ctx.mktToken) {
    body['marketplace-token'] = ctx.mktToken;
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ctx.session.jwt}`
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    throw new Error(`BMS SQL Error: HTTP ${res.status} ${res.statusText}`);
  }

  return res.json();
}

/**
 * Update house coordinate via PUT /api/rest/house/{house_id}
 */
export async function updateHouseLocation(
  ctx: AddonContext,
  houseId: number,
  lat: number,
  lng: number
): Promise<{ success: boolean; message: string }> {
  if (ctx.isMock || !ctx.session) {
    return {
      success: true,
      message: `[โหมดจำลอง] บันทึกพิกัดบ้านเลขที่ (ID: ${houseId}) -> Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)} เรียบร้อยแล้ว`
    };
  }

  const endpoint = `${ctx.session.bmsUrl}/api/rest/house/${encodeURIComponent(houseId.toString())}`;
  const body: Record<string, any> = {
    latitude: lat.toFixed(6),
    longitude: lng.toFixed(6),
    location_latitude: lat.toFixed(6),
    location_longitude: lng.toFixed(6)
  };

  if (ctx.mktToken) {
    body['marketplace-token'] = ctx.mktToken;
  }

  try {
    const res = await fetch(endpoint, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ctx.session.jwt}`
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      return {
        success: false,
        message: `HTTP PUT ${res.status}: ${res.statusText}`
      };
    }

    return {
      success: true,
      message: `บันทึกพิกัดบ้านลงฐานข้อมูล HOSxP (house_id: ${houseId}) สำเร็จ!`
    };
  } catch (err: any) {
    return {
      success: false,
      message: `เกิดข้อผิดพลาดในการเชื่อมต่อ: ${err.message}`
    };
  }
}
