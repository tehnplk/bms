-- ============================================================================
-- HOSxP Database Seed Script: Update House & Village Coordinates (GIS)
-- สคริปต์สุ่มและปรับปรุงพิกัดละติจูด-ลองจิจูด (WGS84) สำหรับตาราง house และ village
-- ============================================================================

-- 1. ตรวจสอบและตั้งค่าพิกัดเริ่มต้นให้ตาราง village (จังหวัดพิษณุโลก)
UPDATE village 
SET 
  latitude = CAST(16.821100 + ((village_moo % 5 - 2) * 0.0115) AS DECIMAL(10, 6)),
  longitude = CAST(100.265900 + ((FLOOR(village_moo / 5) - 1) * 0.0125) AS DECIMAL(10, 6))
WHERE village_moo > 0;

-- 2. อัปเดตพิกัดบ้านทุกหลังในตาราง house ในจังหวัดพิษณุโลก โดยกระจายตัวรอบศูนย์กลางหมู่บ้าน
UPDATE house h
LEFT JOIN village v ON h.village_id = v.village_id
SET 
  h.latitude = CAST(
    COALESCE(
      NULLIF(v.latitude, ''), 
      16.821100 + ((COALESCE(v.village_moo, MOD(h.village_id, 10)) % 5 - 2) * 0.0115)
    ) 
    + ((MOD(h.house_id, 23) - 11) * 0.00035) 
    + ((RAND() - 0.5) * 0.00020)
    AS DECIMAL(10, 6)
  ),
  h.longitude = CAST(
    COALESCE(
      NULLIF(v.longitude, ''), 
      100.265900 + ((FLOOR(COALESCE(v.village_moo, MOD(h.village_id, 10)) / 5) - 1) * 0.0125)
    ) 
    + ((MOD(h.house_id, 19) - 9) * 0.00035) 
    + ((RAND() - 0.5) * 0.00020)
    AS DECIMAL(10, 6)
  ),
  h.last_update = NOW()
WHERE h.village_id > 0;

-- 3. ตรวจสอบผลลัพธ์หลังการอัปเดต
SELECT 
    v.village_moo AS 'หมู่ที่',
    v.village_name AS 'ชื่อหมู่บ้าน',
    COUNT(h.house_id) AS 'จำนวนบ้านทั้งหมด',
    SUM(CASE WHEN h.latitude IS NOT NULL AND h.latitude != '' AND h.latitude != '0' THEN 1 ELSE 0 END) AS 'จำนวนบ้านที่มีพิกัดแล้ว',
    SUM(CASE WHEN h.latitude IS NULL OR h.latitude = '' OR h.latitude = '0' THEN 1 ELSE 0 END) AS 'ยังไม่มีพิกัด',
    CONCAT(ROUND((SUM(CASE WHEN h.latitude IS NOT NULL AND h.latitude != '' AND h.latitude != '0' THEN 1 ELSE 0 END) / COUNT(h.house_id)) * 100, 1), '%') AS 'ร้อยละความครอบคลุม'
FROM house h
LEFT JOIN village v ON h.village_id = v.village_id
WHERE v.village_moo > 0
GROUP BY v.village_moo, v.village_name
ORDER BY v.village_moo ASC;
