'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { DEFAULT_MAP_CENTER, DEFAULT_ZOOM, HealthRiskCategory, House } from '@/lib/types/gis';

export type GisLayerDisplayMode = 'point' | 'cluster';
export type BaseTileLayer = 'osm' | 'satellite' | 'dark';

export interface MapViewProps {
  houses: House[];
  displayMode?: GisLayerDisplayMode;
  baseLayer?: BaseTileLayer;
  showHeatmap?: boolean;
  isPickMode?: boolean;
  pickingHouse?: House | null;
  pickedLat?: number | null;
  pickedLng?: number | null;
  selectedHouseId?: number | null;
  onHouseSelect: (house: House) => void;
  onCoordinatePicked?: (lat: number, lng: number) => void;
}

const TILE_PROVIDERS = {
  osm: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>'
  }
};

function getCategoryColor(category: HealthRiskCategory): string {
  switch (category) {
    case 'chronic': return '#ef4444';
    case 'vulnerable': return '#8b5cf6';
    case 'mch': return '#0ea5e9';
    case 'unmapped': return '#f59e0b';
    default: return '#10b981';
  }
}

export default function MapView({
  houses,
  displayMode = 'point',
  baseLayer = 'osm',
  showHeatmap = false,
  isPickMode = false,
  pickingHouse = null,
  pickedLat = null,
  pickedLng = null,
  selectedHouseId = null,
  onHouseSelect,
  onCoordinatePicked
}: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const currentTileLayerRef = useRef<any>(null);
  const vectorPointGroupRef = useRef<any>(null);
  const clusterGroupRef = useRef<any>(null);
  const heatCircleGroupRef = useRef<any>(null);
  const activePinMarkerRef = useRef<any>(null);
  const [cursorCoord, setCursorCoord] = useState<{ lat: number; lng: number }>({
    lat: DEFAULT_MAP_CENTER[0],
    lng: DEFAULT_MAP_CENTER[1]
  });

  // 1. Initialize Map
  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainerRef.current) return;
    let isMounted = true;

    async function initLeaflet() {
      const L = (await import('leaflet')).default;

      if (!isMounted || !mapContainerRef.current) return;
      if (mapInstanceRef.current) return; // already initialized

      const map = L.map(mapContainerRef.current, {
        center: DEFAULT_MAP_CENTER,
        zoom: DEFAULT_ZOOM,
        zoomControl: false
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Tile layer
      const provider = TILE_PROVIDERS[baseLayer] || TILE_PROVIDERS.osm;
      currentTileLayerRef.current = L.tileLayer(provider.url, {
        maxZoom: 19,
        attribution: provider.attribution
      }).addTo(map);

      // Vector Point Layer Group
      vectorPointGroupRef.current = L.layerGroup().addTo(map);

      // Heat Circle Group
      heatCircleGroupRef.current = L.layerGroup().addTo(map);

      // Cursor movement HUD
      map.on('mousemove', (e: any) => {
        setCursorCoord({ lat: e.latlng.lat, lng: e.latlng.lng });
      });

      // Map Click Handler for Pick Mode
      map.on('click', (e: any) => {
        if (onCoordinatePicked) {
          onCoordinatePicked(e.latlng.lat, e.latlng.lng);
        }
      });

      mapInstanceRef.current = map;
    }

    initLeaflet();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // 2. Handle Tile Layer changes
  useEffect(() => {
    if (!mapInstanceRef.current || typeof window === 'undefined') return;
    const map = mapInstanceRef.current;

    async function updateTile() {
      const L = (await import('leaflet')).default;
      if (currentTileLayerRef.current) {
        map.removeLayer(currentTileLayerRef.current);
      }
      const provider = TILE_PROVIDERS[baseLayer] || TILE_PROVIDERS.osm;
      currentTileLayerRef.current = L.tileLayer(provider.url, {
        maxZoom: 19,
        attribution: provider.attribution
      }).addTo(map);
    }

    updateTile();
  }, [baseLayer]);

  // 3. Render Houses (Point Layer vs Markers)
  useEffect(() => {
    if (!mapInstanceRef.current || typeof window === 'undefined') return;
    const map = mapInstanceRef.current;

    async function renderLayers() {
      const L = (await import('leaflet')).default;

      // Clear existing
      if (vectorPointGroupRef.current) {
        map.removeLayer(vectorPointGroupRef.current);
        vectorPointGroupRef.current.clearLayers();
      }
      if (heatCircleGroupRef.current) heatCircleGroupRef.current.clearLayers();
      if (clusterGroupRef.current) {
        map.removeLayer(clusterGroupRef.current);
        clusterGroupRef.current.clearLayers();
      }

      const validHouses = houses.filter(h => h.latitude !== null && h.longitude !== null);

      // Dynamically load leaflet.markercluster
      await import('leaflet.markercluster');

      // Create high-performance custom cluster group
      const clusterGroup = (L as any).markerClusterGroup({
        maxClusterRadius: 50, // รัศมีการรวมกลุ่มพิกัดที่อยู่ชิดกัน (50px)
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: true,
        zoomToBoundsOnClick: true,
        disableClusteringAtZoom: 18, // เมื่อซูมระดับ 18 จะแตกเป็นจุดเดี่ยวทั้งหมด
        spiderfyDistanceMultiplier: 1.5,
        iconCreateFunction: function (cluster: any) {
          const childMarkers = cluster.getAllChildMarkers();
          const count = childMarkers.length;

          // ตรวจสอบกลุ่มสุขภาพภายใน Cluster
          let hasVulnerable = false;
          let hasChronic = false;
          let hasMch = false;

          for (const m of childMarkers) {
            const h = (m as any).houseData as House | undefined;
            if (h?.has_vulnerable) hasVulnerable = true;
            if (h?.has_chronic) hasChronic = true;
            if (h?.has_mch) hasMch = true;
          }

          let colorClass = 'cluster-normal';
          if (hasVulnerable) colorClass = 'cluster-vulnerable';
          else if (hasChronic) colorClass = 'cluster-chronic';
          else if (hasMch) colorClass = 'cluster-mch';

          let sizeClass = 'cluster-sm';
          if (count >= 50) sizeClass = 'cluster-lg';
          else if (count >= 15) sizeClass = 'cluster-md';

          const iconSize = count >= 50 ? 54 : (count >= 15 ? 44 : 36);

          return L.divIcon({
            html: `
              <div class="custom-gis-cluster ${colorClass} ${sizeClass}">
                <div class="cluster-pulse-ring"></div>
                <span class="cluster-count">${count}</span>
              </div>
            `,
            className: 'cluster-marker-wrapper',
            iconSize: [iconSize, iconSize],
            iconAnchor: [iconSize / 2, iconSize / 2]
          });
        }
      });

      // Populate markers into the cluster group
      validHouses.forEach(house => {
        if (house.latitude === null || house.longitude === null) return;
        const pointColor = getCategoryColor(house.primary_health_category);
        const pinColorClass = `home-marker-${house.primary_health_category}`;

        // ==========================================
        // 🏠 House Marker: Home Icon Pin
        // ==========================================
        const homeIcon = L.divIcon({
          html: `
            <div class="custom-home-marker ${pinColorClass}">
              <div class="home-icon-bubble">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                  <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
              </div>
              <div class="home-pin-tip"></div>
            </div>
          `,
          className: 'home-marker-wrapper',
          iconSize: [30, 36],
          iconAnchor: [15, 36],
          popupAnchor: [0, -34]
        });

        const marker: any = L.marker([house.latitude, house.longitude], { icon: homeIcon });

        // Attach house metadata to marker for cluster calculation
        marker.houseData = house;

        // Tooltip
        marker.bindTooltip(`
          <div class="gis-point-tooltip">
            <strong>บ้านเลขที่ ${house.address}</strong> ม.${house.village_moo} ${house.village_name}<br/>
            <span class="font-mono text-muted">[Lat: ${house.latitude.toFixed(6)}, Lng: ${house.longitude.toFixed(6)}]</span>
          </div>
        `, { direction: 'top', offset: [0, -6], opacity: 0.95 });

        // Popup
        marker.bindPopup(createPopupContent(house), {
          className: 'custom-house-popup',
          maxWidth: 280
        });

        marker.on('popupopen', () => {
          const detailBtn = document.getElementById(`popup-btn-${house.house_id}`);
          detailBtn?.addEventListener('click', () => onHouseSelect(house));

          const navBtn = document.getElementById(`popup-nav-${house.house_id}`);
          navBtn?.addEventListener('click', () => {
            window.open(`https://www.google.com/maps/dir/?api=1&destination=${house.latitude},${house.longitude}`, '_blank');
          });
        });

        clusterGroup.addLayer(marker);

        // Heat density circle
        if (showHeatmap && heatCircleGroupRef.current) {
          const heatCircle = L.circle([house.latitude, house.longitude], {
            color: pointColor,
            fillColor: pointColor,
            fillOpacity: 0.22,
            radius: house.has_vulnerable ? 35 : (house.has_chronic ? 30 : 25),
            weight: 1
          });
          heatCircleGroupRef.current.addLayer(heatCircle);
        }
      });

      clusterGroupRef.current = clusterGroup;
      map.addLayer(clusterGroup);

      // Auto fit bounds if houses available
      if (validHouses.length > 0 && !isPickMode) {
        const bounds = L.latLngBounds(validHouses.map(h => [h.latitude!, h.longitude!]));
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
      }
    }

    renderLayers();
  }, [houses, displayMode, showHeatmap, isPickMode, onHouseSelect]);

  // 4. Fly to selected house
  useEffect(() => {
    if (!mapInstanceRef.current || !selectedHouseId) return;
    const target = houses.find(h => h.house_id === selectedHouseId);
    if (target && target.latitude !== null && target.longitude !== null) {
      mapInstanceRef.current.flyTo([target.latitude, target.longitude], 17, { duration: 1.2 });
    }
  }, [selectedHouseId, houses]);

  // 5. Handle Pin Picking Marker
  useEffect(() => {
    if (!mapInstanceRef.current || typeof window === 'undefined') return;
    const map = mapInstanceRef.current;

    async function updatePicker() {
      const L = (await import('leaflet')).default;

      if (isPickMode && pickingHouse) {
        map.getContainer().classList.add('map-pick-cursor');
        const lat = pickedLat || pickingHouse.latitude || DEFAULT_MAP_CENTER[0];
        const lng = pickedLng || pickingHouse.longitude || DEFAULT_MAP_CENTER[1];

        if (!activePinMarkerRef.current) {
          const dragIcon = L.divIcon({
            html: `
              <div class="custom-house-pin pin-picking animate-bounce">
                <div class="pin-bubble">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
                </div>
                <div class="pin-point"></div>
              </div>
            `,
            className: 'house-marker-wrapper',
            iconSize: [36, 44],
            iconAnchor: [18, 44]
          });

          activePinMarkerRef.current = L.marker([lat, lng], {
            draggable: true,
            icon: dragIcon,
            zIndexOffset: 1000
          }).addTo(map);

          activePinMarkerRef.current.on('dragend', () => {
            if (activePinMarkerRef.current && onCoordinatePicked) {
              const pos = activePinMarkerRef.current.getLatLng();
              onCoordinatePicked(pos.lat, pos.lng);
            }
          });
        } else {
          activePinMarkerRef.current.setLatLng([lat, lng]);
        }
      } else {
        map.getContainer().classList.remove('map-pick-cursor');
        if (activePinMarkerRef.current) {
          map.removeLayer(activePinMarkerRef.current);
          activePinMarkerRef.current = null;
        }
      }
    }

    updatePicker();
  }, [isPickMode, pickingHouse, pickedLat, pickedLng, onCoordinatePicked]);

  return (
    <div className="relative w-full h-full" style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={mapContainerRef} id="map-container" style={{ width: '100%', height: '100%' }} />
      <div id="map-coord-hud" className="map-coord-hud">
        พิกัดเคอร์เซอร์: Lat {cursorCoord.lat.toFixed(6)}, Lng {cursorCoord.lng.toFixed(6)}
      </div>
    </div>
  );
}

function createPopupContent(house: House): string {
  let healthTag = `<span class="health-tag tag-normal">ปกติ</span>`;
  if (house.has_vulnerable) {
    healthTag = `<span class="health-tag tag-vulnerable">กลุ่มเปราะบาง/ติดเตียง</span>`;
  } else if (house.has_chronic) {
    healthTag = `<span class="health-tag tag-chronic">ผู้ป่วยเรื้อรัง NCD</span>`;
  } else if (house.has_mch) {
    healthTag = `<span class="health-tag tag-mch">หญิงตั้งครรภ์/ทารก</span>`;
  }

  const headName = house.head_person_name || 'ไม่ระบุเจ้าบ้าน';
  const residentsCount = house.residents.length || 1;

  return `
    <div class="house-popup-card">
      <div class="popup-header">
        <div class="popup-title">บ้านเลขที่ <strong>${house.address}</strong></div>
        ${healthTag}
      </div>
      <div class="popup-village">หมู่ ${house.village_moo} ${house.village_name}</div>
      <div class="popup-body">
        <div class="popup-row">
          <span class="popup-label">เจ้าบ้าน:</span>
          <span class="popup-val">${headName}</span>
        </div>
        <div class="popup-row">
          <span class="popup-label">สมาชิก:</span>
          <span class="popup-val">${residentsCount} คน</span>
        </div>
        <div class="popup-row">
          <span class="popup-label">พิกัดตาราง house:</span>
          <span class="popup-val font-mono" style="color: #0284c7;">Lat: ${house.latitude?.toFixed(6)}, Lng: ${house.longitude?.toFixed(6)}</span>
        </div>
      </div>
      <div class="popup-actions">
        <button id="popup-btn-${house.house_id}" class="popup-btn popup-btn-primary">
          ดูรายละเอียด
        </button>
        <button id="popup-nav-${house.house_id}" class="popup-btn popup-btn-nav" title="เปิดแผนที่นำทาง">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
          นำทาง
        </button>
      </div>
    </div>
  `;
}
