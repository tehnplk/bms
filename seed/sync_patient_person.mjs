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

async function insertPatient(patient) {
  const res = await fetch(`${BMS_URL}/api/rest/patient`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${JWT}`
    },
    body: JSON.stringify({
      ...patient,
      'marketplace-token': MKT_TOKEN
    })
  });
  if (res.status === 201 || res.status === 200) return true;
  // If already exists, update
  const putRes = await fetch(`${BMS_URL}/api/rest/patient/${encodeURIComponent(patient.hn)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${JWT}`
    },
    body: JSON.stringify({
      ...patient,
      'marketplace-token': MKT_TOKEN
    })
  });
  return putRes.ok;
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
  if (res.status === 201 || res.status === 200) return true;
  // If already exists, update
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
}

async function main() {
  console.log('🏥 เริ่มต้นเชื่อมโยงและสร้างข้อมูล person ตรงกับ patient จำนวน 2,039 คน...');

  // 1. Fetch houses
  console.log('1. ดึงข้อมูลตาราง house...');
  const houseRes = await executeSql('SELECT house_id, village_id, address, road FROM house ORDER BY house_id ASC');
  const houses = houseRes.data || [];
  console.log(`✅ พบข้อมูลบ้าน ${houses.length} หลัง`);

  // 2. Fetch existing patients
  console.log('2. ดึงข้อมูลตาราง patient ที่มีอยู่เดิม...');
  const patientRes = await executeSql('SELECT hn, cid, pname, fname, lname, birthday, sex, addrpart, moopart FROM patient');
  const existingPatients = patientRes.data || [];
  console.log(`✅ พบผู้ป่วยเดิมในตาราง patient: ${existingPatients.length} คน`);

  const TOTAL_COUNT = 2039;
  const personList = [];
  const patientList = [];

  for (let i = 0; i < TOTAL_COUNT; i++) {
    const personId = i + 1;
    let house;
    let houseRegistTypeId = 1; // 1 = เจ้าบ้าน

    if (i < 2000) {
      // 1 เจ้าบ้าน ต่อ 1 หลัง (สำหรับบ้าน 1-2000)
      house = houses[i] || { house_id: i + 1, village_id: 1, address: String(i + 1) };
      houseRegistTypeId = 1;
    } else {
      // สมาชิกเพิ่มเติม 39 คน อยู่ในบ้าน 1..39
      const houseIndex = (i - 2000);
      house = houses[houseIndex] || { house_id: houseIndex + 1, village_id: 1, address: String(houseIndex + 1) };
      houseRegistTypeId = 2; // ผู้อาศัย
    }

    // Check if we can reuse an existing patient record
    let hn, cid, pname, fname, lname, birthdate, sex;
    if (i < existingPatients.length && existingPatients[i].pname && existingPatients[i].fname) {
      const ep = existingPatients[i];
      hn = ep.hn;
      cid = ep.cid || `16501${String(personId).padStart(8, '0')}`;
      pname = ep.pname || 'นาย';
      fname = ep.fname || `สมชาย`;
      lname = ep.lname || `ใจดี`;
      birthdate = ep.birthday || '1980-01-01';
      sex = ep.sex || '1';
    } else {
      // Generate realistic Thai patient and person
      const isMale = (personId % 2 === 1);
      fname = isMale ? MALE_NAMES[personId % MALE_NAMES.length] : FEMALE_NAMES[personId % FEMALE_NAMES.length];
      lname = SURNAMES[(Number(house.house_id) * 3 + personId) % SURNAMES.length];
      
      const birthYear = 2026 - (20 + (personId % 65));
      const birthMonth = String((personId % 12) + 1).padStart(2, '0');
      const birthDay = String((personId % 28) + 1).padStart(2, '0');
      birthdate = `${birthYear}-${birthMonth}-${birthDay}`;
      const age = 2026 - birthYear;

      pname = isMale ? (age < 15 ? 'ด.ช.' : 'นาย') : (age < 15 ? 'ด.ญ.' : (age > 40 ? 'นาง' : 'นางสาว'));
      sex = isMale ? '1' : '2';
      hn = `00${String(personId).padStart(5, '0')}`;
      cid = `16501${String(personId).padStart(8, '0')}`;

      patientList.push({
        hn,
        cid,
        pname,
        fname,
        lname,
        birthday: birthdate,
        sex,
        addrpart: house.address || String(house.house_id),
        moopart: String(house.village_id || 1).padStart(2, '0')
      });
    }

    // Health condition
    let chronicList = null;
    let senile = null;
    let deformed = null;
    if (personId % 6 === 0) {
      chronicList = CHRONIC_LISTS[personId % CHRONIC_LISTS.length];
    }
    if (personId % 25 === 0) {
      senile = 'Y';
    }
    if (personId % 80 === 0) {
      deformed = '1';
    }

    personList.push({
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

  // 3. Batch insert new patients if needed
  if (patientList.length > 0) {
    console.log(`3. กำลังบันทึกตาราง patient เพิ่มเติม (${patientList.length} คน)...`);
    const BATCH_SIZE = 40;
    for (let i = 0; i < patientList.length; i += BATCH_SIZE) {
      const batch = patientList.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(p => insertPatient(p)));
      process.stdout.write(`\r⏳ กำลังซิงค์ตาราง patient: ${Math.min(i + BATCH_SIZE, patientList.length)}/${patientList.length}`);
    }
    console.log('\n✅ ซิงค์ตาราง patient ครบถ้วน!');
  }

  // 4. Batch insert person (2,039 records)
  console.log(`4. กำลังบันทึกตาราง person (${personList.length} คน)...`);
  const BATCH_SIZE = 40;
  let successCount = 0;
  let failCount = 0;
  const startTime = Date.now();

  for (let i = 0; i < personList.length; i += BATCH_SIZE) {
    const batch = personList.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map(p => insertPerson(p)));
    results.forEach(ok => {
      if (ok) successCount++;
      else failCount++;
    });
    process.stdout.write(`\r⏳ กำลังบันทึกตาราง person: ${Math.min(i + BATCH_SIZE, personList.length)}/${personList.length} [สำเร็จ: ${successCount}, ผิดพลาด: ${failCount}]`);
  }

  console.log(`\n\n🎉 บันทึกตาราง person เสร็จสมบูรณ์ใน ${((Date.now() - startTime) / 1000).toFixed(1)} วินาที!`);
  console.log(`✅ สำเร็จ: ${successCount} รายการ, ผิดพลาด: ${failCount} รายการ`);

  // 5. Final Verification
  console.log('\n🔍 ตรวจสอบความถูกต้องระหว่าง person และ patient...');
  const verifyRes = await executeSql(`
    SELECT 
      COUNT(*) as total_person,
      COUNT(DISTINCT p.house_id) as mapped_houses,
      COUNT(pt.hn) as linked_patients
    FROM person p
    LEFT JOIN patient pt ON p.patient_hn = pt.hn
  `);
  console.log('📊 สถิติตาราง person ในฐานข้อมูล:', verifyRes.data?.[0]);

  const sampleRes = await executeSql(`
    SELECT 
      p.person_id,
      p.patient_hn,
      CONCAT(p.pname, p.fname, ' ', p.lname) as person_name,
      CONCAT(pt.pname, pt.fname, ' ', pt.lname) as patient_name,
      h.address as house_address,
      v.village_name
    FROM person p
    INNER JOIN patient pt ON p.patient_hn = pt.hn
    INNER JOIN house h ON p.house_id = h.house_id
    INNER JOIN village v ON p.village_id = v.village_id
    LIMIT 5
  `);
  console.log('\n📋 ตัวอย่างการเชื่อมโยง person ➔ patient (5 รายการแรก):');
  console.table(sampleRes.data);
}

main().catch(console.error);
