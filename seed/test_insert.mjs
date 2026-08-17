const BMS_URL = 'http://127.0.0.1:45011';
const JWT = '3769D0BA-21B7-4C8A-9D3E-8FED11698E5D';
const MKT_TOKEN = '1E2ABE52-4B23-4071-A7E6-FE353D3EFF1C';
const APP_ID = 'bms-hosxp-catchment-gis';

async function testQuery(sql) {
  const res = await fetch(`${BMS_URL}/api/sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${JWT}`
    },
    body: JSON.stringify({
      sql,
      app: APP_ID,
      'marketplace-token': MKT_TOKEN
    })
  });
  const data = await res.json();
  return data;
}

async function run() {
  console.log('Testing SELECT...');
  const selectRes = await testQuery('SELECT COUNT(1) as cnt FROM house');
  console.log('SELECT result:', selectRes);

  console.log('Testing INSERT 1 person...');
  const insertSql = `
    INSERT INTO person (
      person_id, house_id, village_id, cid, pname, fname, lname, sex, birthdate, house_regist_type_id, last_update
    ) VALUES (
      1, 1, 9, '1650100000001', 'นาย', 'สมศักดิ์', 'เจริญสุข', '1', '1975-05-12', 1, NOW()
    ) ON DUPLICATE KEY UPDATE fname = VALUES(fname)
  `;
  const insertRes = await testQuery(insertSql);
  console.log('INSERT result:', insertRes);

  const countRes = await testQuery('SELECT COUNT(1) as cnt FROM person');
  console.log('Person count:', countRes);
}

run();
