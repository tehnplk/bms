'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Search, ShieldAlert, Trash2, UserPlus, Users } from 'lucide-react';
import { bootstrapAddon } from '@/lib/services/bmsClient';
import { dataService, SearchResultItem } from '@/lib/services/dataService';
import { AppSettings, DEFAULT_SETTINGS, loadSettings, saveSettings } from '@/lib/services/settingsStore';
import { AddonContext } from '@/lib/types/bms';
import { EPIDEMIC_DISEASES, Resident, VulnerableCriteria } from '@/lib/types/gis';

type SettingTab = 'vulnerable' | 'epidemic';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function SettingPage() {
  const [activeTab, setActiveTab] = useState<SettingTab>('vulnerable');
  const [ctx, setCtx] = useState<AddonContext>({
    session: null,
    sessionId: undefined,
    mktToken: undefined,
    readOnly: false,
    isMock: true
  });
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const isHydrated = useRef(false);

  // Epidemic case form: person -> disease -> date
  const [personQuery, setPersonQuery] = useState('');
  const [personResults, setPersonResults] = useState<SearchResultItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [picked, setPicked] = useState<{ resident: Resident; houseId: number; address: string } | null>(null);
  const [disease, setDisease] = useState(EPIDEMIC_DISEASES[0]);
  const [registeredDate, setRegisteredDate] = useState(todayISO());

  useEffect(() => {
    setSettings(loadSettings());
    isHydrated.current = true;
    bootstrapAddon().then(setCtx).catch(() => {});
  }, []);

  // Persist on every change, but never write the defaults over stored values
  // before the first read has happened
  useEffect(() => {
    if (isHydrated.current) saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    const q = personQuery.trim();
    if (!q || picked) {
      setPersonResults([]);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    setIsSearching(true);
    const timer = setTimeout(async () => {
      const results = await dataService.searchRemote(ctx, q);
      if (cancelled) return;
      setPersonResults(results.filter(r => r.matchedResident).slice(0, 8));
      setIsSearching(false);
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [personQuery, picked, ctx]);

  const patchCriteria = (patch: Partial<VulnerableCriteria>) => {
    setSettings(prev => ({ ...prev, vulnerableCriteria: { ...prev.vulnerableCriteria, ...patch } }));
  };

  const handleRegister = () => {
    if (!picked) return;
    const r = picked.resident;
    const name = `${r.pname}${r.fname} ${r.lname}`.trim();

    setSettings(prev => {
      const exists = prev.epidemicCases.some(c => c.person_id === r.person_id && c.disease === disease);
      if (exists) return prev;
      return {
        ...prev,
        epidemicCases: [
          ...prev.epidemicCases,
          {
            person_id: r.person_id,
            house_id: picked.houseId,
            person_name: name,
            hn: r.hn,
            disease,
            registered_date: registeredDate
          }
        ]
      };
    });

    setPicked(null);
    setPersonQuery('');
    setRegisteredDate(todayISO());
  };

  const removeCase = (index: number) => {
    setSettings(prev => ({
      ...prev,
      epidemicCases: prev.epidemicCases.filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="setting-page">
      <header className="setting-header">
        <Link href="/" className="setting-back-btn">
          <ArrowLeft size={16} />
          กลับไปแผนที่
        </Link>
        <h1 className="setting-title">ตั้งค่า</h1>
      </header>

      <main className="setting-body">
        <div className="setting-tabs">
          <button
            type="button"
            className={`setting-tab-btn ${activeTab === 'vulnerable' ? 'active' : ''}`}
            onClick={() => setActiveTab('vulnerable')}
          >
            <Users size={15} />
            กลุ่มเปราะบาง
          </button>
          <button
            type="button"
            className={`setting-tab-btn ${activeTab === 'epidemic' ? 'active' : ''}`}
            onClick={() => setActiveTab('epidemic')}
          >
            <ShieldAlert size={15} />
            กลุ่มระบาดวิทยาและควบคุมโรค
            {settings.epidemicCases.length > 0 && (
              <span className="setting-tab-badge">{settings.epidemicCases.length}</span>
            )}
          </button>
        </div>

        {/* ---------------- กลุ่มเปราะบาง ---------------- */}
        <section className="setting-card" hidden={activeTab !== 'vulnerable'}>
          <div className="setting-card-head">
            <Users size={18} className="text-primary" />
            <div>
              <h2>กลุ่มเปราะบาง</h2>
              <p>เกณฑ์ที่ใช้จัดว่าบ้านหลังไหนอยู่ในกลุ่มเปราะบาง มีผลกับสีหมุด สถิติ และตัวกรองบนแผนที่</p>
            </div>
          </div>

          <label className="setting-row">
            <span className="setting-row-text">
              <span className="setting-row-title">เกณฑ์อายุผู้สูงอายุ</span>
              <span className="setting-row-desc">สมาชิกที่อายุตั้งแต่นี้ขึ้นไปทำให้บ้านเข้ากลุ่มเปราะบาง</span>
            </span>
            <input
              type="number"
              className="setting-number"
              min={0}
              max={120}
              value={settings.vulnerableCriteria.elderlyAge}
              onChange={(e) => patchCriteria({ elderlyAge: Number(e.target.value) || 0 })}
            />
          </label>

          <label className="setting-row">
            <span className="setting-row-text">
              <span className="setting-row-title">นับผู้พิการ</span>
              <span className="setting-row-desc">บ้านที่มีผู้พิการถือเป็นกลุ่มเปราะบาง</span>
            </span>
            <input
              type="checkbox"
              className="setting-switch"
              checked={settings.vulnerableCriteria.includeDisabled}
              onChange={(e) => patchCriteria({ includeDisabled: e.target.checked })}
            />
          </label>

          <label className="setting-row">
            <span className="setting-row-text">
              <span className="setting-row-title">นับผู้ป่วยติดเตียง</span>
              <span className="setting-row-desc">บ้านที่มีผู้ป่วยติดเตียงถือเป็นกลุ่มเปราะบาง</span>
            </span>
            <input
              type="checkbox"
              className="setting-switch"
              checked={settings.vulnerableCriteria.includeBedridden}
              onChange={(e) => patchCriteria({ includeBedridden: e.target.checked })}
            />
          </label>
        </section>

        {/* ------- กลุ่มระบาดวิทยาและควบคุมโรค ------- */}
        <section className="setting-card" hidden={activeTab !== 'epidemic'}>
          <div className="setting-card-head">
            <ShieldAlert size={18} style={{ color: '#be123c' }} />
            <div>
              <h2>กลุ่มระบาดวิทยาและควบคุมโรค</h2>
              <p>ลงทะเบียนผู้ป่วยเข้ากลุ่มควบคุมโรค บ้านของผู้ป่วยจะถูกทำเครื่องหมายบนแผนที่</p>
            </div>
          </div>

          <div className="setting-field">
            <label className="setting-field-label">1. ค้นชื่อผู้ป่วย หรือ HN</label>
            {picked ? (
              <div className="setting-picked">
                <span>
                  <strong>{picked.resident.pname}{picked.resident.fname} {picked.resident.lname}</strong>
                  {picked.resident.hn && <span className="result-hn-tag">HN: {picked.resident.hn}</span>}
                  <span className="setting-picked-meta">บ้านเลขที่ {picked.address}</span>
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
                    value={personQuery}
                    onChange={(e) => setPersonQuery(e.target.value)}
                  />
                </div>
                {personQuery.trim() !== '' && (
                  <div className="setting-person-results">
                    {isSearching && <div className="setting-person-empty">กำลังค้นหา...</div>}
                    {!isSearching && personResults.length === 0 && (
                      <div className="setting-person-empty">ไม่พบผู้ป่วยที่ตรงกับคำค้น</div>
                    )}
                    {personResults.map((item) => (
                      <button
                        key={item.matchedResident!.person_id}
                        type="button"
                        className="setting-person-item"
                        onClick={() => {
                          setPicked({
                            resident: item.matchedResident!,
                            houseId: item.house.house_id,
                            address: item.house.address
                          });
                          setPersonResults([]);
                        }}
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

          <div className="setting-field-row">
            <div className="setting-field">
              <label className="setting-field-label" htmlFor="setting-disease">2. เลือกโรค</label>
              <select
                id="setting-disease"
                className="setting-input"
                value={disease}
                onChange={(e) => setDisease(e.target.value)}
              >
                {EPIDEMIC_DISEASES.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div className="setting-field">
              <label className="setting-field-label" htmlFor="setting-date">3. วันที่ลงทะเบียน</label>
              <input
                id="setting-date"
                type="date"
                className="setting-input"
                value={registeredDate}
                onChange={(e) => setRegisteredDate(e.target.value)}
              />
            </div>
          </div>

          <button
            type="button"
            className="setting-register-btn"
            disabled={!picked}
            onClick={handleRegister}
          >
            <UserPlus size={15} />
            ลงทะเบียนเข้ากลุ่มระบาดวิทยา
          </button>

          <div className="setting-case-head">
            รายชื่อที่ลงทะเบียนไว้ ({settings.epidemicCases.length})
          </div>
          {settings.epidemicCases.length === 0 ? (
            <div className="setting-person-empty">ยังไม่มีผู้ป่วยในกลุ่มนี้</div>
          ) : (
            <div className="setting-case-list">
              {settings.epidemicCases.map((c, i) => (
                <div key={`${c.person_id}-${c.disease}`} className="setting-case-item">
                  <span className="setting-case-text">
                    <strong>{c.person_name}</strong>
                    <span className="setting-case-meta">
                      {c.disease} · ลงทะเบียน {c.registered_date}
                      {c.hn ? ` · HN ${c.hn}` : ''}
                    </span>
                  </span>
                  <button type="button" aria-label="ลบรายการ" onClick={() => removeCase(i)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
