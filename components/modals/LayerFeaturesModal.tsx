'use client';

import React, { useEffect, useState } from 'react';
import { Circle, MapPin, Pentagon, Search, Spline, Trash2, UserPlus, Users } from 'lucide-react';
import { dataService, SearchResultItem } from '@/lib/services/dataService';
import { AddonContext } from '@/lib/types/bms';
import {
  DEFAULT_LINE_WEIGHT,
  FeatureGeometry,
  LayerFeature,
  LayerSetting
} from '@/lib/types/gis';
import GeometryPickerModal, { GeometryPickerMode } from './GeometryPickerModal';
import MapPickerModal from './MapPickerModal';

export interface LayerFeaturesModalProps {
  ctx: AddonContext;
  layer: LayerSetting;
  onChange: (features: LayerFeature[]) => void;
  onClose: () => void;
}

type AddMethod = 'person' | 'point' | 'shape' | 'line';

const METHODS: Array<{ id: AddMethod; label: string; icon: React.ReactNode }> = [
  { id: 'person', label: 'ค้นหาบุคคล', icon: <UserPlus size={15} /> },
  { id: 'point', label: 'จุด', icon: <MapPin size={15} /> },
  { id: 'shape', label: 'พื้นที่', icon: <Pentagon size={15} /> },
  { id: 'line', label: 'เส้น', icon: <Spline size={15} /> }
];

const GEOMETRY_LABEL: Record<FeatureGeometry['type'], string> = {
  home: 'ตามบ้าน',
  point: 'จุด',
  circle: 'วงกลม',
  polygon: 'พื้นที่',
  line: 'เส้น'
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function describeGeometry(f: LayerFeature): string {
  const g = f.geometry;
  switch (g.type) {
    case 'home':
      return f.person?.house_address ? `บ้านเลขที่ ${f.person.house_address} · ม.${f.person.village_moo}` : 'พิกัดตามบ้าน';
    case 'point':
      return `${g.lat.toFixed(6)}, ${g.lng.toFixed(6)}`;
    case 'circle':
      return `รัศมี ${g.radius.toLocaleString()} ม.`;
    case 'polygon':
      return `${g.path.length} จุด`;
    case 'line':
      return `${g.path.length} จุด · หนา ${g.weight} px`;
  }
}

export default function LayerFeaturesModal({ ctx, layer, onChange, onClose }: LayerFeaturesModalProps) {
  const isEpidemic = layer.kind === 'epidemic';

  const [method, setMethod] = useState<AddMethod>('person');

  // Shared across every method
  const [name, setName] = useState('');
  const [attrKey, setAttrKey] = useState('');
  const [attrValue, setAttrValue] = useState('');

  // 1. person search
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [picked, setPicked] = useState<SearchResultItem | null>(null);
  const [useHomeCoord, setUseHomeCoord] = useState(true);
  const [treatmentStartDate, setTreatmentStartDate] = useState(todayISO());

  // 2. point
  const [coord, setCoord] = useState<{ lat: number; lng: number } | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  // 3/4. shape + line
  const [shapeMode, setShapeMode] = useState<GeometryPickerMode>('polygon');
  const [lineWeight, setLineWeight] = useState(DEFAULT_LINE_WEIGHT);
  const [shape, setShape] = useState<FeatureGeometry | null>(null);
  const [openGeometryPicker, setOpenGeometryPicker] = useState<GeometryPickerMode | null>(null);

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

  const resetForm = () => {
    setName('');
    setAttrKey('');
    setAttrValue('');
    setPicked(null);
    setQuery('');
    setUseHomeCoord(true);
    setTreatmentStartDate(todayISO());
    setCoord(null);
    setShape(null);
  };

  const attribute = attrKey.trim()
    ? { key: attrKey.trim(), value: attrValue.trim() }
    : undefined;

  const addFeature = (feature: LayerFeature) => {
    onChange([...layer.features, feature]);
    resetForm();
  };

  const addPerson = () => {
    const r = picked?.matchedResident;
    if (!r) return;
    if (layer.features.some((f) => f.person?.person_id === r.person_id)) {
      resetForm();
      return;
    }
    // "พิกัดจากบ้าน" stays a reference so a later house correction moves it too
    const geometry: FeatureGeometry = useHomeCoord
      ? { type: 'home' }
      : { type: 'point', lat: coord!.lat, lng: coord!.lng };

    addFeature({
      id: `person-${r.person_id}-${Date.now()}`,
      name: name.trim() || `${r.pname}${r.fname} ${r.lname}`.trim(),
      geometry,
      attribute,
      person: {
        person_id: r.person_id,
        house_id: picked!.house.house_id,
        hn: r.hn,
        house_address: picked!.house.address,
        village_moo: picked!.house.village_moo,
        ...(isEpidemic ? { treatment_start_date: treatmentStartDate } : {})
      }
    });
  };

  const addPoint = () => {
    if (!name.trim() || !coord) return;
    addFeature({
      id: `point-${Date.now()}`,
      name: name.trim(),
      geometry: { type: 'point', lat: coord.lat, lng: coord.lng },
      attribute
    });
  };

  const addShape = () => {
    if (!name.trim() || !shape) return;
    addFeature({
      id: `${shape.type}-${Date.now()}`,
      name: name.trim(),
      geometry: shape,
      attribute
    });
  };

  const personReady = !!picked?.matchedResident && (useHomeCoord || !!coord);

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
              <div className="modal-house-title">{layer.name}</div>
              <div className="modal-house-subtitle">
                {layer.features.length} รายการ
                {layer.visible ? ' · แสดงผลบนแผนที่' : ' · ซ่อนจากแผนที่'}
              </div>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="ปิด">&times;</button>
        </div>

        <div className="modal-body">
          {/* Add feature */}
          <div className="modal-section-card">
            <div className="feature-method-tabs">
              {METHODS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`feature-method-btn ${method === m.id ? 'active' : ''}`}
                  onClick={() => { setMethod(m.id); resetForm(); }}
                >
                  {m.icon}
                  {m.label}
                </button>
              ))}
            </div>

            {method === 'person' && (
              <>
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

                <div className="setting-field">
                  <label className="setting-field-label">พิกัด</label>
                  <div className="feature-coord-choice">
                    <label>
                      <input
                        type="radio"
                        checked={useHomeCoord}
                        onChange={() => setUseHomeCoord(true)}
                      />
                      ใช้พิกัดบ้าน
                    </label>
                    <label>
                      <input
                        type="radio"
                        checked={!useHomeCoord}
                        onChange={() => setUseHomeCoord(false)}
                      />
                      กำหนดพิกัดเอง
                    </label>
                  </div>
                  {!useHomeCoord && (
                    <div className="setting-name-row" style={{ marginTop: 8 }}>
                      <input
                        type="text"
                        className="setting-input font-mono"
                        readOnly
                        value={coord ? `${coord.lat.toFixed(6)}, ${coord.lng.toFixed(6)}` : 'ยังไม่ได้ปักหมุด'}
                      />
                      <button type="button" className="setting-grid-btn" onClick={() => setIsPickerOpen(true)}>
                        <MapPin size={13} />
                        ปักหมุด
                      </button>
                    </div>
                  )}
                </div>

                {isEpidemic && (
                  <div className="setting-field">
                    <label className="setting-field-label" htmlFor="feature-date">วันเริ่มรักษา</label>
                    <input
                      id="feature-date"
                      type="date"
                      className="setting-input"
                      value={treatmentStartDate}
                      onChange={(e) => setTreatmentStartDate(e.target.value)}
                    />
                  </div>
                )}
              </>
            )}

            {method === 'point' && (
              <div className="setting-field" style={{ marginTop: 0 }}>
                <label className="setting-field-label">พิกัด</label>
                <div className="setting-name-row">
                  <input
                    type="text"
                    className="setting-input font-mono"
                    readOnly
                    value={coord ? `${coord.lat.toFixed(6)}, ${coord.lng.toFixed(6)}` : 'ยังไม่ได้ปักหมุด'}
                  />
                  <button type="button" className="setting-grid-btn" onClick={() => setIsPickerOpen(true)}>
                    <MapPin size={13} />
                    ปักหมุด
                  </button>
                </div>
              </div>
            )}

            {method === 'shape' && (
              <div className="setting-field" style={{ marginTop: 0 }}>
                <label className="setting-field-label">รูปทรง</label>
                <div className="feature-coord-choice">
                  <label>
                    <input
                      type="radio"
                      checked={shapeMode === 'polygon'}
                      onChange={() => { setShapeMode('polygon'); setShape(null); }}
                    />
                    <Pentagon size={13} /> พื้นที่อิสระ (polygon)
                  </label>
                  <label>
                    <input
                      type="radio"
                      checked={shapeMode === 'circle'}
                      onChange={() => { setShapeMode('circle'); setShape(null); }}
                    />
                    <Circle size={13} /> วงกลม (จุดกึ่งกลาง + รัศมี)
                  </label>
                </div>
                <div className="setting-name-row" style={{ marginTop: 8 }}>
                  <input
                    type="text"
                    className="setting-input font-mono"
                    readOnly
                    value={shape ? describeGeometry({ id: '', name: '', geometry: shape }) : 'ยังไม่ได้วาด'}
                  />
                  <button
                    type="button"
                    className="setting-grid-btn"
                    onClick={() => setOpenGeometryPicker(shapeMode)}
                  >
                    <Pentagon size={13} />
                    วาดบนแผนที่
                  </button>
                </div>
              </div>
            )}

            {method === 'line' && (
              <>
                <div className="setting-field" style={{ marginTop: 0 }}>
                  <label className="setting-field-label" htmlFor="line-weight">ความหนาของเส้น (px)</label>
                  <input
                    id="line-weight"
                    type="number"
                    min={1}
                    max={20}
                    className="setting-number"
                    value={lineWeight}
                    onChange={(e) => {
                      const w = Math.min(20, Math.max(1, Number(e.target.value) || 1));
                      setLineWeight(w);
                      // Keep an already drawn line in step with the width
                      setShape((prev) => (prev?.type === 'line' ? { ...prev, weight: w } : prev));
                    }}
                  />
                </div>
                <div className="setting-field">
                  <label className="setting-field-label">แนวเส้น</label>
                  <div className="setting-name-row">
                    <input
                      type="text"
                      className="setting-input font-mono"
                      readOnly
                      value={shape ? describeGeometry({ id: '', name: '', geometry: shape }) : 'ยังไม่ได้วาด'}
                    />
                    <button
                      type="button"
                      className="setting-grid-btn"
                      onClick={() => setOpenGeometryPicker('line')}
                    >
                      <Spline size={13} />
                      วาดบนแผนที่
                    </button>
                  </div>
                </div>
              </>
            )}

            <div className="setting-field">
              <label className="setting-field-label" htmlFor="feature-name">
                ชื่อ{method === 'person' ? ' (เว้นว่างเพื่อใช้ชื่อผู้ป่วย)' : ''}
              </label>
              <input
                id="feature-name"
                type="text"
                className="setting-input"
                placeholder="ชื่อที่จะแสดงบนแผนที่"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="setting-field">
              <label className="setting-field-label">Attribute (ไม่บังคับ)</label>
              <div className="setting-name-row">
                <input
                  type="text"
                  className="setting-input"
                  placeholder="ชื่อ attribute เช่น ผู้ประสานงาน"
                  value={attrKey}
                  onChange={(e) => setAttrKey(e.target.value)}
                />
                <input
                  type="text"
                  className="setting-input"
                  placeholder="ค่า เช่น นายสมชาย 08x-xxx-xxxx"
                  value={attrValue}
                  onChange={(e) => setAttrValue(e.target.value)}
                />
              </div>
            </div>

            {method === 'person' ? (
              <button type="button" className="setting-register-btn" disabled={!personReady} onClick={addPerson}>
                <UserPlus size={15} />
                เพิ่มเข้าชั้นข้อมูล
              </button>
            ) : method === 'point' ? (
              <button
                type="button"
                className="setting-register-btn"
                disabled={!name.trim() || !coord}
                onClick={addPoint}
              >
                <MapPin size={15} />
                เพิ่มเข้าชั้นข้อมูล
              </button>
            ) : (
              <button
                type="button"
                className="setting-register-btn"
                disabled={!name.trim() || !shape}
                onClick={addShape}
              >
                {method === 'line' ? <Spline size={15} /> : <Pentagon size={15} />}
                เพิ่มเข้าชั้นข้อมูล
              </button>
            )}
          </div>

          {/* Feature list */}
          <div className="modal-section-card">
            <div className="section-card-header">
              <span className="section-title">
                <Users size={16} />
                ข้อมูลในชั้นนี้ ({layer.features.length} รายการ)
              </span>
            </div>

            {layer.features.length === 0 ? (
              <div className="setting-person-empty">ยังไม่มีข้อมูลในชั้นข้อมูลนี้</div>
            ) : (
              <div className="residents-table-wrapper">
                <table className="residents-table">
                  <thead>
                    <tr>
                      <th style={{ width: 50 }}>ลำดับ</th>
                      <th>ชื่อ</th>
                      <th style={{ width: 80 }}>ชนิด</th>
                      <th>ตำแหน่ง</th>
                      <th>Attribute</th>
                      {isEpidemic && <th>วันเริ่มรักษา</th>}
                      <th style={{ width: 50 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {layer.features.map((f, i) => (
                      <tr key={f.id}>
                        <td className="font-mono">{i + 1}</td>
                        <td><strong>{f.name}</strong></td>
                        <td>{GEOMETRY_LABEL[f.geometry.type]}</td>
                        <td className="font-mono">{describeGeometry(f)}</td>
                        <td>{f.attribute ? `${f.attribute.key}: ${f.attribute.value}` : '-'}</td>
                        {isEpidemic && <td className="font-mono">{f.person?.treatment_start_date || '-'}</td>}
                        <td>
                          <button
                            type="button"
                            className="setting-grid-btn danger"
                            aria-label="ลบข้อมูล"
                            onClick={() => onChange(layer.features.filter((_, idx) => idx !== i))}
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
          title={`ปักหมุด${name.trim() ? `: ${name.trim()}` : ''}`}
          subtitle={`${layer.name} • ลากหมุดสีแดงไปยังตำแหน่งจริง`}
          initialLat={coord?.lat ?? null}
          initialLng={coord?.lng ?? null}
          onConfirm={(lat, lng) => { setCoord({ lat, lng }); setIsPickerOpen(false); }}
          onClose={() => setIsPickerOpen(false)}
        />
      )}

      {openGeometryPicker && (
        <GeometryPickerModal
          mode={openGeometryPicker}
          title={`วาด${GEOMETRY_LABEL[openGeometryPicker === 'circle' ? 'circle' : openGeometryPicker]}: ${layer.name}`}
          weight={lineWeight}
          onConfirm={(geometry) => { setShape(geometry); setOpenGeometryPicker(null); }}
          onClose={() => setOpenGeometryPicker(null)}
        />
      )}
    </div>
  );
}
