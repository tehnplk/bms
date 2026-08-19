'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { HealthRiskCategory, House, Village } from '@/lib/types/gis';
import { AddonContext } from '@/lib/types/bms';
import { dataService, SearchResultItem } from '@/lib/services/dataService';
import {
  Map,
  Building2,
  Search,
  X,
  Home,
  HeartPulse,
  User,
  MapPin, 
  Wrench,
  Settings,
  ChevronRight,
  AlertTriangle
} from 'lucide-react';

const HEALTH_GROUP_OPTIONS: Array<{ id: HealthRiskCategory | 'all'; label: string }> = [
  { id: 'all', label: '🩺 ทุกกลุ่มติดตาม' },
  { id: 'chronic', label: 'ผู้ป่วยโรคเรื้อรัง (NCDs)' },
  { id: 'vulnerable', label: 'กลุ่มติดตามต่อเนื่อง' },
  { id: 'mch', label: 'หญิงตั้งครรภ์ & ทารกแรกเกิด' },
  { id: 'epidemic', label: 'กลุ่มระบาดวิทยาและควบคุมโรค' },
  { id: 'unmapped', label: 'บ้านที่ยังไม่มีพิกัด' }
];

export interface NavbarProps {
  ctx: AddonContext;
  villages: Village[];
  houses: House[];
  selectedVillageId: number | 'all';
  onVillageChange: (villageId: number | 'all') => void;
  healthGroup: HealthRiskCategory | 'all';
  onHealthGroupChange: (group: HealthRiskCategory | 'all') => void;
  totalHouses: number;
  onSelectHouse: (house: House) => void;
  isRightPanelOpen: boolean;
  onToggleRightPanel: () => void;
}

export default function Navbar({
  ctx,
  villages,
  houses,
  selectedVillageId,
  onVillageChange,
  healthGroup,
  onHealthGroupChange,
  totalHouses,
  onSelectHouse,
  isRightPanelOpen,
  onToggleRightPanel
}: NavbarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Count from the loaded houses, not village.total_houses, so every option in the
  // dropdown adds up to the "ทุกหมู่บ้าน" total and matches what selecting it shows
  const houseCountByVillage = useMemo(() => {
    const counts: Record<number, number> = {};
    houses.forEach((h) => {
      counts[h.village_id] = (counts[h.village_id] || 0) + 1;
    });
    return counts;
  }, [houses]);

  // Search Results using person -> house -> village relationship, queried straight
  // from the HOSxP database so results are not limited to the houses already on the map
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    setIsSearching(true);
    const timer = setTimeout(async () => {
      const results = await dataService.searchRemote(ctx, searchQuery);
      if (cancelled) return;
      setSearchResults(results.slice(0, 15));
      setIsSearching(false);
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, ctx]);

  // Click outside listener to close search dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setIsSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut (Ctrl+K or Cmd+K) to focus search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setIsSearchOpen(true);
      } else if (e.key === 'Escape') {
        setIsSearchOpen(false);
        searchInputRef.current?.blur();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSelectResult = (house: House) => {
    onSelectHouse(house);
    setIsSearchOpen(false);
    // Keep search query or clear based on preference
  };

  return (
    <header className="navbar-container">
      {/* Brand & App Title */}
      <div className="navbar-brand">
        <div className="brand-logo-circle">
          <Map size={20} style={{ color: '#0284c7' }} />
        </div>
        <div className="brand-text">
          <div className="brand-title">Welness Top View</div>
          <div className="brand-subtitle">ชุมชนสุขภาวะ</div>
        </div>
      </div>

      {/* Center Controls: Follow-up Group, Village Selector & Resident/Address Search */}
      <div className="navbar-controls">
        {/* 1. Follow-up group filter (applies to the map, not just the panel list) */}
        <div className="village-select-box health-group-box">
          <HeartPulse size={15} className="select-icon" />
          <select
            id="navbar-health-group-select"
            className="navbar-select"
            value={healthGroup}
            onChange={(e) => onHealthGroupChange(e.target.value as HealthRiskCategory | 'all')}
            title="กรองหมุดบนแผนที่ตามกลุ่มติดตาม"
          >
            {HEALTH_GROUP_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* 2. Village Selector Dropdown */}
        <div className="village-select-box">
          <Building2 size={15} className="select-icon" />
          <select
            id="navbar-village-select"
            className="navbar-select"
            value={selectedVillageId}
            onChange={(e) => {
              const val = e.target.value;
              onVillageChange(val === 'all' ? 'all' : Number(val));
            }}
          >
            <option value="all">📍 ทุกหมู่บ้าน ({totalHouses} หลัง)</option>
            {villages.map((v) => (
              <option key={v.village_id} value={v.village_id}>
                หมู่ {v.village_moo} {v.village_name} ({houseCountByVillage[v.village_id] || 0} หลัง)
              </option>
            ))}
          </select>
        </div>

        {/* 3. Live Search Bar: person -> house -> village */}
        <div className="navbar-search-box" ref={searchContainerRef}>
          <div className="search-input-wrapper">
            <Search size={15} className="search-input-icon" />
            <input
              ref={searchInputRef}
              type="text"
              className="navbar-search-input"
              placeholder="ค้นหาชื่อผู้อยู่อาศัย หรือ บ้านเลขที่..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
              }}
              onFocus={() => {
                if (searchQuery.trim()) setIsSearchOpen(true);
              }}
            />
            {searchQuery && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => {
                  setSearchQuery('');
                  searchInputRef.current?.focus();
                }}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Autocomplete Search Dropdown */}
          {isSearchOpen && searchQuery.trim() !== '' && (
            <div className="search-dropdown-menu animate-scale-up">
              <div className="search-dropdown-header">
                <span>{isSearching ? 'กำลังค้นหา...' : `ผลการค้นหา (${searchResults.length} รายการ)`}</span>
                <span className="search-rel-hint">person ➔ house ➔ village</span>
              </div>

              {searchResults.length > 0 ? (
                <div className="search-results-list">
                  {searchResults.map((item) => {
                    const house = item.house;
                    const hasCoord = house.latitude !== null && house.longitude !== null;
                    const isResidentMatch = item.matchedType === 'resident' || item.matchedType === 'hn';

                    return (
                      <div
                        key={`${house.house_id}-${item.matchedResident?.person_id || 'h'}`}
                        className="search-result-item"
                        onClick={() => handleSelectResult(house)}
                      >
                        <div className="result-item-icon">
                          {isResidentMatch ? (
                            <User size={16} className="text-blue" />
                          ) : (
                            <Home size={16} className="text-emerald" />
                          )}
                        </div>

                        <div className="result-item-info">
                          <div className="result-main-line">
                            <span className="result-house-num">
                              บ้านเลขที่ {house.address}
                            </span>
                            <span className="result-village-name">
                              หมู่ {house.village_moo} {house.village_name}
                            </span>
                          </div>

                          {/* Resident details if matched or show head person */}
                          <div className="result-sub-line">
                            {isResidentMatch && item.matchedResident ? (
                              <span className="result-matched-person">
                                👤 {item.matchedResident.pname}{item.matchedResident.fname} {item.matchedResident.lname}
                                {item.matchedResident.house_regist_type_id === 1 && (
                                  <span className="badge-head-mini">เจ้าบ้าน</span>
                                )}
                                {item.matchedResident.hn && (
                                  <span className="result-hn-tag">HN: {item.matchedResident.hn}</span>
                                )}
                              </span>
                            ) : (
                              <span className="result-head-person">
                                เจ้าบ้าน: {house.head_person_name || 'ไม่ระบุ'} ({house.residents.length} สมาชิก)
                              </span>
                            )}
                          </div>
                        </div>

                        {/* GPS Coordinate Status Badge */}
                        <div className="result-item-badge">
                          {hasCoord ? (
                            <span className="badge-coord-ok" title={`พิกัด: ${house.latitude?.toFixed(4)}, ${house.longitude?.toFixed(4)}`}>
                              <MapPin size={12} />
                              มีพิกัด
                            </span>
                          ) : (
                            <span className="badge-coord-missing" title="ยังไม่มีพิกัดในตาราง house">
                              <AlertTriangle size={12} />
                              ไม่มีพิกัด
                            </span>
                          )}
                          <ChevronRight size={14} className="result-arrow" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : !isSearching ? (
                <div className="search-empty-state">
                  <p>ไม่พบข้อมูลบ้าน หรือ ผู้อยู่อาศัยที่ตรงกับ <strong>&ldquo;{searchQuery}&rdquo;</strong></p>
                  <span className="search-empty-hint">ลองค้นหาด้วย: บ้านเลขที่, ชื่อ, นามสกุล หรือ เลข HN</span>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Right Controls: Hospital Badge, Tile Switcher, Right Panel Toggle & Refresh */}
      <div className="navbar-actions">
        {/* Settings Page Link */}
        <Link href="/setting/layer" className="navbar-icon-btn panel-toggle-btn" title="ตั้งค่ากลุ่มติดตามต่อเนื่อง และกลุ่มระบาดวิทยา">
          <Settings size={17} />
          <span className="btn-label-responsive">ตั้งค่า</span>
        </Link>

        {/* Right Panel Toggle Button (Explain / Collapse) */}
        <button
          type="button"
          className={`navbar-icon-btn panel-toggle-btn ${isRightPanelOpen ? 'active' : ''}`}
          onClick={onToggleRightPanel}
          title={isRightPanelOpen ? 'ย่อ/ปิดแผงเครื่องมือด้านขวา' : 'ขยาย/เปิดแผงเครื่องมือ'}
        >
          <Wrench size={17} />
          <span className="btn-label-responsive">เครื่องมือ</span>
        </button>

      </div>
    </header>
  );
}
