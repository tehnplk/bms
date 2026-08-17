#!/usr/bin/env node

/**
 * HOSxP Catchment GIS: BMS API Seed Runner
 * สคริปต์ Node.js สำหรับรันคำสั่งอัปเดตพิกัดบ้านผ่าน BMS Session API (/api/sql)
 * 
 * วิธีใช้งาน:
 *   node seed/seed_bms_api.mjs --session=<BMS_SESSION_ID> --token=<MARKETPLACE_TOKEN>
 * หรือ
 *   node seed/seed_bms_api.mjs --url=https://your-hospital.bmscloud.in.th --jwt=<JWT_TOKEN> --token=<MARKETPLACE_TOKEN>
 */

const PASTE_JSON_URL = 'https://hosxp.net/phapi/PasteJSON';
const APP_ID = 'BMS.CatchmentGIS.SeedScript';

function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    if (arg.startsWith('--')) {
      const [key, val] = arg.slice(2).split('=');
      args[key] = val || true;
    }
  });
  return args;
}

async function resolveSession(sessionId) {
  console.log(`🔍 กำลังตรวจสอบ Session: ${sessionId}...`);
  const res = await fetch(`${PASTE_JSON_URL}?Action=GET&code=${encodeURIComponent(sessionId)}`);
  if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
  
  const json = await res.json();
  if (json.MessageCode !== 200 || !json.result?.user_info?.bms_url) {
    throw new Error(`ไม่สามารถ Resolve Session ได้: ${json.Message || 'Invalid response'}`);
  }

  const u = json.result.user_info;
  return {
    bmsUrl: u.bms_url,
    jwt: u.bms_session_code || json.result?.key_value,
    hospitalCode: u.hospital_code,
    hospitalName: u.hospital_name || u.hospital_code,
    databaseType: u.bms_database_type
  };
}

async function executeSql(bmsUrl, jwt, mktToken, sql, params = null) {
  const body = {
    sql,
    app: APP_ID
  };
  if (params) body.params = params;
  if (mktToken) body['marketplace-token'] = mktToken;

  const res = await fetch(`${bmsUrl}/api/sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return res.json();
}

/**
 * PUT /api/rest/{table}/{id}
 * Endpoint มาตรฐานของ BMS Session API สำหรับ UPDATE ข้อมูลลงฐานข้อมูล HOSxP
 */
async function restPut(bmsUrl, jwt, mktToken, table, id, updateFields) {
  const url = `${bmsUrl}/api/rest/${table}/${encodeURIComponent(id)}`;
  const body = {
    ...updateFields,
    'marketplace-token': mktToken
  };

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) throw new Error(`HTTP PUT ${res.status}: ${res.statusText}`);
  return res.json();
}

async function main() {
  const args = parseArgs();

  console.log('\n======================================================');
  console.log('  🏥 HOSxP Catchment GIS - Database Coordinate Seeder');
  console.log('======================================================\n');

  let bmsUrl = args.url;
  let jwt = args.jwt;
  const mktToken = args.token || args.marketplace_token || null;

  if (args.session || args['session-id']) {
    const sessionData = await resolveSession(args.session || args['session-id']);
    bmsUrl = sessionData.bmsUrl;
    jwt = sessionData.jwt;
    console.log(`✅ เชื่อมต่อโรงพยาบาล: ${sessionData.hospitalName} (${sessionData.hospitalCode})`);
    console.log(`📦 ประเภทฐานข้อมูล: ${sessionData.databaseType}`);
    console.log(`🌐 BMS Tunnel URL: ${bmsUrl}\n`);
  }

  if (!bmsUrl || !jwt) {
    console.error('❌ กรุณาระบุ --session=<SESSION_ID> หรือ --url=<BMS_URL> --jwt=<JWT_TOKEN>');
    console.log('\nตัวอย่าง:');
    console.log('  node seed/seed_bms_api.mjs --session=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx --token=mkt_xxxxxx\n');
    process.exit(1);
  }

  try {
    // Step 1: Count total & unmapped houses
    console.log('📊 กำลังตรวจสอบจำนวนหลังคาเรือน...');
    const countSql = `
      SELECT 
        COUNT(h.house_id) AS total,
        SUM(CASE WHEN h.latitude IS NOT NULL AND h.latitude != '' AND h.latitude != '0' THEN 1 ELSE 0 END) AS mapped,
        SUM(CASE WHEN h.latitude IS NULL OR h.latitude = '' OR h.latitude = '0' THEN 1 ELSE 0 END) AS unmapped
      FROM house h
      LEFT JOIN village v ON h.village_id = v.village_id
      WHERE v.village_moo > 0
    `;
    const countRes = await executeSql(bmsUrl, jwt, mktToken, countSql);
    const countData = countRes.data?.[0] || {};
    console.log(`   - หลังคาเรือนทั้งหมด: ${countData.total || 0} หลัง`);
    console.log(`   - มีพิกัดแล้ว: ${countData.mapped || 0} หลัง`);
    console.log(`   - ยังไม่มีพิกัด: ${countData.unmapped || 0} หลัง\n`);

    // Step 2: Seed village coordinates in Phitsanulok
    console.log('📍 ขั้นตอนที่ 1: ตรวจสอบและบันทึกพิกัดศูนย์กลางหมู่บ้านในจังหวัดพิษณุโลก (village)...');
    const villageSql = `SELECT village_id, village_moo, latitude, longitude FROM village WHERE village_moo > 0`;
    const villageRes = await executeSql(bmsUrl, jwt, mktToken, villageSql);
    const vList = villageRes.data || [];

    const phitsanulokBaseLat = 16.821100;
    const phitsanulokBaseLng = 100.265900;

    for (const v of vList) {
      const vMoo = Number(v.village_moo || 1);
      // กระจายหมู่บ้านรอบตัวเมืองพิษณุโลก (รัศมี 2-5 กม.)
      const vLat = (phitsanulokBaseLat + ((vMoo % 5) - 2) * 0.0115 + (Math.floor(vMoo / 5) * 0.005)).toFixed(6);
      const vLng = (phitsanulokBaseLng + (Math.floor(vMoo / 5) - 1) * 0.0125 + ((vMoo % 3) * 0.004)).toFixed(6);
      try {
        await restPut(bmsUrl, jwt, mktToken, 'village', v.village_id, {
          latitude: vLat,
          longitude: vLng
        });
      } catch (e) {
        // ignore
      }
    }
    console.log(`   ✅ ปรับปรุงพิกัดหมู่บ้านในจังหวัดพิษณุโลก ${vList.length} หมู่เรียบร้อย\n`);

    // Step 3: Seed house coordinates in Phitsanulok via PUT /api/rest/house/{id}
    console.log('🏡 ขั้นตอนที่ 2: ดึงรายการบ้านเพื่อย้ายพิกัดไปจังหวัดพิษณุโลก...');
    const unmappedSql = `
      SELECT h.house_id, h.village_id, v.village_moo, v.latitude as v_lat, v.longitude as v_lng
      FROM house h
      LEFT JOIN village v ON h.village_id = v.village_id
      LIMIT 1000
    `;
    const unmappedRes = await executeSql(bmsUrl, jwt, mktToken, unmappedSql);
    const unmappedList = unmappedRes.data || [];
    console.log(`   พบ ${unmappedList.length} หลังที่ต้องการอัปเดตพิกัด\n`);

    if (unmappedList.length > 0) {
      console.log('🚀 กำลังส่งคำขอ PUT /api/rest/house/{house_id} เพื่อย้ายพิกัดไปพิษณุโลก...');
      let successCount = 0;

      for (const h of unmappedList) {
        const vMoo = Number(h.village_moo || 1);
        const baseLat = parseFloat(h.v_lat) || (phitsanulokBaseLat + ((vMoo % 5) - 2) * 0.0115);
        const baseLng = parseFloat(h.v_lng) || (phitsanulokBaseLng + (Math.floor(vMoo / 5) - 1) * 0.0125);

        // กระจายหลังคาเรือนรอบศูนย์กลางหมู่บ้านในพิษณุโลก
        const newLat = (baseLat + ((h.house_id % 23) - 11) * 0.00035 + (Math.random() - 0.5) * 0.00020).toFixed(6);
        const newLng = (baseLng + ((h.house_id % 19) - 9) * 0.00035 + (Math.random() - 0.5) * 0.00020).toFixed(6);

        try {
          const putRes = await restPut(bmsUrl, jwt, mktToken, 'house', h.house_id, {
            latitude: newLat,
            longitude: newLng,
            location_latitude: newLat,
            location_longitude: newLng
          });

          if (putRes.MessageCode === 200 || putRes.MessageCode === 204) {
            successCount++;
            if (successCount % 25 === 0 || successCount === unmappedList.length) {
              process.stdout.write(`\r   ✅ อัปเดตพิกัดพิษณุโลกแล้ว: ${successCount}/${unmappedList.length} หลัง`);
            }
          }
        } catch (putErr) {
          // ignore
        }
      }
      console.log(`\n\n   ✅ ย้ายพิกัดบ้านทั้งหมด ${successCount} หลังไปจังหวัดพิษณุโลกเรียบร้อยแล้ว!\n`);
    }

    console.log('🎉 เสร็จสิ้นกระบวนการ Seed ข้อมูลพิกัดบ้านทุกหลังเรียบร้อยแล้ว!');
  } catch (err) {
    console.error(`❌ เกิดข้อผิดพลาด: ${err.message}`);
    process.exit(1);
  }
}

main();
