'use client';

import React, { useEffect, useState } from 'react';
import { MapPin, Search, Trash2, UserPlus, Users } from 'lucide-react';
import { dataService, SearchResultItem } from '@/lib/services/dataService';
import { AddonContext } from '@/lib/types/bms';
import { GROUP_MEMBER_KIND, GroupList, GroupMember } from '@/lib/types/gis';
import MapPickerModal from './MapPickerModal';

export interface GroupMembersModalProps {
  ctx: AddonContext;
  list: GroupList;
  onChange: (members: GroupMember[]) => void;
  onClose: () => void;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function GroupMembersModal({ ctx, list, onChange, onClose }: GroupMembersModalProps) {
  const isEpidemic = list.group === 'epidemic';
  const isPlaceGroup = GROUP_MEMBER_KIND[list.group] === 'place';

  // Place members: name + a coordinate picked on the map
  const [placeName, setPlaceName] = useState('');
  const [placeNote, setPlaceNote] = useState('');
  const [placeCoord, setPlaceCoord] = useState<{ lat: number; lng: number } | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [picked, setPicked] = useState<SearchResultItem | null>(null);
  const [treatmentStartDate, setTreatmentStartDate] = useState(todayISO());

  // Only people can be enrolled, so house-only matches are dropped
  useEffect(() => {
    const q = query.trim();
    if (!q || picked) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    setIsSearching(true);
    const timer = setTimeout(async () => {
      const found = await dataService.searchRemote(ctx, q);
      if (cancelled) return;
      setResults(found.filter((r) => r.matchedResident).slice(0, 8));
      setIsSearching(false);
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, picked, ctx]);

  const addPlace = () => {
    const name = placeName.trim();
    if (!name || !placeCoord) return;
    onChange([
      ...list.members,
      {
        place_id: `place-${Date.now()}`,
        place_name: name,
        latitude: placeCoord.lat,
        longitude: placeCoord.lng,
        note: placeNote.trim() || undefined
      }
    ]);
    setPlaceName('');
    setPlaceNote('');
    setPlaceCoord(null);
  };

  const addMember = () => {
    if (!picked?.matchedResident) return;
    const r = picked.matchedResident;

    const duplicate = list.members.some((m) => m.person_id === r.person_id);
    if (!duplicate) {
      const member: GroupMember = {
        person_id: r.person_id,
        house_id: picked.house.house_id,
        person_name: `${r.pname}${r.fname} ${r.lname}`.trim(),
        hn: r.hn,
        house_address: picked.house.address,
        village_moo: picked.house.village_moo,
        ...(isEpidemic ? { treatment_start_date: treatmentStartDate } : {})
      };
      onChange([...list.members, member]);
    }

    setPicked(null);
    setQuery('');
    setTreatmentStartDate(todayISO());
  };

  return (
    <div
      className="modal-backdrop animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-content modal-content-lg animate-scale-up" role="dialog" aria-modal="true">
        <div className="modal-header">
          <div className="modal-title-row">
            <span className="house-badge-icon">
              <Users size={22} />
            </span>
            <div>
              <div className="modal-house-title">{list.name}</div>
              <div className="modal-house-subtitle">
                {isPlaceGroup ? `${list.members.length} จุด` : `สมาชิก ${list.members.length} คน`} · สร้างเมื่อ {list.created_date}
                {list.activeOnMap ? ' · ใช้งานบนแผนที่' : ' · ปิดการใช้งานบนแผนที่'}
              </div>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="ปิด">&times;</button>
        </div>

        <div className="modal-body">
          {/* Add member */}
          <div className="modal-section-card">
            <div className="section-card-header">
              <span className="section-title">
                {isPlaceGroup ? <MapPin size={16} /> : <UserPlus size={16} />}
                {isPlaceGroup ? 'เพิ่มจุดบนแผนที่' : 'เพิ่มสมาชิก'}
              </span>
            </div>

            {isPlaceGroup ? (
              <>
                <div className="setting-field" style={{ marginTop: 0 }}>
                  <label className="setting-field-label" htmlFor="place-name">ชื่อจุด</label>
                  <input
                    id="place-name"
                    type="text"
                    className="setting-input"
                    placeholder={list.group === 'partner' ? 'เช่น วัดหนองหอย, รร.บ้านหนองหอย' : 'เช่น รพ.สต.หนองหอย, จุดวางถังออกซิเจน'}
                    value={placeName}
                    onChange={(e) => setPlaceName(e.target.value)}
                  />
                </div>

                <div className="setting-field">
                  <label className="setting-field-label" htmlFor="place-note">หมายเหตุ (ไม่บังคับ)</label>
                  <input
                    id="place-note"
                    type="text"
                    className="setting-input"
                    placeholder="เช่น ผู้ประสานงาน เบอร์ติดต่อ เวลาทำการ"
                    value={placeNote}
                    onChange={(e) => setPlaceNote(e.target.value)}
                  />
                </div>

                <div className="setting-field">
                  <label className="setting-field-label">พิกัด</label>
                  <div className="setting-name-row">
                    <input
                      type="text"
                      className="setting-input font-mono"
                      readOnly
                      value={placeCoord ? `${placeCoord.lat.toFixed(6)}, ${placeCoord.lng.toFixed(6)}` : 'ยังไม่ได้ปักหมุด'}
                    />
                    <button type="button" className="setting-grid-btn" onClick={() => setIsPickerOpen(true)}>
                      <MapPin size={13} />
                      ปักหมุด
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  className="setting-register-btn"
                  disabled={!placeName.trim() || !placeCoord}
                  onClick={addPlace}
                >
                  <MapPin size={15} />
                  เพิ่มจุดเข้ารายการ
                </button>
              </>
            ) : (
            <div className="setting-field" style={{ marginTop: 0 }}>
              <label className="setting-field-label">ค้นชื่อผู้ป่วย หรือ HN</label>
              {picked?.matchedResident ? (
                <div className="setting-picked">
                  <span>
                    <strong>
                      {picked.matchedResident.pname}{picked.matchedResident.fname} {picked.matchedResident.lname}
                    </strong>
                    {picked.matchedResident.hn && (
                      <span className="result-hn-tag">HN: {picked.matchedResident.hn}</span>
                    )}
                    <span className="setting-picked-meta">
                      บ้านเลขที่ {picked.house.address} · หมู่ {picked.house.village_moo}
                    </span>
                  </span>
                  <button type="button" onClick={() => setPicked(null)}>เปลี่ยน</button>
                </div>
              ) : (
                <>
                  <div className="setting-search-wrap">
                    <Search size={15} className="setting-search-icon" />
                    <input
                      type="text"
                      className="setting-input"
                      placeholder="ชื่อ นามสกุล หรือ HN"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                  {query.trim() !== '' && (
                    <div className="setting-person-results">
                      {isSearching && <div className="setting-person-empty">กำลังค้นหา...</div>}
                      {!isSearching && results.length === 0 && (
                        <div className="setting-person-empty">ไม่พบผู้ป่วยที่ตรงกับคำค้น</div>
                      )}
                      {results.map((item) => (
                        <button
                          key={item.matchedResident!.person_id}
                          type="button"
                          className="setting-person-item"
                          onClick={() => { setPicked(item); setResults([]); }}
                        >
                          <span className="setting-person-name">
                            {item.matchedResident!.pname}{item.matchedResident!.fname} {item.matchedResident!.lname}
                          </span>
                          <span className="setting-person-meta">
                            บ้านเลขที่ {item.house.address} · หมู่ {item.house.village_moo} {item.house.village_name}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
            )}

            {isEpidemic && (
              <div className="setting-field">
                <label className="setting-field-label" htmlFor="member-date">วันเริ่มรักษา</label>
                <input
                  id="member-date"
                  type="date"
                  className="setting-input"
                  value={treatmentStartDate}
                  onChange={(e) => setTreatmentStartDate(e.target.value)}
                />
              </div>
            )}

            {!isPlaceGroup && (
              <button
                type="button"
                className="setting-register-btn"
                disabled={!picked}
                onClick={addMember}
              >
                <UserPlus size={15} />
                เพิ่มเข้ารายการ
              </button>
            )}
          </div>

          {/* Member list */}
          <div className="modal-section-card">
            <div className="section-card-header">
              <span className="section-title">
                <Users size={16} />
                {isPlaceGroup
                  ? `จุดในรายการ (${list.members.length} จุด)`
                  : `รายชื่อสมาชิก (${list.members.length} คน)`}
              </span>
            </div>

            {list.members.length === 0 ? (
              <div className="setting-person-empty">
                {isPlaceGroup ? 'ยังไม่มีจุดในรายการนี้' : 'ยังไม่มีสมาชิกในรายการนี้'}
              </div>
            ) : (
              <div className="residents-table-wrapper">
                <table className="residents-table">
                  <thead>
                    <tr>
                      <th style={{ width: 50 }}>ลำดับ</th>
                      <th>{isPlaceGroup ? 'ชื่อจุด' : 'ชื่อ - สกุล'}</th>
                      {isPlaceGroup ? <th>พิกัด</th> : <th>HN</th>}
                      {isPlaceGroup ? <th>หมายเหตุ</th> : <th>บ้านเลขที่</th>}
                      {isEpidemic && <th>วันเริ่มรักษา</th>}
                      <th style={{ width: 50 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.members.map((m, i) => (
                      <tr key={m.place_id ?? m.person_id ?? i}>
                        <td className="font-mono">{i + 1}</td>
                        <td><strong>{isPlaceGroup ? m.place_name : m.person_name}</strong></td>
                        {isPlaceGroup ? (
                          <td className="font-mono">
                            {m.latitude?.toFixed(6)}, {m.longitude?.toFixed(6)}
                          </td>
                        ) : (
                          <td className="font-mono">{m.hn || '-'}</td>
                        )}
                        {isPlaceGroup ? (
                          <td>{m.note || '-'}</td>
                        ) : (
                          <td>{m.house_address} · ม.{m.village_moo}</td>
                        )}
                        {isEpidemic && <td className="font-mono">{m.treatment_start_date || '-'}</td>}
                        <td>
                          <button
                            type="button"
                            className="setting-grid-btn danger"
                            aria-label="ลบสมาชิก"
                            onClick={() => onChange(list.members.filter((_, idx) => idx !== i))}
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {isPickerOpen && (
        <MapPickerModal
          title={`ปักหมุด${placeName.trim() ? `: ${placeName.trim()}` : ''}`}
          subtitle={`${list.name} • ลากหมุดสีแดงไปยังตำแหน่งจริง`}
          initialLat={placeCoord?.lat ?? null}
          initialLng={placeCoord?.lng ?? null}
          onConfirm={(lat, lng) => { setPlaceCoord({ lat, lng }); setIsPickerOpen(false); }}
          onClose={() => setIsPickerOpen(false)}
        />
      )}
    </div>
  );
}
