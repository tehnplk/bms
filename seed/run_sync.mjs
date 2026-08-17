import fs from 'fs';

// 1. Read portal tokens
function getTokens() {
  const tokenPath = 'C:\\Users\\Admin\\AppData\\Local\\BMSDevPortalHOSxPTest\\portal_tokens.txt';
  if (fs.existsSync(tokenPath)) {
    const lines = fs.readFileSync(tokenPath, 'utf8').split('\n');
    let port = '45011';
    let jwt = '';
    let mktToken = '';
    lines.forEach(l => {
      const [k, v] = l.trim().split('=');
      if (k === 'port') port = v;
      if (k === 'jwt') jwt = v;
      if (k === 'marketplace_token') mktToken = v;
    });
    return { url: `http://127.0.0.1:${port}`, jwt, mktToken };
  }
  return {
    url: 'http://127.0.0.1:45011',
    jwt: 'C71155D9-0945-4D08-B58D-3644DDC92159',
    mktToken: '0A2CCCB0-716F-46E3-B320-D675F8B1DFCB'
  };
}

const { url: BMS_URL, jwt: JWT, mktToken: MKT_TOKEN } = getTokens();
const APP_ID = 'bms-hosxp-catchment-gis';

console.log(`🔑 ใช้ Token: JWT=${JWT}, MKT=${MKT_TOKEN}`);

const MALE_NAMES = [
  'สมชาย', 'สมศักดิ์', 'วิชัย', 'ธนา', 'ประเสริฐ', 'กิตติ', 'ธีระ', 'บุญมี', 'ทองดี', 'อำนวย',
  'ชัยวัฒน์', 'เอกชัย', 'สุรชัย', 'พงษ์ศักดิ์', 'วรพจน์', 'อนุชา', 'ณัฐวุฒิ', 'ศุภชัย', 'ธนากร', 'สุรศักดิ์',
  'ภานุมาศ', 'อภิสิทธิ์', 'ศักดิ์ดา', 'นิรันดร์', 'เกษม', 'นเรศ', 'ปรีชา', 'สมนึก', 'ยุทธนา', 'ธวัชชัย',
  'วิโรจน์', 'มนตรี', 'สมคิด', 'ประสิทธิ์', 'ทรงศักดิ์', 'ชวลิต', 'วินัย', 'พีระ', 'เกียรติศักดิ์', 'สุรพล'
];

const FEMALE_NAMES = [
  'สมศรี', 'วิภา', 'กานดา', 'อรทัย', 'มาลี', 'นภาพร', 'จันทร์เพ็ญ', 'รัตนา', 'ศิริพร', 'สุภาพร',
  'วรรณา', 'พิมพา', 'อังคณา', 'ดวงใจ', 'พัชรี', 'สุมาลี', 'ปราณี', 'สายใจ', 'สุนิสา', 'กัญญารัตน์',
  'ขวัญตา', 'จิตรา', 'นฤมล', 'เบญจมาศ', 'มณีวรรณ', 'ยุพา', 'วนิดา', 'สมใจ', 'สุชาดา', 'อุไรวรรณ',
  'สุดา', 'ชไมพร', 'กมลพร', 'ละออ', 'บุญเรือน', 'บังอร', 'วันเพ็ญ', 'ศศิธร', 'ยุพดี', 'พรทิพย์'
];

const SURNAMES = [
  'ใจดี', 'มีสุข', 'สมบัติ', 'ศรีทอง', 'มั่งมี', 'วงศ์สวัสดิ์', 'เจริญสุข', 'พงษ์ศิริ', 'รุ่งโรจน์', 'คำสอน',
  'ชูเกียรติ', 'แซ่ลิ้ม', 'พงษ์พาณิชย์', 'แก้วมณี', 'มีลาภ', 'ทองแท้', 'สุขสำราญ', 'พลรบ', 'เจริญดี', 'มั่นคง',
  'บูรพา', 'วรรณศรี', 'โสภา', 'ชัยชนะ', 'สิทธิโชค', 'ธนโชค', 'สถิตมั่น', 'รักษ์ดี', 'เพิ่มพูน', 'ศรีสวัสดิ์'
];

const CHRONIC_LISTS = [
  'เบาหวาน',
  'ความดันโลหิตสูง',
  'เบาหวาน,ความดันโลหิตสูง',
  'ไขมันในเลือดสูง,ความดันโลหิตสูง',
  'โรคไตเรื้อรัง (CKD)',
  'หลอดเลือดสมอง (Stroke)'
];

async function executeSql(sql) {
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
  return res.json();
}

async function insertOrUpdatePerson(person) {
  try {
    const postRes = await fetch(`${BMS_URL}/api/rest/person`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${JWT}`
      },
      body: JSON.stringify({
        ...person,
        'marketplace-token': MKT_TOKEN
      })
    });
    if (postRes.status === 201 || postRes.status === 200) return true;

    // If already exists, fallback to PUT
    const putRes = await fetch(`${BMS_URL}/api/rest/person/${person.person_id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${JWT}`
      },
      body: JSON.stringify({
        ...person,
        'marketplace-token': MKT_TOKEN
      })
    });
    return putRes.ok;
  } catch (e) {
    return false;
  }
}

async function main() {
  console.log('🚀 เริ่มต้นการซิงค์ข้อมูล person ให้เป็นคนเดียวกับ patient (2,039 คน)...');

  // 1. Fetch houses
  console.log('1. ดึงข้อมูลตาราง house...');
  const houseRes = await executeSql('SELECT house_id, village_id, address, road FROM house ORDER BY house_id ASC');
  const houses = houseRes.data || [];
  console.log(`✅ พบข้อมูลบ้านใน HOSxP ทั้งหมด ${houses.length} หลัง`);

  // 2. Fetch existing patient records
  console.log('2. ดึงข้อมูลตาราง patient...');
  const patientRes = await executeSql('SELECT hn, cid, pname, fname, lname, birthday, sex, addrpart, moopart FROM patient');
  const existingPatients = (patientRes.data || []).filter(p => p.pname && p.fname);
  console.log(`✅ พบผู้ป่วยเดิมในตาราง patient: ${existingPatients.length} คน`);

  // 3. Prepare 2,039 person records aligned with patient
  const TOTAL_TARGET = 2039;
  const personRecords = [];

  for (let i = 0; i < TOTAL_TARGET; i++) {
    const personId = i + 1;
    let house;
    let houseRegistTypeId = 1; // 1 = เจ้าบ้าน

    if (i < 2000) {
      house = houses[i] || { house_id: i + 1, village_id: 1, address: String(i + 1) };
      houseRegistTypeId = 1;
    } else {
      const houseIdx = i - 2000;
      house = houses[houseIdx] || { house_id: houseIdx + 1, village_id: 1, address: String(houseIdx + 1) };
      houseRegistTypeId = 2; // ผู้อาศัย
    }

    let hn, cid, pname, fname, lname, birthdate, sex;

    // Use existing patient data if available (first 252)
    if (i < existingPatients.length) {
      const ep = existingPatients[i];
      hn = ep.hn;
      cid = ep.cid || `16501${String(personId).padStart(8, '0')}`;
      pname = ep.pname;
      fname = ep.fname;
      lname = ep.lname || SURNAMES[personId % SURNAMES.length];
      birthdate = ep.birthday || '1980-01-01';
      sex = ep.sex || '1';
    } else {
      // Generate realistic matching patient/person
      const isMale = (personId % 2 === 1);
      fname = isMale ? MALE_NAMES[personId % MALE_NAMES.length] : FEMALE_NAMES[personId % FEMALE_NAMES.length];
      lname = SURNAMES[(Number(house.house_id) * 3 + personId) % SURNAMES.length];
      
      const birthYear = 2026 - (18 + (personId % 68));
      const birthMonth = String((personId % 12) + 1).padStart(2, '0');
      const birthDay = String((personId % 28) + 1).padStart(2, '0');
      birthdate = `${birthYear}-${birthMonth}-${birthDay}`;
      const age = 2026 - birthYear;

      pname = isMale ? (age < 15 ? 'ด.ช.' : 'นาย') : (age < 15 ? 'ด.ญ.' : (age > 40 ? 'นาง' : 'นางสาว'));
      sex = isMale ? '1' : '2';
      hn = `00${String(personId).padStart(5, '0')}`;
      cid = `16501${String(personId).padStart(8, '0')}`;
    }

    // Health condition
    let chronicList = null;
    let senile = null;
    let deformed = null;
    if (personId % 5 === 0) {
      chronicList = CHRONIC_LISTS[personId % CHRONIC_LISTS.length];
    }
    if (personId % 20 === 0) {
      senile = 'Y';
    }
    if (personId % 70 === 0) {
      deformed = '1';
    }

    personRecords.push({
      person_id: personId,
      house_id: Number(house.house_id),
      village_id: Number(house.village_id || 1),
      cid,
      patient_hn: hn,
      patient_link: 'Y',
      pname,
      fname,
      lname,
      sex,
      birthdate,
      house_regist_type_id: houseRegistTypeId,
      chronic_disease_list: chronicList,
      senile,
      deformed_status: deformed
    });
  }

  console.log(`3. กำลังบันทึกลงตาราง person จำนวน ${personRecords.length} คน...`);
  const BATCH_SIZE = 25;
  let success = 0;
  let fail = 0;
  const start = Date.now();

  for (let i = 0; i < personRecords.length; i += BATCH_SIZE) {
    const chunk = personRecords.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(chunk.map(p => insertOrUpdatePerson(p)));
    results.forEach(ok => {
      if (ok) success++;
      else fail++;
    });

    const percent = Math.round(((i + chunk.length) / personRecords.length) * 100);
    process.stdout.write(`\r⏳ กำลังบันทึกข้อมูล person: ${Math.min(i + chunk.length, personRecords.length)}/${personRecords.length} (${percent}%) [สำเร็จ: ${success}, ผิดพลาด: ${fail}]`);
  }

  console.log(`\n\n🎉 บันทึกข้อมูลตาราง person เสร็จสิ้นใน ${((Date.now() - start) / 1000).toFixed(1)} วินาที`);
  console.log(`✅ สำเร็จ: ${success} รายการ, ผิดพลาด: ${fail} รายการ`);

  // Verification
  console.log('\n🔍 ตรวจสอบยอดรวมจากตาราง person ในฐานข้อมูล HOSxP...');
  const countCheck = await executeSql('SELECT COUNT(*) as total_person, COUNT(DISTINCT house_id) as houses_with_residents FROM person');
  console.log('📊 สถิติตาราง person ล่าสุด:', countCheck.data?.[0]);

  const sampleCheck = await executeSql(`
    SELECT p.person_id, p.pname, p.fname, p.lname, p.patient_hn, p.house_regist_type_id, h.address, v.village_name
    FROM person p
    INNER JOIN house h ON p.house_id = h.house_id
    INNER JOIN village v ON p.village_id = v.village_id
    ORDER BY p.person_id ASC
    LIMIT 5
  `);
  console.log('\n📋 ตัวอย่าง 5 แถวแรก:');
  console.table(sampleCheck.data);
}

main().catch(console.error);
