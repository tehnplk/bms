const BMS_URL = 'http://127.0.0.1:45011';
const JWT = '3769D0BA-21B7-4C8A-9D3E-8FED11698E5D';
const MKT_TOKEN = '1E2ABE52-4B23-4071-A7E6-FE353D3EFF1C';

async function testRest() {
  console.log('--- Testing POST /api/rest/person ---');
  try {
    const postRes = await fetch(`${BMS_URL}/api/rest/person`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${JWT}`
      },
      body: JSON.stringify({
        person_id: 1,
        house_id: 1,
        village_id: 9,
        pname: 'นาย',
        fname: 'สมศักดิ์',
        lname: 'เจริญสุข',
        sex: '1',
        birthdate: '1975-05-12',
        house_regist_type_id: 1,
        'marketplace-token': MKT_TOKEN
      })
    });
    console.log('POST status:', postRes.status);
    console.log('POST body:', await postRes.text());
  } catch(e) {
    console.log('POST error:', e.message);
  }

  console.log('--- Testing PUT /api/rest/person/1 ---');
  try {
    const putRes = await fetch(`${BMS_URL}/api/rest/person/1`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${JWT}`
      },
      body: JSON.stringify({
        person_id: 1,
        house_id: 1,
        village_id: 9,
        pname: 'นาย',
        fname: 'สมศักดิ์',
        lname: 'เจริญสุข',
        sex: '1',
        birthdate: '1975-05-12',
        house_regist_type_id: 1,
        'marketplace-token': MKT_TOKEN
      })
    });
    console.log('PUT status:', putRes.status);
    console.log('PUT body:', await putRes.text());
  } catch(e) {
    console.log('PUT error:', e.message);
  }
}

testRest();
