'use client';

import React, { useState, useEffect } from 'react';
import { House } from '@/lib/types/gis';
import MapPickerModal from './MapPickerModal';
import { 
  Home, 
  MapPin, 
  Navigation, 
  Save, 
  Calendar, 
  Phone, 
  AlertCircle, 
  CheckCircle,
  FileText,
  Users
} from 'lucide-react';

export interface HouseModalProps {
  house: House | null;
  onSaveCoordinate: (houseId: number, lat: number, lng: number) => Promise<void>;
  onNavigate: (lat: number, lng: number) => void;
  onClose: () => void;
}

export default function HouseModal({
  house,
  onSaveCoordinate,
  onNavigate,
  onClose
}: HouseModalProps) {
  const [latInput, setLatInput] = useState<string>('');
  const [lngInput, setLngInput] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  useEffect(() => {
    if (house) {
      setLatInput(house.latitude !== null ? house.latitude.toString() : '');
      setLngInput(house.longitude !== null ? house.longitude.toString() : '');
    }
  }, [house]);

  if (!house) return null;

  const hasCoords = house.latitude !== null && house.longitude !== null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const lat = parseFloat(latInput);
    const lng = parseFloat(lngInput);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      alert('กรุณาระบุพิกัด Latitude (-90 ถึง 90) และ Longitude (-180 ถึง 180) ให้ถูกต้อง');
      return;
    }

    setIsSaving(true);
    try {
      await onSaveCoordinate(house.house_id, lat, lng);
    } finally {
      setIsSaving(false);
    }
  };

  const getHealthBadge = () => {
    if (house.has_vulnerable) {
      return <span className="health-tag tag-vulnerable">กลุ่มติดตามต่อเนื่อง</span>;
    }
    if (house.has_chronic) {
      return <span className="health-tag tag-chronic">ผู้ป่วยโรคเรื้อรัง NCD</span>;
    }
    if (house.has_mch) {
      return <span className="health-tag tag-mch">หญิงตั้งครรภ์/ทารก</span>;
    }
    if (hasCoords) {
      return <span className="health-tag tag-normal">สุขภาพปกติ</span>;
    }
    return <span className="health-tag tag-unmapped">ยังไม่มีพิกัด</span>;
  };

  return (
    <div className="modal-backdrop animate-fade-in" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content modal-content-lg animate-scale-up" role="dialog" aria-modal="true">
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-row">
            <span className="house-badge-icon">
              <Home size={22} />
            </span>
            <div>
              <div className="modal-house-title">
                บ้านเลขที่ {house.address} {getHealthBadge()}
              </div>
              <div className="modal-house-subtitle">
                หมู่ {house.village_moo} {house.village_name} {house.road ? `(${house.road})` : ''} • รหัสบ้าน: {house.census_id || `H-${house.house_id}`}
              </div>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">&times;</button>
        </div>

        {/* Body */}
        <div className="modal-body">
          {/* Section 1: Coordinates Editor */}
          <div className="modal-section-card">
            <div className="section-card-header">
              <span className="section-title">
                <MapPin size={16} />
                พิกัดทางภูมิศาสตร์ (GPS Coordinates)
              </span>
              {hasCoords && (
                <button 
                  type="button" 
                  className="btn-link-nav" 
                  onClick={() => onNavigate(house.latitude!, house.longitude!)}
                >
                  <Navigation size={13} />
                  เปิด Google Maps
                </button>
              )}
            </div>

            <form onSubmit={handleSave} className="coord-edit-form">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="modal-lat-input">Latitude (ละติจูด)</label>
                  <input
                    type="number"
                    step="any"
                    id="modal-lat-input"
                    className="form-input font-mono"
                    placeholder="เช่น 14.975200"
                    value={latInput}
                    onChange={(e) => setLatInput(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="modal-lng-input">Longitude (ลองจิจูด)</label>
                  <input
                    type="number"
                    step="any"
                    id="modal-lng-input"
                    className="form-input font-mono"
                    placeholder="เช่น 102.081500"
                    value={lngInput}
                    onChange={(e) => setLngInput(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn-action btn-pin-pick"
                  onClick={() => setIsPickerOpen(true)}
                >
                  <MapPin size={15} />
                  เลือกตำแหน่งบนแผนที่
                </button>
                <button
                  type="submit"
                  className="btn-action btn-save-pin"
                  disabled={isSaving}
                >
                  <Save size={15} />
                  {isSaving ? 'กำลังบันทึก...' : 'บันทึกพิกัด (PUT REST)'}
                </button>
              </div>
            </form>
          </div>

          {/* Section 2: Residents List */}
          <div className="modal-section-card">
            <div className="section-card-header">
              <span className="section-title">
                <Users size={16} />
                รายชื่อสมาชิกในบ้าน ({house.residents.length} คน)
              </span>
              <span className="text-muted" style={{ fontSize: '0.78rem' }}>
                เจ้าบ้าน: <strong>{house.head_person_name || 'ไม่ระบุ'}</strong>
              </span>
            </div>

            {house.residents.length > 0 ? (
              <div className="residents-table-wrapper">
                <table className="residents-table">
                  <thead>
                    <tr>
                      <th>ชื่อ - สกุล</th>
                      <th>HN</th>
                      <th>อายุ</th>
                      <th>สถานะในบ้าน</th>
                      <th>สภาวะสุขภาพ/โรคประจำตัว</th>
                      <th>สิทธิการรักษา</th>
                    </tr>
                  </thead>
                  <tbody>
                    {house.residents.map((r) => {
                      const fullName = `${r.pname}${r.fname} ${r.lname}`;
                      const isHead = r.house_regist_type_id === 1;

                      return (
                        <tr key={r.person_id} className={isHead ? 'row-head' : ''}>
                          <td>
                            <div className="resident-name-cell">
                              <strong>{fullName}</strong>
                              {isHead && <span className="badge-head">เจ้าบ้าน</span>}
                            </div>
                          </td>
                          <td className="font-mono">{r.hn || '-'}</td>
                          <td>{r.age !== undefined ? `${r.age} ปี` : '-'}</td>
                          <td>{isHead ? 'เจ้าบ้าน' : 'ผู้อาศัย'}</td>
                          <td>
                            <div className="chronic-tags-list">
                              {r.chronic_diseases && r.chronic_diseases.length > 0 ? (
                                r.chronic_diseases.map((c, i) => (
                                  <span key={i} className="chronic-tag-item">{c}</span>
                                ))
                              ) : null}
                              {r.is_bedridden && <span className="chronic-tag-item tag-bedridden">ติดเตียง</span>}
                              {r.is_disabled && <span className="chronic-tag-item tag-disabled">ผู้พิการ</span>}
                              {r.is_pregnant && <span className="chronic-tag-item tag-pregnant">ตั้งครรภ์</span>}
                              {r.has_infant && <span className="chronic-tag-item tag-infant">ทารก &lt;1 ปี</span>}
                              {(!r.chronic_diseases || r.chronic_diseases.length === 0) &&
                               !r.is_bedridden && !r.is_disabled && !r.is_pregnant && !r.has_infant && (
                                <span className="text-muted" style={{ fontSize: '0.8rem' }}>ปกติ</span>
                              )}
                            </div>
                          </td>
                          <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            {r.pttype_name || 'บัตรทอง (UC)'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state-card">
                <FileText size={28} className="text-muted" />
                <p>ไม่พบข้อมูลสมาชิกในบ้าน (สามารถสำรวจข้อมูลเพิ่มเติมได้จากโปรแกรม HOSxP)</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {isPickerOpen && (
        <MapPickerModal
          title={`เลือกตำแหน่งบ้านเลขที่ ${house.address}`}
          subtitle={`หมู่ ${house.village_moo} ${house.village_name} • ลากหมุดสีแดงไปยังตำแหน่งบ้านจริง`}
          initialLat={house.latitude}
          initialLng={house.longitude}
          onConfirm={(lat, lng) => {
            // Fill the form, the user still confirms with บันทึกพิกัด
            setLatInput(lat.toFixed(6));
            setLngInput(lng.toFixed(6));
            setIsPickerOpen(false);
          }}
          onClose={() => setIsPickerOpen(false)}
        />
      )}
    </div>
  );
}
