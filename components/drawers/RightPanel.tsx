'use client';

import React, { useState, useMemo } from 'react';
import { House, Village, CatchmentStats, HealthRiskCategory } from '@/lib/types/gis';
import { dataService } from '@/lib/services/dataService';
import { 
  ChevronRight,
  Layers,
  BarChart3, 
  Home, 
  Users, 
  Building2,
  MapPin, 
  AlertTriangle, 
  CheckCircle2, 
  Database, 
  ArrowRight, 
  Filter, 
  Download, 
  Navigation, 
  Activity, 
  HeartPulse, 
  Baby, 
  Search,
  ExternalLink,
  Code2,
  Table
} from 'lucide-react';

export type RightPanelTab = 'stats' | 'houses' | 'explain';

export interface RightPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  villages: Village[];
  houses: House[];
  displayedHouses: House[];
  selectedVillageId: number | 'all';
  onVillageChange: (villageId: number | 'all') => void;
  selectedHouse: House | null;
  onSelectHouse: (house: House) => void;
  onEditCoordinate: (house: House) => void;
  onNavigate: (lat: number, lng: number) => void;
}

export default function RightPanel({
  isOpen,
  onToggle,
  villages,
  houses,
  displayedHouses,
  selectedVillageId,
  onVillageChange,
  selectedHouse,
  onSelectHouse,
  onEditCoordinate,
  onNavigate
}: RightPanelProps) {
  const [activeTab, setActiveTab] = useState<RightPanelTab>('stats');
  const [houseFilter, setHouseFilter] = useState<'all' | 'geocoded' | 'unmapped'>('all');
  const [healthFilter, setHealthFilter] = useState<HealthRiskCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Calculate stats for current displayed scope
  const stats: CatchmentStats = useMemo(() => {
    return dataService.calculateStats(displayedHouses, villages);
  }, [displayedHouses, villages]);

  const selectedVillage = selectedVillageId === 'all'
    ? null
    : villages.find(v => v.village_id === selectedVillageId);

  // Every village in a catchment shares one sub-district, so fall back to the first
  const tambonName = selectedVillage?.tambon_name || villages[0]?.tambon_name;

  // Filtered houses for list tab
  const filteredList = useMemo(() => {
    return displayedHouses.filter(h => {
      // Coordinate filter
      if (houseFilter === 'geocoded' && (h.latitude === null || h.longitude === null)) return false;
      if (houseFilter === 'unmapped' && h.latitude !== null && h.longitude !== null) return false;

      // Health filter
      if (healthFilter !== 'all') {
        if (healthFilter === 'chronic' && !h.has_chronic) return false;
        if (healthFilter === 'vulnerable' && !h.has_vulnerable) return false;
        if (healthFilter === 'mch' && !h.has_mch) return false;
        if (healthFilter === 'unmapped' && (h.latitude !== null && h.longitude !== null)) return false;
        if (healthFilter === 'normal' && (h.has_chronic || h.has_vulnerable || h.has_mch)) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchAddress = h.address.toLowerCase().includes(q);
        const matchVillage = h.village_name.toLowerCase().includes(q);
        const matchHead = h.head_person_name?.toLowerCase().includes(q);
        const matchResident = h.residents.some(r => 
          `${r.pname}${r.fname} ${r.lname}`.toLowerCase().includes(q) ||
          (r.hn && r.hn.includes(q))
        );
        if (!matchAddress && !matchVillage && !matchHead && !matchResident) return false;
      }

      return true;
    });
  }, [displayedHouses, houseFilter, healthFilter, searchQuery]);

  // Export handlers
  const handleExportGeoJSON = () => {
    const geoJsonStr = dataService.exportToGeoJSON(displayedHouses);
    const blob = new Blob([geoJsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hosxp_catchment_gis_${Date.now()}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    const csvStr = dataService.exportToCSV(displayedHouses);
    const blob = new Blob(['\uFEFF' + csvStr], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hosxp_catchment_houses_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {/* Main Right Panel Container */}
      <aside className={`right-panel-drawer ${isOpen ? 'open' : 'closed'}`}>
        {/* Panel Header */}
        <div className="right-panel-header">
          <div className="header-title-group">
            <BarChart3 size={18} className="text-primary" />
            <div>
              <h2 className="panel-title">
                {selectedVillage
                  ? `หมู่ที่ ${selectedVillage.village_moo} ${selectedVillage.village_name}`
                  : `ทุกหมู่บ้านในเขต (${villages.length} หมู่)`}
              </h2>
              {tambonName && <p className="panel-subtitle">ตำบล{tambonName}</p>}
            </div>
          </div>
          <button
            type="button"
            className="panel-close-btn"
            onClick={onToggle}
            aria-label="ย่อแผงข้อมูล"
            title="ย่อแถบด้านขวา"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Panel Navigation Tabs */}
        <div className="right-panel-tabs">
          <button
            type="button"
            className={`panel-tab-btn ${activeTab === 'stats' ? 'active' : ''}`}
            onClick={() => setActiveTab('stats')}
          >
            <BarChart3 size={15} />
            ภาพรวม & สถิติ
          </button>
          <button
            type="button"
            className={`panel-tab-btn ${activeTab === 'houses' ? 'active' : ''}`}
            onClick={() => setActiveTab('houses')}
          >
            <Home size={15} />
            รายชื่อบ้าน ({displayedHouses.length})
          </button>
          <button
            type="button"
            className={`panel-tab-btn ${activeTab === 'explain' ? 'active' : ''}`}
            onClick={() => setActiveTab('explain')}
          >
            <Database size={15} />
            โครงสร้างตาราง
          </button>
        </div>

        {/* Panel Body Content based on Active Tab */}
        <div className="right-panel-body">
          {/* ========================================================
              TAB 1: 📊 ภาพรวม & สถิติ (Stats & Health Risk Overview)
             ======================================================== */}
          {activeTab === 'stats' && (
            <div className="tab-content-stats animate-fade-in">
              {/* Progress Card */}
              <div className="kpi-hero-card">
                <div className="kpi-hero-header">
                  <span className="hero-label">ความครอบคลุมของพิกัดบ้าน (GIS Geocoded)</span>
                  <span className="hero-percentage">{stats.percentGeocoded}%</span>
                </div>
                <div className="progress-bar-track">
                  <div 
                    className="progress-bar-fill"
                    style={{ width: `${stats.percentGeocoded}%` }}
                  />
                </div>
                <div className="kpi-hero-footer">
                  <span>มีพิกัดแล้ว <strong>{stats.geocodedHouses}</strong> หลัง</span>
                  <span className="text-amber">ขาดพิกัด <strong>{stats.unmappedHouses}</strong> หลัง</span>
                </div>
              </div>

              {/* 4 Metric Grid */}
              <div className="stats-kpi-grid">
                <div className="kpi-box">
                  <div className="kpi-icon-wrap bg-blue-light">
                    <Home size={18} className="text-primary" />
                  </div>
                  <div className="kpi-data">
                    <div className="kpi-num">{stats.totalHouses}</div>
                    <div className="kpi-text">บ้านทั้งหมด</div>
                  </div>
                </div>

                <div className="kpi-box">
                  <div className="kpi-icon-wrap bg-emerald-light">
                    <CheckCircle2 size={18} className="text-emerald" />
                  </div>
                  <div className="kpi-data">
                    <div className="kpi-num">{stats.geocodedHouses}</div>
                    <div className="kpi-text">ปักหมุดแล้ว</div>
                  </div>
                </div>

                <div className="kpi-box">
                  <div className="kpi-icon-wrap bg-amber-light">
                    <AlertTriangle size={18} className="text-amber" />
                  </div>
                  <div className="kpi-data">
                    <div className="kpi-num">{stats.unmappedHouses}</div>
                    <div className="kpi-text">ยังไม่มีพิกัด</div>
                  </div>
                </div>

                <div className="kpi-box">
                  <div className="kpi-icon-wrap bg-purple-light">
                    <Users size={18} className="text-purple" />
                  </div>
                  <div className="kpi-data">
                    <div className="kpi-num">{stats.totalResidents}</div>
                    <div className="kpi-text">ประชากร</div>
                  </div>
                </div>
              </div>

              {/* Health Risk Categories Breakdown */}
              <div className="panel-section-card">
                <div className="section-card-header">
                  <span className="section-title">
                    <HeartPulse size={16} className="text-primary" />
                    กลุ่มเฝ้าระวังสุขภาพ (Health Surveillance)
                  </span>
                </div>

                <div className="health-stat-list">
                  <div 
                    className={`health-stat-item ${healthFilter === 'chronic' ? 'selected' : ''}`}
                    onClick={() => setHealthFilter(healthFilter === 'chronic' ? 'all' : 'chronic')}
                  >
                    <div className="health-stat-left">
                      <span className="dot dot-chronic"></span>
                      <span className="health-name">ผู้ป่วยโรคเรื้อรัง (NCDs)</span>
                    </div>
                    <span className="health-badge-count count-chronic">{stats.chronicPatients} คน</span>
                  </div>

                  <div 
                    className={`health-stat-item ${healthFilter === 'vulnerable' ? 'selected' : ''}`}
                    onClick={() => setHealthFilter(healthFilter === 'vulnerable' ? 'all' : 'vulnerable')}
                  >
                    <div className="health-stat-left">
                      <span className="dot dot-vulnerable"></span>
                      <span className="health-name">กลุ่มเปราะบาง / ติดเตียง / ผู้พิการ</span>
                    </div>
                    <span className="health-badge-count count-vulnerable">{stats.vulnerablePeople} คน</span>
                  </div>

                  <div 
                    className={`health-stat-item ${healthFilter === 'mch' ? 'selected' : ''}`}
                    onClick={() => setHealthFilter(healthFilter === 'mch' ? 'all' : 'mch')}
                  >
                    <div className="health-stat-left">
                      <span className="dot dot-mch"></span>
                      <span className="health-name">หญิงตั้งครรภ์ &amp; ทารกแรกเกิด</span>
                    </div>
                    <span className="health-badge-count count-mch">{stats.mchCount} คน</span>
                  </div>

                  <div 
                    className={`health-stat-item ${healthFilter === 'normal' ? 'selected' : ''}`}
                    onClick={() => setHealthFilter(healthFilter === 'normal' ? 'all' : 'normal')}
                  >
                    <div className="health-stat-left">
                      <span className="dot dot-normal"></span>
                      <span className="health-name">ประชากรสุขภาพทั่วไป</span>
                    </div>
                    <span className="health-badge-count count-normal">
                      {Math.max(0, stats.totalResidents - stats.chronicPatients - stats.vulnerablePeople - stats.mchCount)} คน
                    </span>
                  </div>
                </div>

                {healthFilter !== 'all' && (
                  <button 
                    type="button" 
                    className="btn-reset-filter"
                    onClick={() => setHealthFilter('all')}
                  >
                    ล้างตัวกรองสุขภาพ
                  </button>
                )}
              </div>

              {/* Data Export & Actions */}
              <div className="panel-section-card">
                <div className="section-card-header">
                  <span className="section-title">
                    <Download size={16} />
                    ส่งออกข้อมูลพิกัด (GIS Export)
                  </span>
                </div>
                <div className="export-btn-group">
                  <button
                    type="button"
                    className="btn-export"
                    onClick={handleExportGeoJSON}
                    title="ส่งออกในรูปแบบมาตรฐาน GIS GeoJSON Layer"
                  >
                    <Code2 size={14} />
                    GeoJSON Layer
                  </button>
                  <button
                    type="button"
                    className="btn-export"
                    onClick={handleExportCSV}
                    title="ส่งออกตารางข้อมูลพิกัดบ้านและเจ้าบ้านเป็น CSV"
                  >
                    <Table size={14} />
                    CSV Spreadsheet
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              TAB 2: 🏠 ค้นหา & รายชื่อบ้าน (Houses Explorer)
             ======================================================== */}
          {activeTab === 'houses' && (
            <div className="tab-content-houses animate-fade-in">
              {/* Filter controls */}
              <div className="house-filter-bar">
                <div className="house-search-box">
                  <Search size={14} className="text-muted" />
                  <input
                    type="text"
                    className="house-search-input"
                    placeholder="กรองบ้านเลขที่, ชื่อบุคคล หรือ HN..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button 
                      type="button" 
                      className="clear-mini-btn"
                      onClick={() => setSearchQuery('')}
                    >
                      &times;
                    </button>
                  )}
                </div>

                <div className="house-status-chips">
                  <button
                    type="button"
                    className={`status-chip ${houseFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setHouseFilter('all')}
                  >
                    ทั้งหมด ({displayedHouses.length})
                  </button>
                  <button
                    type="button"
                    className={`status-chip ${houseFilter === 'geocoded' ? 'active' : ''}`}
                    onClick={() => setHouseFilter('geocoded')}
                  >
                    มีพิกัด ({displayedHouses.filter(h => h.latitude !== null).length})
                  </button>
                  <button
                    type="button"
                    className={`status-chip ${houseFilter === 'unmapped' ? 'active' : ''}`}
                    onClick={() => setHouseFilter('unmapped')}
                  >
                    ขาดพิกัด ({displayedHouses.filter(h => h.latitude === null).length})
                  </button>
                </div>
              </div>

              {/* Scrollable House Cards List */}
              <div className="houses-scroll-list">
                {filteredList.length > 0 ? (
                  filteredList.map((house) => {
                    const hasCoords = house.latitude !== null && house.longitude !== null;
                    const isSelected = selectedHouse?.house_id === house.house_id;

                    return (
                      <div
                        key={house.house_id}
                        className={`house-list-card ${isSelected ? 'selected' : ''} ${!hasCoords ? 'card-unmapped' : ''}`}
                        onClick={() => onSelectHouse(house)}
                      >
                        <div className="card-top-row">
                          <div className="house-addr-title">
                            <strong>บ้านเลขที่ {house.address}</strong>
                            <span className="house-moo-tag">ม.{house.village_moo} {house.village_name}</span>
                          </div>
                          {hasCoords ? (
                            <span className="tag-coord-ok">
                              <MapPin size={11} />
                              มีพิกัด
                            </span>
                          ) : (
                            <span className="tag-coord-none">
                              <AlertTriangle size={11} />
                              ขาดพิกัด
                            </span>
                          )}
                        </div>

                        {/* Resident summary */}
                        <div className="card-resident-line">
                          <span className="head-name">
                            👤 {house.head_person_name || 'ไม่ระบุเจ้าบ้าน'}
                          </span>
                          <span className="res-count">
                            ({house.residents.length} คน)
                          </span>
                        </div>

                        {/* Health Tags */}
                        <div className="card-tags-row">
                          {house.has_vulnerable && <span className="mini-tag tag-vulnerable">เปราะบาง</span>}
                          {house.has_chronic && <span className="mini-tag tag-chronic">NCD</span>}
                          {house.has_mch && <span className="mini-tag tag-mch">แม่&amp;เด็ก</span>}
                        </div>

                        {/* Coordinate info / Action buttons */}
                        <div className="card-actions-row">
                          {hasCoords ? (
                            <span className="coord-text font-mono">
                              Lat: {house.latitude?.toFixed(5)}, Lng: {house.longitude?.toFixed(5)}
                            </span>
                          ) : (
                            <span className="coord-text-warning">
                              ยังไม่ได้บันทึกพิกัด GPS
                            </span>
                          )}

                          <div className="card-action-btns">
                            <button
                              type="button"
                              className="btn-card-action"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditCoordinate(house);
                              }}
                              title="ปักหมุด / แก้ไขพิกัดบ้าน"
                            >
                              <MapPin size={13} />
                              ปักหมุด
                            </button>
                            {hasCoords && (
                              <button
                                type="button"
                                className="btn-card-action"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onNavigate(house.latitude!, house.longitude!);
                                }}
                                title="เปิด Google Maps นำทาง"
                              >
                                <Navigation size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="empty-houses-box">
                    <p>ไม่พบรายการบ้านที่ตรงกับเงื่อนไข</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================
              TAB 3: 💡 โครงสร้างตาราง (Explain Data Model: person -> house -> village)
             ======================================================== */}
          {activeTab === 'explain' && (
            <div className="tab-content-explain animate-fade-in">
              <div className="explain-intro-card">
                <div className="explain-intro-icon">
                  <Database size={22} className="text-primary" />
                </div>
                <div className="explain-intro-text">
                  <h3>ความสัมพันธ์ของข้อมูล (Data Architecture)</h3>
                  <p>โครงสร้างตาราง HOSxP สำหรับระบบสารสนเทศภูมิศาสตร์ GIS ระดับหลังคาเรือน</p>
                </div>
              </div>

              {/* Visual Flow diagram of person -> house -> village */}
              <div className="er-flow-diagram">
                {/* 1. Person Entity */}
                <div className="er-node node-person">
                  <div className="node-header">
                    <Users size={16} />
                    <span className="node-table-name">1. ตาราง person</span>
                    <span className="node-type-badge">บุคคล/ผู้อยู่อาศัย</span>
                  </div>
                  <div className="node-body">
                    <div className="node-field field-pk">🔑 person_id (Primary Key)</div>
                    <div className="node-field field-fk">🔗 house_id (Foreign Key ➔ house)</div>
                    <div className="node-field">patient_hn (HN โรงพยาบาล)</div>
                    <div className="node-field">pname, fname, lname (ชื่อ-สกุล)</div>
                    <div className="node-field">birthdate, sex (วันเกิด, เพศ)</div>
                    <div className="node-field">house_regist_type_id (1=เจ้าบ้าน, 2=ผู้อาศัย)</div>
                  </div>
                </div>

                {/* Arrow Connector */}
                <div className="er-connector">
                  <div className="connector-line"></div>
                  <div className="connector-label">
                    <span>N : 1 (หลายคนต่อ 1 หลัง)</span>
                    <ArrowRight size={14} />
                  </div>
                </div>

                {/* 2. House Entity */}
                <div className="er-node node-house">
                  <div className="node-header">
                    <Home size={16} />
                    <span className="node-table-name">2. ตาราง house</span>
                    <span className="node-type-badge badge-highlight">เก็บพิกัด GIS</span>
                  </div>
                  <div className="node-body">
                    <div className="node-field field-pk">🔑 house_id (Primary Key)</div>
                    <div className="node-field field-fk">🔗 village_id (Foreign Key ➔ village)</div>
                    <div className="node-field field-geo">📍 latitude, longitude (พิกัด GPS)</div>
                    <div className="node-field field-geo">📍 location_latitude, location_longitude</div>
                    <div className="node-field">address (บ้านเลขที่)</div>
                    <div className="node-field">census_id (รหัสประจำบ้าน 11 หลัก)</div>
                    <div className="node-field">road (ถนน/ซอย)</div>
                  </div>
                </div>

                {/* Arrow Connector */}
                <div className="er-connector">
                  <div className="connector-line"></div>
                  <div className="connector-label">
                    <span>N : 1 (หลายหลังต่อ 1 หมู่บ้าน)</span>
                    <ArrowRight size={14} />
                  </div>
                </div>

                {/* 3. Village Entity */}
                <div className="er-node node-village">
                  <div className="node-header">
                    <Building2 size={16} />
                    <span className="node-table-name">3. ตาราง village</span>
                    <span className="node-type-badge">หมู่บ้านในเขตรับผิดชอบ</span>
                  </div>
                  <div className="node-body">
                    <div className="node-field field-pk">🔑 village_id (Primary Key)</div>
                    <div className="node-field">village_moo (หมู่ที่)</div>
                    <div className="node-field">village_name (ชื่อหมู่บ้าน)</div>
                    <div className="node-field">village_code (รหัสหมู่บ้าน)</div>
                    <div className="node-field field-geo">📍 latitude, longitude (จุดศูนย์กลางหมู่)</div>
                  </div>
                </div>
              </div>

              {/* SQL Relational Query Card */}
              <div className="panel-section-card">
                <div className="section-card-header">
                  <span className="section-title">
                    <Code2 size={16} className="text-primary" />
                    SQL Query ตัวอย่างการ JOIN ข้อมูล
                  </span>
                </div>
                <pre className="sql-code-block font-mono">
{`SELECT 
  p.person_id,
  CONCAT(p.pname, p.fname, ' ', p.lname) AS full_name,
  p.patient_hn,
  h.house_id,
  h.address,
  h.latitude,
  h.longitude,
  v.village_moo,
  v.village_name
FROM person p
INNER JOIN house h ON p.house_id = h.house_id
INNER JOIN village v ON h.village_id = v.village_id
WHERE h.village_id = :village_id
ORDER BY h.address ASC;`}
                </pre>
              </div>

              {/* BMS Session API Method Card */}
              <div className="panel-section-card">
                <div className="section-card-header">
                  <span className="section-title">
                    <ExternalLink size={16} className="text-primary" />
                    การอัปเดตพิกัดผ่าน BMS Session API
                  </span>
                </div>
                <div className="api-explain-box">
                  <div className="api-method-badge">
                    <span className="badge-put">PUT</span>
                    <code>/api/rest/house/{`{house_id}`}</code>
                  </div>
                  <p className="api-desc">
                    เมื่อผู้ใช้งานเลื่อนหมุดหรือระบุพิกัดบนแผนที่ ระบบจะส่งคำขอ REST PUT ไปยัง Gateway เพื่อ UPDATE ค่า <code>latitude</code> และ <code>longitude</code> ในตาราง <code>house</code> ของ HOSxP แบบ Real-time ทันที
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
