const BMS_URL = 'http://127.0.0.1:45011';
const JWT = '3769D0BA-21B7-4C8A-9D3E-8FED11698E5D';
const MKT_TOKEN = '1E2ABE52-4B23-4071-A7E6-FE353D3EFF1C';
const APP_ID = 'bms-hosxp-catchment-gis';

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
  'บูรพา', 'วรรณศรี', 'โสภา', 'ชัยชนะ', 'สิทธิโชค', 'ธนโชค', 'สถิตมั่น', 'รักษ์ดี', 'เพิ่มพูน', 'ศรีสวัสดิ์',
  'พงษ์ไทย', 'วัฒนา', 'มงคล', 'สิริวัฒน์', 'โชคประเสริฐ', 'รัตนกุล', 'นราธิป', 'มงคลชัย', 'ศรีมงคล', 'บำรุงสุข'
];

const CHRONIC_LISTS = [
  'เบาหวาน',
  'ความดันโลหิตสูง',
  'เบาหวาน,ความดันโลหิตสูง',
  'ไขมันในเลือดสูง,ความดันโลหิตสูง',
  'โรคไตเรื้อรัง (CKD)',
  'หลอดเลือดสมอง (Stroke)',
  'โรคหัวใจและหลอดเลือด',
  'โรคหืด/ถุงลมโป่งพอง (COPD)'
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

async function insertPerson(person) {
  const res = await fetch(`${BMS_URL}/api/rest/person`, {
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
  return res.ok;
}

async function main() {
  console.log('🚀 เริ่มต้นการ Seed ข้อมูลตาราง person จำนวน 2,039 คน...');

  // 1. Fetch houses
  console.log('📦 กำลังดึงข้อมูลตาราง house...');
  const houseRes = await executeSql('SELECT house_id, village_id, address, road FROM house ORDER BY house_id ASC');
  const houses = houseRes.data || [];
  console.log(`✅ ดึงข้อมูลบ้านสำเร็จ: ${houses.length} หลัง`);

  if (houses.length === 0) {
    console.error('❌ ไม่พบบ้านในตาราง house');
    return;
  }

  // 2. Prepare 2,039 person records
  console.log('📝 กำลังสร้างข้อมูลประชากร 2,039 รายการ...');
  const personRecords = [];
  const TOTAL_TARGET = 2039;

  // 2.1 First 2,000 are Head of Household (เจ้าบ้าน, house_regist_type_id = 1) for each house
  for (let i = 0; i < houses.length && personRecords.length < 2000; i++) {
    const h = houses[i];
    const personId = i + 1;
    const isMale = (personId % 2 === 1);
    const fname = isMale ? MALE_NAMES[personId % MALE_NAMES.length] : FEMALE_NAMES[personId % FEMALE_NAMES.length];
    const lname = SURNAMES[(personId * 3) % SURNAMES.length];
    
    // Age between 25 and 85
    const birthYear = 2026 - (25 + (personId % 61));
    const birthMonth = String((personId % 12) + 1).padStart(2, '0');
    const birthDay = String((personId % 28) + 1).padStart(2, '0');
    const birthdate = `${birthYear}-${birthMonth}-${birthDay}`;
    const age = 2026 - birthYear;

    let pname = isMale ? 'นาย' : (age > 45 ? 'นาง' : 'นางสาว');
    
    // Chronic conditions for ~18% of population
    let chronicList = null;
    let ncdDm = null;
    let ncdHt = null;
    if (personId % 5 === 0) {
      chronicList = CHRONIC_LISTS[personId % CHRONIC_LISTS.length];
      if (chronicList.includes('เบาหวาน')) ncdDm = 1;
      if (chronicList.includes('ความดัน')) ncdHt = 1;
    }

    // Vulnerable / elderly for ~7%
    let senile = null;
    let deformed = null;
    if (age >= 75 && personId % 4 === 0) {
      senile = 'Y';
    }
    if (personId % 37 === 0) {
      deformed = '1'; // พิการ / ติดเตียง
    }

    const cid = `16501${String(personId).padStart(8, '0')}`;
    const hn = `00${String(personId).padStart(5, '0')}`;

    personRecords.push({
      person_id: personId,
      house_id: Number(h.house_id),
      village_id: Number(h.village_id || 1),
      cid,
      patient_hn: hn,
      pname,
      fname,
      lname,
      sex: isMale ? '1' : '2',
      birthdate,
      house_regist_type_id: 1, // เจ้าบ้าน
      chronic_disease_list: chronicList,
      senile,
      deformed_status: deformed,
      ncd_dm_history_type_id: ncdDm,
      ncd_ht_history_type_id: ncdHt
    });
  }

  // 2.2 Additional 39 residents (ผู้อาศัย, house_regist_type_id = 2) for houses 1..39
  for (let i = 0; i < 39; i++) {
    const h = houses[i];
    const personId = 2000 + (i + 1);
    const isMale = (personId % 2 === 0);
    const fname = isMale ? MALE_NAMES[(personId * 7) % MALE_NAMES.length] : FEMALE_NAMES[(personId * 7) % FEMALE_NAMES.length];
    const lname = SURNAMES[(Number(h.house_id) * 3) % SURNAMES.length]; // Same surname as head of house
    
    // Ages vary from infant/child to spouse/elderly
    let age = 0;
    let pname = '';
    if (i < 10) {
      // Infants & Children (< 15)
      age = (i % 12);
      pname = isMale ? 'ด.ช.' : 'ด.ญ.';
    } else if (i < 25) {
      // Spouse (25-45)
      age = 25 + (i % 20);
      pname = isMale ? 'นาย' : 'นาง';
    } else {
      // Elderly parent (65-88)
      age = 65 + (i % 24);
      pname = isMale ? 'นาย' : 'นาง';
    }

    const birthYear = 2026 - age;
    const birthMonth = String((i % 12) + 1).padStart(2, '0');
    const birthDay = String((i % 28) + 1).padStart(2, '0');
    const birthdate = `${birthYear}-${birthMonth}-${birthDay}`;

    const cid = `16501${String(personId).padStart(8, '0')}`;
    const hn = `00${String(personId).padStart(5, '0')}`;

    let chronicList = null;
    let senile = null;
    let deformed = null;
    if (age >= 60 && i % 2 === 0) {
      chronicList = 'ความดันโลหิตสูง,ไขมันในเลือดสูง';
    }
    if (age >= 75) senile = 'Y';
    if (i === 38) deformed = '1';

    personRecords.push({
      person_id: personId,
      house_id: Number(h.house_id),
      village_id: Number(h.village_id || 1),
      cid,
      patient_hn: hn,
      pname,
      fname,
      lname,
      sex: isMale ? '1' : '2',
      birthdate,
      house_regist_type_id: 2, // ผู้อาศัย
      chronic_disease_list: chronicList,
      senile,
      deformed_status: deformed
    });
  }

  console.log(`📊 จำนวนข้อมูลที่พร้อมบันทึก: ${personRecords.length} คน (ตรงตาม 2,039 คน)`);

  // 3. Batch Insert with concurrency limit
  const BATCH_SIZE = 35;
  let successCount = 0;
  let errorCount = 0;
  const startTime = Date.now();

  for (let i = 0; i < personRecords.length; i += BATCH_SIZE) {
    const batch = personRecords.slice(i, i + BATCH_SIZE);
    const promises = batch.map(p => insertPerson(p));
    const results = await Promise.all(promises);

    results.forEach(ok => {
      if (ok) successCount++;
      else errorCount++;
    });

    const percent = Math.round(((i + batch.length) / personRecords.length) * 100);
    process.stdout.write(`\r⏳ กำลังบันทึกข้อมูล: ${i + batch.length}/${personRecords.length} (${percent}%) [สำเร็จ: ${successCount}, ผิดพลาด: ${errorCount}]`);
  }

  console.log(`\n\n🎉 บันทึกข้อมูลประชากรลงตาราง person เสร็จสิ้นใน ${(Date.now() - startTime) / 1000}s!`);
  console.log(`✅ สำเร็จ: ${successCount} รายการ, ผิดพลาด: ${errorCount} รายการ`);

  // 4. Verify in DB
  console.log('\n🔍 ตรวจสอบยอดรวมจากตาราง person ในฐานข้อมูล...');
  const countCheck = await executeSql('SELECT COUNT(*) as total_person, COUNT(DISTINCT house_id) as total_houses_with_person FROM person');
  console.log('📊 ผลการตรวจสอบฐานข้อมูล:', countCheck.data?.[0]);

  const sampleCheck = await executeSql(`
    SELECT p.person_id, p.pname, p.fname, p.lname, p.patient_hn, p.house_regist_type_id, h.address, v.village_name
    FROM person p
    INNER JOIN house h ON p.house_id = h.house_id
    INNER JOIN village v ON p.village_id = v.village_id
    ORDER BY p.person_id ASC
    LIMIT 5
  `);
  console.log('📋 ตัวอย่างข้อมูล 5 แถวแรก:');
  console.table(sampleCheck.data);
}

main().catch(console.error);
