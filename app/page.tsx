'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { bootstrapAddon, updateHouseLocation } from '@/lib/services/bmsClient';
import { dataService } from '@/lib/services/dataService';
import { AddonContext } from '@/lib/types/bms';
import { House, Village } from '@/lib/types/gis';
import { BaseTileLayer } from '@/components/gis/MapView';
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
        await loadData(initialCtx);
      } catch (err) {
        console.error('App init error:', err);
      }
    }
    initApp();
  }, [loadData]);

  // Filter houses by village selection
  const displayedHouses = useMemo(() => {
    if (selectedVillageId === 'all') return houses;
    return houses.filter((h) => h.village_id === selectedVillageId);
  }, [houses, selectedVillageId]);

  // Select house handler from Search Bar or Map Marker or Right Panel
  const handleSelectHouse = (house: House, openModal = false) => {
    setSelectedHouse(house);
    if (openModal || (house.latitude === null && house.longitude === null)) {
      setIsModalOpen(true);
    }
  };

  // Save coordinate back to HOSxP table 'house'
  const handleSaveCoordinate = async (houseId: number, lat: number, lng: number) => {
    try {
      const res = await updateHouseLocation(ctx, houseId, lat, lng);
      if (res.success) {
        dataService.updateLocalCoordinate(houseId, lat, lng);
        const updatedHouses = await dataService.getHouses(ctx);
        setHouses([...updatedHouses]);
        if (selectedHouse && selectedHouse.house_id === houseId) {
          setSelectedHouse({ ...selectedHouse, latitude: lat, longitude: lng });
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
        hospitalName={ctx.session?.hospitalName || 'BMS Dev Portal Hospital'}
        hospitalCode={ctx.session?.hospitalCode || 'DEV99'}
        villages={villages}
        houses={houses}
        selectedVillageId={selectedVillageId}
        onVillageChange={(vId) => setSelectedVillageId(vId)}
        baseLayer={baseLayer}
        onBaseLayerChange={(l) => setBaseLayer(l)}
        totalHouses={houses.length}
        onSelectHouse={(h) => handleSelectHouse(h, false)}
        isRightPanelOpen={isRightPanelOpen}
        onToggleRightPanel={() => setIsRightPanelOpen(prev => !prev)}
        onRefresh={() => loadData(ctx)}
      />

      {/* 2. Main GIS Map Viewport & Collapsible Right Panel */}
      <div className="main-content-layout">
        {/* Map Viewport Area */}
        <main className={`map-viewport-container ${isRightPanelOpen ? 'panel-open' : 'panel-closed'}`}>
          <MapView
            houses={displayedHouses}
            displayMode="point"
            baseLayer={baseLayer}
            showHeatmap={false}
            isPickMode={false}
            pickingHouse={null}
            pickedLat={null}
            pickedLng={null}
            selectedHouseId={selectedHouse?.house_id}
            onHouseSelect={(h) => {
              setSelectedHouse(h);
              setIsModalOpen(true);
            }}
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
          onStartPinPick={() => {}}
          onNavigate={(lat, lng) => {
            window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
          }}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
}
