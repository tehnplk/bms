const BMS_URL = 'http://127.0.0.1:45011';
const JWT = '3769D0BA-21B7-4C8A-9D3E-8FED11698E5D';
const MKT_TOKEN = '1E2ABE52-4B23-4071-A7E6-FE353D3EFF1C';

async function testBatch() {
  const t0 = Date.now();
  const promises = [];
  for (let i = 1; i <= 20; i++) {
    promises.push(
      fetch(`${BMS_URL}/api/rest/person`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${JWT}`
        },
        body: JSON.stringify({
          person_id: i,
          house_id: i,
          village_id: 1,
          pname: 'นาย',
          fname: `ทดสอบ${i}`,
          lname: `ระบบ${i}`,
          sex: '1',
          birthdate: '1980-01-01',
          house_regist_type_id: 1,
          'marketplace-token': MKT_TOKEN
        })
      })
    );
  }
  const results = await Promise.all(promises);
  console.log(`Inserted 20 items in ${Date.now() - t0}ms, all ok:`, results.every(r => r.ok));

  // Check count
  const countRes = await fetch(`${BMS_URL}/api/sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${JWT}`
    },
    body: JSON.stringify({
      sql: 'SELECT COUNT(*) as count FROM person',
      app: 'bms-hosxp-catchment-gis',
      'marketplace-token': MKT_TOKEN
    })
  });
  console.log('Count:', await countRes.json());
}

testBatch();
