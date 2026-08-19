'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Ambulance, ArrowLeft, Handshake, LucideIcon, Plus, ShieldAlert, Trash2, Users } from 'lucide-react';
import { bootstrapAddon } from '@/lib/services/bmsClient';
import { AppSettings, DEFAULT_SETTINGS, loadSettings, saveSettings } from '@/lib/services/settingsStore';
import { AddonContext } from '@/lib/types/bms';
import { GroupKind, GroupList } from '@/lib/types/gis';
import GroupMembersModal from '@/components/modals/GroupMembersModal';

const GROUP_META: Record<GroupKind, { label: string; short: string; icon: LucideIcon; placeholder: string }> = {
  vulnerable: {
    label: 'กลุ่มติดตามต่อเนื่อง',
    short: 'ติดตามต่อเนื่อง',
    icon: Users,
    placeholder: 'เช่น ผู้ป่วยติดเตียง หมู่ 1'
  },
  epidemic: {
    label: 'กลุ่มระบาดวิทยาและควบคุมโรค',
    short: 'ระบาดวิทยา',
    icon: ShieldAlert,
    placeholder: 'เช่น เฝ้าระวังไข้เลือดออก ส.ค. 69'
  },
  partner: {
    label: 'ภาคีเครือข่าย',
    short: 'ภาคีเครือข่าย',
    icon: Handshake,
    placeholder: 'เช่น วัดและโรงเรียนในเขต'
  },
  resource: {
    label: 'ทรัพยากรสุขภาพ',
    short: 'ทรัพยากรสุขภาพ',
    icon: Ambulance,
    placeholder: 'เช่น จุดบริการปฐมภูมิ, รถรับส่งผู้ป่วย'
  }
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function SettingPage() {
  const [activeTab, setActiveTab] = useState<GroupKind>('vulnerable');
  const [ctx, setCtx] = useState<AddonContext>({
    session: null,
    sessionId: undefined,
    mktToken: undefined,
    readOnly: false,
    isMock: true
  });
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [openListId, setOpenListId] = useState<string | null>(null);
  const [isNaming, setIsNaming] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState<string | undefined>();
  const isHydrated = useRef(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function init() {
      const addonCtx = await bootstrapAddon().catch(() => null);
      const resolved = addonCtx ?? ctx;
      if (addonCtx) setCtx(addonCtx);
      setSettings(await loadSettings(resolved));
      isHydrated.current = true;
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced write-back: typing a list name must not fire one PUT per keystroke
  // (BMS User Storage allows 120 writes/minute)
  useEffect(() => {
    if (!isHydrated.current) return;
    setSaveState('saving');
    const timer = setTimeout(async () => {
      const result = await saveSettings(ctx, settings);
      if (result.conflictWith) setSettings(result.conflictWith);
      setSaveState(result.ok ? 'saved' : 'error');
      setSaveMessage(result.message);
    }, 800);
    return () => clearTimeout(timer);
  }, [settings, ctx]);

  const listsOfTab = settings.groupLists.filter((l) => l.group === activeTab);
  const openList = settings.groupLists.find((l) => l.id === openListId) || null;

  const updateList = (id: string, patch: Partial<GroupList>) => {
    setSettings((prev) => ({
      ...prev,
      groupLists: prev.groupLists.map((l) => (l.id === id ? { ...l, ...patch } : l))
    }));
  };

  const startNaming = () => {
    setNewListName('');
    setIsNaming(true);
    setTimeout(() => nameInputRef.current?.focus(), 0);
  };

  const confirmCreate = () => {
    const name = newListName.trim();
    if (!name) return;
    const newList: GroupList = {
      id: `${activeTab}-${Date.now()}`,
      group: activeTab,
      name,
      members: [],
      activeOnMap: true,
      created_date: todayISO()
    };
    setSettings((prev) => ({ ...prev, groupLists: [...prev.groupLists, newList] }));
    setIsNaming(false);
    setNewListName('');
  };

  const deleteList = (id: string) => {
    setSettings((prev) => ({ ...prev, groupLists: prev.groupLists.filter((l) => l.id !== id) }));
    if (openListId === id) setOpenListId(null);
  };

  return (
    <div className="setting-page">
      <header className="setting-header">
        <Link href="/" className="setting-back-btn">
          <ArrowLeft size={16} />
          กลับไปแผนที่
        </Link>
        <h1 className="setting-title">ตั้งค่า</h1>

        <span className={`setting-save-state ${saveState}`} title={saveMessage}>
          {saveState === 'saving' && 'กำลังบันทึก...'}
          {saveState === 'saved' && (ctx.isMock ? 'บันทึกในเครื่อง (โหมดจำลอง)' : 'บันทึกขึ้น BMS แล้ว')}
          {saveState === 'error' && (saveMessage || 'บันทึกไม่สำเร็จ')}
        </span>
      </header>

      <main className="setting-body">
        <div className="setting-tabs">
          {(Object.keys(GROUP_META) as GroupKind[]).map((kind) => {
            const count = settings.groupLists.filter((l) => l.group === kind).length;
            const Icon = GROUP_META[kind].icon;
            return (
              <button
                key={kind}
                type="button"
                className={`setting-tab-btn ${activeTab === kind ? 'active' : ''}`}
                onClick={() => setActiveTab(kind)}
                title={GROUP_META[kind].label}
              >
                <Icon size={15} />
                {GROUP_META[kind].short}
                {count > 0 && <span className="setting-tab-badge">{count}</span>}
              </button>
            );
          })}
        </div>

        <section className="setting-card">
          <div className="setting-grid-toolbar">
            <div>
              <h2>กลุ่มย่อยใน{GROUP_META[activeTab].label}</h2>
              <p>เพิ่มชื่อกลุ่มย่อยก่อน แล้วค่อยเพิ่มสมาชิกเข้าไปในแต่ละกลุ่ม</p>
            </div>
          </div>

          <div className="setting-grid-wrap">
            <table className="setting-grid">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>ลำดับ</th>
                  <th>ชื่อรายการ</th>
                  <th style={{ width: 110 }}>จำนวนสมาชิก</th>
                  <th style={{ width: 110 }}>ใช้งานแผนที่</th>
                  <th style={{ width: 150 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {listsOfTab.length === 0 && !isNaming && (
                  <tr>
                    <td colSpan={5} className="setting-grid-empty">
                      ยังไม่มีกลุ่มย่อยใน{GROUP_META[activeTab].label} — กดปุ่ม + ด้านล่างเพื่อเพิ่ม
                    </td>
                  </tr>
                )}
                {listsOfTab.map((list, i) => (
                    <tr key={list.id}>
                      <td className="font-mono">{i + 1}</td>
                      <td>
                        <input
                          type="text"
                          className="setting-grid-name"
                          value={list.name}
                          onChange={(e) => updateList(list.id, { name: e.target.value })}
                          aria-label="ชื่อรายการ"
                        />
                      </td>
                      <td className="font-mono">{list.members.length}</td>
                      <td>
                        <input
                          type="checkbox"
                          className="setting-switch"
                          checked={list.activeOnMap}
                          onChange={(e) => updateList(list.id, { activeOnMap: e.target.checked })}
                          aria-label="ใช้งานแผนที่"
                        />
                      </td>
                      <td>
                        <div className="setting-grid-actions">
                          <button
                            type="button"
                            className="setting-grid-btn"
                            onClick={() => setOpenListId(list.id)}
                          >
                            สมาชิก
                          </button>
                          <button
                            type="button"
                            className="setting-grid-btn danger"
                            onClick={() => deleteList(list.id)}
                            aria-label="ลบรายการ"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                {/* Last row: add a sub-group in place */}
                <tr className="setting-grid-add-row">
                  {isNaming ? (
                    <>
                      <td className="font-mono">{listsOfTab.length + 1}</td>
                      <td>
                        <input
                          id="new-list-name"
                          ref={nameInputRef}
                          type="text"
                          className="setting-grid-name naming"
                          placeholder={GROUP_META[activeTab].placeholder}
                          value={newListName}
                          onChange={(e) => setNewListName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') confirmCreate();
                            if (e.key === 'Escape') setIsNaming(false);
                          }}
                        />
                      </td>
                      <td className="font-mono">0</td>
                      <td>
                        <input type="checkbox" className="setting-switch" checked readOnly aria-label="ใช้งานแผนที่" />
                      </td>
                      <td>
                        <div className="setting-grid-actions">
                          <button
                            type="button"
                            className="setting-grid-btn primary"
                            onClick={confirmCreate}
                            disabled={!newListName.trim()}
                          >
                            สร้าง
                          </button>
                          <button type="button" className="setting-grid-btn" onClick={() => setIsNaming(false)}>
                            ยกเลิก
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <td colSpan={5}>
                      <button type="button" className="setting-add-row-btn" onClick={startNaming}>
                        <Plus size={15} />
                        เพิ่มกลุ่มย่อย
                      </button>
                    </td>
                  )}
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {openList && (
        <GroupMembersModal
          ctx={ctx}
          list={openList}
          onChange={(members) => updateList(openList.id, { members })}
          onClose={() => setOpenListId(null)}
        />
      )}
    </div>
  );
}
