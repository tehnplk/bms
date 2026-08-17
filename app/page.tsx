'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { bootstrapAddon, updateHouseLocation } from '@/lib/services/bmsClient';
import { dataService } from '@/lib/services/dataService';
import { AddonContext } from '@/lib/types/bms';
import { HealthRiskCategory, House, Village } from '@/lib/types/gis';
import { AppSettings, DEFAULT_SETTINGS, loadSettings } from '@/lib/services/settingsStore';
import { BaseTileLayer, PlacePoint } from '@/components/gis/MapView';
import Navbar from '@/components/layout/Navbar';
import RightPanel from '@/components/drawers/RightPanel';
import HouseModal from '@/components/modals/HouseModal';
import { useToast } from '@/components/ui/Toast';

// SSR-Safe dynamic import for Leaflet MapView
const MapView = dynamic(() => import('@/components/gis/MapView'), {
  ssr: false,
  loading: () => (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', color: '#64748b' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: 6 }}>🗺️ กำลังโหลดแผนที่ GIS...</div>
        <div style={{ fontSize: '0.85rem' }}>ดึงข้อมูลพิกัดบ้านจากฐานข้อมูล HOSxP</div>
      </div>
    </div>
  )
});

export default function CatchmentGisPage() {
  const { showToast } = useToast();
  const [ctx, setCtx] = useState<AddonContext>({
    session: null,
    sessionId: undefined,
    mktToken: undefined,
    readOnly: false,
    isMock: false
  });
  const [villages, setVillages] = useState<Village[]>([]);
  const [houses, setHouses] = useState<House[]>([]);
  const [selectedVillageId, setSelectedVillageId] = useState<number | 'all'>('all');
  const [healthGroup, setHealthGroup] = useState<HealthRiskCategory | 'all'>('all');
  // Configured on /setting and shared through localStorage
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [baseLayer, setBaseLayer] = useState<BaseTileLayer>('osm');
  const [selectedHouse, setSelectedHouse] = useState<House | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const [loading, setLoading] = useState(true);

  // Load Data directly from HOSxP tables 'house' & 'village'
  const loadData = useCallback(async (currentCtx: AddonContext) => {
    try {
      setLoading(true);
      const vList = await dataService.getVillages(currentCtx);
      const hList = await dataService.getHouses(currentCtx);
      setVillages(vList);
      setHouses(hList);
    } catch (err) {
      console.error('Failed to load catchment data:', err);
      showToast('ไม่สามารถดึงข้อมูลพิกัดบ้านจาก HOSxP ได้', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // Initial Bootstrap on Mount
  useEffect(() => {
    async function initApp() {
      try {
        const initialCtx = await bootstrapAddon();
        setCtx(initialCtx);
        setSettings(await loadSettings(initialCtx));
        await loadData(initialCtx);
      } catch (err) {
        console.error('App init error:', err);
      }
    }
    initApp();
  }, [loadData]);

  // Re-classify houses against the criteria and case list configured on /setting
  const classifiedHouses = useMemo(() => {
    const { vulnerableCriteria, groupLists } = settings;

    // Only lists switched on for the map contribute members
    const houseIdsOf = (group: 'vulnerable' | 'epidemic') =>
      new Set(
        groupLists
          .filter((l) => l.group === group && l.activeOnMap)
          .flatMap((l) => l.members.map((m) => m.house_id))
      );
    const vulnerableListHouseIds = houseIdsOf('vulnerable');
    const epidemicHouseIds = houseIdsOf('epidemic');

    return houses.map((h) => {
      // Automatic classification, plus anyone enrolled in an active list
      const hasVulnerable =
        vulnerableListHouseIds.has(h.house_id) ||
        h.residents.some((r) =>
          (r.age !== undefined && r.age >= vulnerableCriteria.elderlyAge) ||
          (vulnerableCriteria.includeDisabled && !!r.is_disabled) ||
          (vulnerableCriteria.includeBedridden && !!r.is_bedridden)
        );
      const hasEpidemic = epidemicHouseIds.has(h.house_id);
      const isMapped = h.latitude !== null && h.longitude !== null;

      let category: HealthRiskCategory = 'normal';
      if (!isMapped) category = 'unmapped';
      else if (hasEpidemic) category = 'epidemic';
      else if (hasVulnerable) category = 'vulnerable';
      else if (h.has_chronic) category = 'chronic';
      else if (h.has_mch) category = 'mch';

      return { ...h, has_vulnerable: hasVulnerable, has_epidemic: hasEpidemic, primary_health_category: category };
    });
  }, [houses, settings]);

  // Partner / resource points from lists switched on for the map
  const placePoints = useMemo<PlacePoint[]>(() => {
    return settings.groupLists
      .filter((l) => l.activeOnMap && (l.group === 'partner' || l.group === 'resource'))
      .flatMap((l) =>
        l.members
          .filter((m) => m.latitude !== undefined && m.longitude !== undefined)
          .map((m) => ({
            id: m.place_id || `${l.id}-${m.place_name}`,
            name: m.place_name || 'ไม่ระบุชื่อ',
            latitude: m.latitude as number,
            longitude: m.longitude as number,
            note: m.note,
            group: l.group as 'partner' | 'resource',
            listName: l.name
          }))
      );
  }, [settings]);

  // Filter houses by village and follow-up group selection
  const displayedHouses = useMemo(() => {
    return classifiedHouses.filter((h) => {
      if (selectedVillageId !== 'all' && h.village_id !== selectedVillageId) return false;
      if (healthGroup === 'chronic' && !h.has_chronic) return false;
      if (healthGroup === 'vulnerable' && !h.has_vulnerable) return false;
      if (healthGroup === 'mch' && !h.has_mch) return false;
      if (healthGroup === 'epidemic' && !h.has_epidemic) return false;
      if (healthGroup === 'unmapped' && h.latitude !== null && h.longitude !== null) return false;
      return true;
    });
  }, [classifiedHouses, selectedVillageId, healthGroup]);

  // Select house handler from Search Bar or Map Marker or Right Panel
  const handleSelectHouse = (house: House, openModal = false) => {
    // A house found by server-side search may not be part of the loaded set yet
    setHouses((prev) =>
      prev.some((h) => h.house_id === house.house_id) ? prev : [...prev, house]
    );

    // Otherwise the village filter would hide the house the user just picked
    if (selectedVillageId !== 'all' && house.village_id !== selectedVillageId) {
      setSelectedVillageId('all');
    }

    setSelectedHouse(house);
    if (openModal || (house.latitude === null && house.longitude === null)) {
      setIsModalOpen(true);
    }
  };

  // Stable identity, otherwise MapView tears down and rebuilds every marker
  // on each parent re-render (village filter, base layer switch, ...)
  const handleMarkerSelect = useCallback((house: House) => {
    setSelectedHouse(house);
    setIsModalOpen(true);
  }, []);

  // Save coordinate back to HOSxP table 'house'
  const handleSaveCoordinate = async (houseId: number, lat: number, lng: number) => {
    try {
      const res = await updateHouseLocation(ctx, houseId, lat, lng);
      if (res.success) {
        dataService.updateLocalCoordinate(houseId, lat, lng);
        const updatedHouses = await dataService.getHouses(ctx);
        // Keep houses that only exist in state because server-side search pulled them in
        setHouses((prev) => {
          const extras = prev
            .filter((p) => !updatedHouses.some((u) => u.house_id === p.house_id))
            .map((p) => (p.house_id === houseId ? dataService.applyCoordinate(p, lat, lng) : p));
          return [...updatedHouses, ...extras];
        });
        if (selectedHouse && selectedHouse.house_id === houseId) {
          setSelectedHouse(dataService.applyCoordinate(selectedHouse, lat, lng));
        }
        showToast(res.message || 'บันทึกพิกัดบ้านลง HOSxP เรียบร้อยแล้ว', 'success');
      } else {
        showToast(res.message || 'เกิดข้อผิดพลาดในการบันทึกพิกัด', 'error');
      }
    } catch (e: any) {
      console.error('Failed to update house coordinate:', e);
      showToast('เกิดข้อผิดพลาดในการบันทึกพิกัดบ้าน', 'error');
    }
  };

  return (
    <div id="app-container" style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* 1. Top Navbar with Live Resident/House Search and Village Filter */}
      <Navbar
        ctx={ctx}
        villages={villages}
        houses={houses}
        selectedVillageId={selectedVillageId}
        onVillageChange={(vId) => setSelectedVillageId(vId)}
        healthGroup={healthGroup}
        onHealthGroupChange={(g) => setHealthGroup(g)}
        totalHouses={houses.length}
        onSelectHouse={(h) => handleSelectHouse(h, false)}
        isRightPanelOpen={isRightPanelOpen}
        onToggleRightPanel={() => setIsRightPanelOpen(prev => !prev)}
      />

      {/* 2. Main GIS Map Viewport & Collapsible Right Panel */}
      <div className="main-content-layout">
        {/* Map Viewport Area */}
        <main className={`map-viewport-container ${isRightPanelOpen ? 'panel-open' : 'panel-closed'}`}>
          <MapView
            houses={displayedHouses}
            displayMode="point"
            baseLayer={baseLayer}
            showHeatmap={settings.showHeatmap}
            isPickMode={false}
            pickingHouse={null}
            pickedLat={null}
            pickedLng={null}
            selectedHouseId={selectedHouse?.house_id}
            placePoints={placePoints}
            onHouseSelect={handleMarkerSelect}
            onBaseLayerChange={(l) => setBaseLayer(l)}
          />
        </main>

        {/* Right Collapsible Panel */}
        <RightPanel
          isOpen={isRightPanelOpen}
          onToggle={() => setIsRightPanelOpen(prev => !prev)}
          villages={villages}
          houses={houses}
          displayedHouses={displayedHouses}
          selectedVillageId={selectedVillageId}
          onVillageChange={(vId) => setSelectedVillageId(vId)}
          selectedHouse={selectedHouse}
          onSelectHouse={(h) => handleSelectHouse(h, false)}
          onEditCoordinate={(h) => {
            setSelectedHouse(h);
            setIsModalOpen(true);
          }}
          onNavigate={(lat, lng) => {
            window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
          }}
        />
      </div>

      {/* 3. House Details & Coordinate Edit Modal */}
      {isModalOpen && selectedHouse && (
        <HouseModal
          house={selectedHouse}
          onSaveCoordinate={handleSaveCoordinate}
          onNavigate={(lat, lng) => {
            window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
          }}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
}
