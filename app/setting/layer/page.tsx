'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Ambulance, ArrowLeft, Handshake, LucideIcon, Plus, ShieldAlert, Trash2, Users } from 'lucide-react';
import { bootstrapAddon } from '@/lib/services/bmsClient';
import { AppSettings, DEFAULT_SETTINGS, loadSettings, saveSettings } from '@/lib/services/settingsStore';
import { AddonContext } from '@/lib/types/bms';
import { GroupKind, LayerSetting } from '@/lib/types/gis';
import LayerFeaturesModal from '@/components/modals/LayerFeaturesModal';

const GROUP_META: Record<GroupKind, { icon: LucideIcon; label: string }> = {
  vulnerable: { icon: Users, label: 'บุคคล – กลุ่มติดตามต่อเนื่อง' },
  epidemic: { icon: ShieldAlert, label: 'บุคคล – ระบาดวิทยา' },
  partner: { icon: Handshake, label: 'สถานที่ – ภาคีเครือข่าย' },
  resource: { icon: Ambulance, label: 'สถานที่ – ทรัพยากรสุขภาพ' }
};

const KINDS = Object.keys(GROUP_META) as GroupKind[];

export default function SettingLayerPage() {
  const [ctx, setCtx] = useState<AddonContext>({
    session: null,
    sessionId: undefined,
    mktToken: undefined,
    readOnly: false,
    isMock: true
  });
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [openLayerId, setOpenLayerId] = useState<string | null>(null);
  const [isNaming, setIsNaming] = useState(false);
  const [newLayerName, setNewLayerName] = useState('');
  const [newLayerKind, setNewLayerKind] = useState<GroupKind>('vulnerable');
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

  // Debounced write-back: typing a name must not fire one PUT per keystroke
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

  const openLayer = settings.layers.find((l) => l.id === openLayerId) || null;

  const updateLayer = (id: string, patch: Partial<LayerSetting>) => {
    setSettings((prev) => ({
      ...prev,
      layers: prev.layers.map((l) => (l.id === id ? { ...l, ...patch } : l))
    }));
  };

  const startNaming = () => {
    setNewLayerName('');
    setNewLayerKind('vulnerable');
    setIsNaming(true);
    setTimeout(() => nameInputRef.current?.focus(), 0);
  };

  const confirmCreate = () => {
    const name = newLayerName.trim();
    if (!name) return;
    const layer: LayerSetting = {
      id: `layer-${Date.now()}`,
      kind: newLayerKind,
      name,
      visible: true,
      features: []
    };
    setSettings((prev) => ({ ...prev, layers: [...prev.layers, layer] }));
    setIsNaming(false);
    setNewLayerName('');
  };

  const deleteLayer = (layer: LayerSetting) => {
    // Deleting a layer takes all of its features with it
    if (layer.features.length && !window.confirm(`ลบ "${layer.name}" พร้อมข้อมูล ${layer.features.length} รายการ?`)) return;
    setSettings((prev) => ({ ...prev, layers: prev.layers.filter((l) => l.id !== layer.id) }));
    if (openLayerId === layer.id) setOpenLayerId(null);
  };

  return (
    <div className="setting-page">
      <header className="setting-header">
        <Link href="/" className="setting-back-btn">
          <ArrowLeft size={16} />
          กลับไปแผนที่
        </Link>
        <h1 className="setting-title">ตั้งค่าชั้นข้อมูล</h1>

        <span className={`setting-save-state ${saveState}`} title={saveMessage}>
          {saveState === 'saving' && 'กำลังบันทึก...'}
          {saveState === 'saved' && (ctx.isMock ? 'บันทึกในเครื่อง (โหมดจำลอง)' : 'บันทึกขึ้น BMS แล้ว')}
          {saveState === 'error' && (saveMessage || 'บันทึกไม่สำเร็จ')}
        </span>
      </header>

      <main className="setting-body">
        <section className="setting-card">
          <div className="setting-grid-toolbar">
            <div>
              <h2>ชั้นข้อมูลบนแผนที่</h2>
              <p>เพิ่ม ลบ หรือแก้ชื่อชั้นข้อมูลได้ ปิดสวิตช์แสดงผลเพื่อซ่อนทั้งชั้นออกจากแผนที่</p>
            </div>
          </div>

          <div className="setting-grid-wrap">
            <table className="setting-grid">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>ลำดับ</th>
                  <th>ชื่อชั้นข้อมูล</th>
                  <th style={{ width: 110 }}>จำนวนข้อมูล</th>
                  <th style={{ width: 90 }}>แสดงผล</th>
                  <th style={{ width: 150 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {settings.layers.length === 0 && !isNaming && (
                  <tr>
                    <td colSpan={5} className="setting-grid-empty">
                      ยังไม่มีชั้นข้อมูล — กดปุ่มเพิ่มชั้นข้อมูลด้านล่าง
                    </td>
                  </tr>
                )}
                {settings.layers.map((layer, i) => {
                  const Icon = GROUP_META[layer.kind].icon;
                  return (
                    <tr key={layer.id}>
                      <td className="font-mono">{i + 1}</td>
                      <td>
                        <div className="setting-layer-name">
                          <Icon size={15} aria-label={GROUP_META[layer.kind].label} />
                          <input
                            type="text"
                            className="setting-grid-name"
                            value={layer.name}
                            onChange={(e) => updateLayer(layer.id, { name: e.target.value })}
                            aria-label="ชื่อชั้นข้อมูล"
                          />
                        </div>
                      </td>
                      <td className="font-mono">{layer.features.length}</td>
                      <td>
                        <input
                          type="checkbox"
                          className="setting-switch"
                          checked={layer.visible}
                          onChange={(e) => updateLayer(layer.id, { visible: e.target.checked })}
                          aria-label="แสดงผล"
                        />
                      </td>
                      <td>
                        <div className="setting-grid-actions">
                          <button
                            type="button"
                            className="setting-grid-btn"
                            onClick={() => setOpenLayerId(layer.id)}
                          >
                            <Plus size={13} />
                            เพิ่มข้อมูล
                          </button>
                          <button
                            type="button"
                            className="setting-grid-btn danger"
                            onClick={() => deleteLayer(layer)}
                            aria-label="ลบชั้นข้อมูล"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {/* Last row: add a layer in place */}
                <tr className="setting-grid-add-row">
                  {isNaming ? (
                    <>
                      <td className="font-mono">{settings.layers.length + 1}</td>
                      <td>
                        <div className="setting-layer-name">
                          <select
                            className="setting-grid-select"
                            value={newLayerKind}
                            onChange={(e) => setNewLayerKind(e.target.value as GroupKind)}
                            aria-label="ประเภทชั้นข้อมูล"
                          >
                            {KINDS.map((kind) => (
                              <option key={kind} value={kind}>
                                {GROUP_META[kind].label}
                              </option>
                            ))}
                          </select>
                          <input
                            ref={nameInputRef}
                            type="text"
                            className="setting-grid-name naming"
                            placeholder="ชื่อชั้นข้อมูลใหม่"
                            value={newLayerName}
                            onChange={(e) => setNewLayerName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') confirmCreate();
                              if (e.key === 'Escape') setIsNaming(false);
                            }}
                          />
                        </div>
                      </td>
                      <td className="font-mono">0</td>
                      <td>
                        <input type="checkbox" className="setting-switch" checked readOnly aria-label="แสดงผล" />
                      </td>
                      <td>
                        <div className="setting-grid-actions">
                          <button
                            type="button"
                            className="setting-grid-btn primary"
                            onClick={confirmCreate}
                            disabled={!newLayerName.trim()}
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
                        เพิ่มชั้นข้อมูล
                      </button>
                    </td>
                  )}
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {openLayer && (
        <LayerFeaturesModal
          ctx={ctx}
          layer={openLayer}
          onChange={(features) => updateLayer(openLayer.id, { features })}
          onClose={() => setOpenLayerId(null)}
        />
      )}
    </div>
  );
}
