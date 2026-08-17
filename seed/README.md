# 📍 HOSxP GIS Coordinate Seed Scripts

โฟลเดอร์นี้ประกอบด้วยสคริปต์สำหรับ Mockup / Seed ข้อมูลพิกัดละติจูดและลองจิจูด (`latitude`, `longitude`, `location_latitude`, `location_longitude`) ให้กับตาราง `house` และ `village` ในฐานข้อมูลจริงของ HOSxP

---

## 📁 รายการไฟล์ในโฟลเดอร์ `/seed`

| ไฟล์ | คำอธิบาย |
| :--- | :--- |
| [`seed_house_coordinates.sql`](file:///c:/Users/Admin/Desktop/bms/seed/seed_house_coordinates.sql) | ไฟล์คำสั่ง SQL สำหรับรันในโปรแกรมจัดการฐานข้อมูล (Navicat / DBeaver / HOSxP Query) |
| [`seed_bms_api.mjs`](file:///c:/Users/Admin/Desktop/bms/seed/seed_bms_api.mjs) | สคริปต์ Node.js สำหรับยิงอัปเดตผ่าน **BMS Session API (`/api/sql`)** |

---

## 🚀 วิธีการใช้งาน

### วิธีที่ 1: รันคำสั่ง SQL ผ่าน Database Client (แนะนำ & เร็วที่สุด)
เปิดไฟล์ [`seed/seed_house_coordinates.sql`](file:///c:/Users/Admin/Desktop/bms/seed/seed_house_coordinates.sql) แล้วรันในฐานข้อมูล HOSxP (MySQL / MariaDB / PostgreSQL):

```sql
-- อัปเดตพิกัดบ้านทุกหลังโดยกระจายตัวตามหมู่บ้าน
UPDATE house h
LEFT JOIN village v ON h.village_id = v.village_id
SET 
  h.latitude = CAST(
    COALESCE(NULLIF(v.latitude, ''), 14.975000 + (COALESCE(v.village_moo, 1) * 0.0060)) 
    + ((MOD(h.house_id, 17) - 8) * 0.00042) 
    + ((RAND() - 0.5) * 0.00025)
    AS DECIMAL(10, 6)
  ),
  h.longitude = CAST(
    COALESCE(NULLIF(v.longitude, ''), 102.081000 + (COALESCE(v.village_moo, 1) * 0.0060)) 
    + ((MOD(h.house_id, 13) - 6) * 0.00042) 
    + ((RAND() - 0.5) * 0.00025)
    AS DECIMAL(10, 6)
  ),
  h.location_latitude = h.latitude,
  h.location_longitude = h.longitude,
  h.last_update = NOW()
WHERE h.village_id > 0;
```

---

### วิธีที่ 2: รันผ่าน BMS Session API (Node.js)

ใช้สำหรับเซิร์ฟเวอร์หรือสถานีงานที่ต้องการยิงคำสั่งผ่าน BMS Session Tunnel โดยไม่ต้องเปิดพอร์ตฐานข้อมูลโดยตรง:

```bash
# รันผ่าน bms-session-id และ marketplace-token
node seed/seed_bms_api.mjs --session=<BMS_SESSION_GUID> --token=<MARKETPLACE_TOKEN>
```

หรือระบุ BMS URL ตรง:
```bash
node seed/seed_bms_api.mjs --url=https://your-hosp.bmscloud.in.th --jwt=<JWT_TOKEN> --token=<MARKETPLACE_TOKEN>
```
