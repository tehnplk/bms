'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Ruler, Pentagon, CircleDashed, Trash2 } from 'lucide-react';
import { DEFAULT_MAP_CENTER, DEFAULT_ZOOM, HealthRiskCategory, House, TILE_PROVIDERS } from '@/lib/types/gis';

export type GisLayerDisplayMode = 'point' | 'cluster';
export type BaseTileLayer = 'osm' | 'satellite' | 'dark';
export type MapTool = 'none' | 'distance' | 'polygon' | 'radius';

export interface PlacePoint {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  note?: string;
  group: 'partner' | 'resource';
  listName: string;
}

const PLACE_STYLE = {
  partner: { color: '#7c3aed', label: 'ภาคีเครือข่าย' },
  resource: { color: '#0d9488', label: 'ทรัพยากรสุขภาพ' }
};

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
  /** Partner / resource points from lists switched on for the map */
  placePoints?: PlacePoint[];
  onHouseSelect: (house: House) => void;
  onBaseLayerChange?: (layer: BaseTileLayer) => void;
  onCoordinatePicked?: (lat: number, lng: number) => void;
}

const BASE_LAYER_OPTIONS: Array<{ id: BaseTileLayer; label: string; title: string }> = [
  { id: 'osm', label: 'แผนที่', title: 'แผนที่ถนนมาตรฐาน (OpenStreetMap)' },
  { id: 'satellite', label: 'ดาวเทียม', title: 'ภาพถ่ายดาวเทียมความละเอียดสูง (Esri Satellite)' },
  { id: 'dark', label: 'โหมดมืด', title: 'แผนที่โทนมืด (CartoDB Dark)' }
];

// Indigo, kept clear of every health-category marker colour
const DRAW_COLOR = '#4f46e5';
// interactive:false keeps drawn shapes from swallowing the map clicks that drive
// the tools, and from covering the house markers underneath them
const DRAW_STYLE = {
  color: DRAW_COLOR,
  weight: 2.5,
  fillColor: DRAW_COLOR,
  fillOpacity: 0.12,
  interactive: false
};
const SQM_PER_RAI = 1600;

function formatDistance(meters: number): string {
  return meters < 1000 ? `${meters.toFixed(0)} ม.` : `${(meters / 1000).toFixed(2)} กม.`;
}

function formatArea(sqm: number): string {
  const main = sqm < 1000000 ? `${sqm.toFixed(0)} ตร.ม.` : `${(sqm / 1000000).toFixed(3)} ตร.กม.`;
  return `${main} · ${(sqm / SQM_PER_RAI).toFixed(2)} ไร่`;
}

/**
 * Geodesic polygon area in square metres (spherical excess on the WGS84 mean radius).
 * Planar shoelace would understate area at Thai latitudes.
 */
function geodesicAreaSqm(points: Array<{ lat: number; lng: number }>): number {
  if (points.length < 3) return 0;
  const R = 6378137;
  const rad = Math.PI / 180;
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    total += (p2.lng - p1.lng) * rad * (2 + Math.sin(p1.lat * rad) + Math.sin(p2.lat * rad));
  }
  return Math.abs((total * R * R) / 2);
}

function getCategoryColor(category: HealthRiskCategory): string {
  switch (category) {
    case 'epidemic': return '#be123c';
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
  placePoints = [],
  onHouseSelect,
  onBaseLayerChange,
  onCoordinatePicked
}: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const currentTileLayerRef = useRef<any>(null);
  const vectorPointGroupRef = useRef<any>(null);
  const clusterGroupRef = useRef<any>(null);
  const markerByHouseIdRef = useRef<Record<number, any>>({});
  const heatCircleGroupRef = useRef<any>(null);
  const activePinMarkerRef = useRef<any>(null);
  const hasAutoFittedRef = useRef(false);
  // Leaflet is imported asynchronously, so the layer effects below must wait for it
  const [isMapReady, setIsMapReady] = useState(false);
  const [cursorCoord, setCursorCoord] = useState<{ lat: number; lng: number }>({
    lat: DEFAULT_MAP_CENTER[0],
    lng: DEFAULT_MAP_CENTER[1]
  });

  // --- Measure / draw toolbox ---
  const leafletRef = useRef<any>(null);
  const measureGroupRef = useRef<any>(null);
  const draftRef = useRef<any>(null);
  const activeToolRef = useRef<MapTool>('none');
  const [activeTool, setActiveTool] = useState<MapTool>('none');
  const [shapeCount, setShapeCount] = useState(0);

  const buildLabel = useCallback((latlng: any, text: string) => {
    const L = leafletRef.current;
    return L.marker(latlng, {
      interactive: false,
      icon: L.divIcon({
        className: 'map-measure-label-wrapper',
        html: `<span class="map-measure-label">${text}</span>`,
        iconSize: [0, 0]
      })
    });
  }, []);

  /** Build the layers for a shape; dashed while drafting, solid once committed */
  const buildShape = useCallback((tool: MapTool, points: any[], cursor: any | null, dashed: boolean) => {
    const L = leafletRef.current;
    const map = mapInstanceRef.current;
    const style = dashed ? { ...DRAW_STYLE, dashArray: '6 6' } : DRAW_STYLE;
    const layers: any[] = [];
    let label: any = null;

    if (tool === 'radius') {
      const center = points[0];
      if (!center) return null;
      const edge = cursor || points[1];
      const radius = edge ? map.distance(center, edge) : 0;
      layers.push(L.circle(center, { ...style, radius }));
      layers.push(L.circleMarker(center, { ...DRAW_STYLE, radius: 4, fillOpacity: 1 }));
      label = buildLabel(center, `รัศมี ${formatDistance(radius)}`);
    } else {
      const pts = cursor ? [...points, cursor] : points;
      if (pts.length < 2) return null;

      if (tool === 'distance') {
        layers.push(L.polyline(pts, style));
        let total = 0;
        for (let i = 1; i < pts.length; i++) total += map.distance(pts[i - 1], pts[i]);
        label = buildLabel(pts[pts.length - 1], formatDistance(total));
      } else {
        layers.push(L.polygon(pts, style));
        if (pts.length >= 3) {
          label = buildLabel(L.latLngBounds(pts).getCenter(), formatArea(geodesicAreaSqm(pts)));
        }
      }
      pts.forEach((p) => layers.push(L.circleMarker(p, { ...DRAW_STYLE, radius: 4, fillOpacity: 1 })));
    }

    if (label) layers.push(label);
    return L.layerGroup(layers);
  }, [buildLabel]);

  const clearDraft = useCallback(() => {
    const map = mapInstanceRef.current;
    if (map && draftRef.current?.preview) map.removeLayer(draftRef.current.preview);
    draftRef.current = null;
  }, []);

  /** Switch the active tool and the map cursor with it — 'none' restores pan mode */
  const setTool = useCallback((tool: MapTool) => {
    activeToolRef.current = tool;
    setActiveTool(tool);

    const map = mapInstanceRef.current;
    if (!map) return;
    map.getContainer().classList.toggle('map-draw-cursor', tool !== 'none');
    if (tool === 'none') map.doubleClickZoom.enable();
    else map.doubleClickZoom.disable();
  }, []);

  const renderDraft = useCallback((cursor: any | null) => {
    const map = mapInstanceRef.current;
    const draft = draftRef.current;
    if (!map || !draft) return;

    if (draft.preview) map.removeLayer(draft.preview);
    draft.preview = buildShape(draft.tool, draft.points, cursor, true);
    if (draft.preview) draft.preview.addTo(map);
  }, [buildShape]);

  const commitDraft = useCallback(() => {
    const draft = draftRef.current;
    if (!draft) return;

    // A double-click lands its own click first, leaving the last vertex duplicated
    const points = draft.points.filter((p: any, i: number, arr: any[]) =>
      i === 0 || Math.abs(p.lat - arr[i - 1].lat) > 1e-9 || Math.abs(p.lng - arr[i - 1].lng) > 1e-9
    );

    const minPoints = draft.tool === 'polygon' ? 3 : 2;
    if (points.length >= minPoints) {
      const shape = buildShape(draft.tool, points, null, false);
      if (shape) {
        measureGroupRef.current.addLayer(shape);
        setShapeCount((n) => n + 1);
      }
    }
    clearDraft();
    // The feature is finished — hand the map back in pan mode
    setTool('none');
  }, [buildShape, clearDraft, setTool]);

  const handleToolClick = useCallback((latlng: any) => {
    const tool = activeToolRef.current;
    if (tool === 'none') return;

    if (!draftRef.current) {
      draftRef.current = { tool, points: [latlng], preview: null };
      renderDraft(null);
      return;
    }

    draftRef.current.points.push(latlng);
    // A radius is fully defined by its centre and one edge point
    if (tool === 'radius') commitDraft();
    else renderDraft(null);
  }, [renderDraft, commitDraft]);

  const selectTool = useCallback((tool: MapTool) => {
    clearDraft();
    setTool(activeToolRef.current === tool ? 'none' : tool);
  }, [clearDraft, setTool]);

  const clearAllShapes = useCallback(() => {
    clearDraft();
    measureGroupRef.current?.clearLayers();
    setShapeCount(0);
  }, [clearDraft]);

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

      // Measure / draw toolbox layer
      leafletRef.current = L;
      measureGroupRef.current = L.layerGroup().addTo(map);

      // Cursor movement HUD
      map.on('mousemove', (e: any) => {
        setCursorCoord({ lat: e.latlng.lat, lng: e.latlng.lng });
        if (draftRef.current) renderDraft(e.latlng);
      });

      // Map Click Handler for Pick Mode
      map.on('click', (e: any) => {
        if (activeToolRef.current !== 'none') {
          handleToolClick(e.latlng);
          return;
        }
        if (onCoordinatePicked) {
          onCoordinatePicked(e.latlng.lat, e.latlng.lng);
        }
      });

      // Double-click closes a distance line or polygon
      map.on('dblclick', () => {
        if (activeToolRef.current === 'distance' || activeToolRef.current === 'polygon') {
          commitDraft();
        }
      });

      mapInstanceRef.current = map;
      setIsMapReady(true);
    }

    initLeaflet();

    return () => {
      isMounted = false;
      setIsMapReady(false);
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

      markerByHouseIdRef.current = {};
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
        markerByHouseIdRef.current[house.house_id] = marker;

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

      // Auto fit bounds once only — re-rendering the layers must never move the
      // view the user has panned or zoomed to (e.g. after switching base layer)
      if (validHouses.length > 0 && !isPickMode && !hasAutoFittedRef.current) {
        hasAutoFittedRef.current = true;
        const bounds = L.latLngBounds(validHouses.map(h => [h.latitude!, h.longitude!]));
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
      }
    }

    renderLayers();
  }, [isMapReady, houses, displayMode, showHeatmap, isPickMode, onHouseSelect]);

  // 3b. Partner / resource points
  useEffect(() => {
    const map = mapInstanceRef.current;
    const L = leafletRef.current;
    if (!isMapReady || !map || !L) return;

    const group = L.layerGroup().addTo(map);

    placePoints.forEach((p) => {
      const style = PLACE_STYLE[p.group];
      const icon = L.divIcon({
        html: `
          <div class="place-marker" style="--place-color: ${style.color}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
        `,
        className: 'place-marker-wrapper',
        iconSize: [28, 28],
        iconAnchor: [14, 28],
        popupAnchor: [0, -26]
      });

      L.marker([p.latitude, p.longitude], { icon })
        .bindPopup(`
          <div class="house-popup-card">
            <div class="popup-header">
              <div class="popup-title"><strong>${p.name}</strong></div>
              <span class="health-tag" style="background:${style.color}1a;color:${style.color}">${style.label}</span>
            </div>
            <div class="popup-village">${p.listName}</div>
            ${p.note ? `<div class="popup-body"><div class="popup-row"><span class="popup-val">${p.note}</span></div></div>` : ''}
          </div>
        `, { className: 'custom-house-popup', maxWidth: 260 })
        .addTo(group);
    });

    return () => {
      map.removeLayer(group);
    };
  }, [isMapReady, placePoints]);

  // 4. Fly to the selected house, then open its info popup on arrival
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !selectedHouseId) return;

    const target = houses.find(h => h.house_id === selectedHouseId);
    if (!target || target.latitude === null || target.longitude === null) return;

    const revealPopup = () => {
      // Looked up on arrival, not now: the marker layer may still be rendering
      const marker = markerByHouseIdRef.current[selectedHouseId];
      if (marker && map.hasLayer(marker)) {
        marker.openPopup();
        return;
      }

      // Marker still grouped in a cluster: show the same card anchored to the
      // house rather than zooming further, which would push other markers away
      const L = leafletRef.current;
      if (!L) return;
      L.popup({ className: 'custom-house-popup', maxWidth: 280 })
        .setLatLng([target.latitude, target.longitude])
        .setContent(createPopupContent(target))
        .openOn(map);

      document.getElementById(`popup-btn-${target.house_id}`)
        ?.addEventListener('click', () => onHouseSelect(target));
      document.getElementById(`popup-nav-${target.house_id}`)
        ?.addEventListener('click', () => {
          window.open(`https://www.google.com/maps/dir/?api=1&destination=${target.latitude},${target.longitude}`, '_blank');
        });
    };

    // Zoom 18 is where disableClusteringAtZoom splits every cluster, so the
    // house gets its own marker while its neighbours all stay on the map
    map.flyTo([target.latitude, target.longitude], 18, { duration: 1.2 });
    map.once('moveend', revealPopup);

    return () => map.off('moveend', revealPopup);
  }, [selectedHouseId, houses, onHouseSelect]);

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

  // 6. Keep Leaflet's viewport in sync with the container size. Collapsing the
  // right panel widens the map, and without this Leaflet leaves the new strip
  // blank because it still believes the container is the old width.
  useEffect(() => {
    const container = mapContainerRef.current;
    const map = mapInstanceRef.current;
    if (!isMapReady || !container || !map) return;

    // pan:false keeps what is already on screen still and just reveals more map
    const observer = new ResizeObserver(() => {
      map.invalidateSize({ animate: false, pan: false });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [isMapReady]);

  // 7. Escape cancels the shape being drawn, then leaves the tool
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape' || activeToolRef.current === 'none') return;
      if (draftRef.current) clearDraft();
      else selectTool('none');
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clearDraft, selectTool]);

  const TOOLS: Array<{ id: MapTool; icon: React.ReactNode; label: string; hint: string }> = [
    {
      id: 'distance',
      icon: <Ruler size={16} />,
      label: 'วัดระยะ',
      hint: 'คลิกวางจุดต่อเนื่อง — ดับเบิลคลิกเพื่อจบเส้น'
    },
    {
      id: 'polygon',
      icon: <Pentagon size={16} />,
      label: 'วาด Polygon',
      hint: 'คลิกวางมุมอย่างน้อย 3 จุด — ดับเบิลคลิกเพื่อปิดรูป'
    },
    {
      id: 'radius',
      icon: <CircleDashed size={16} />,
      label: 'วาดรัศมี',
      hint: 'คลิกจุดศูนย์กลาง แล้วคลิกอีกครั้งเพื่อกำหนดรัศมี'
    }
  ];

  const activeHint = TOOLS.find((t) => t.id === activeTool)?.hint;

  return (
    <div className="relative w-full h-full" style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={mapContainerRef} id="map-container" style={{ width: '100%', height: '100%' }} />

      {/* Measure & draw toolbox */}
      <div className="map-toolbox">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            type="button"
            className={`map-tool-btn ${activeTool === tool.id ? 'active' : ''}`}
            onClick={() => selectTool(tool.id)}
            title={`${tool.label} — ${tool.hint}`}
            aria-pressed={activeTool === tool.id}
          >
            {tool.icon}
          </button>
        ))}
        <div className="map-tool-divider" />
        <button
          type="button"
          className="map-tool-btn map-tool-clear"
          onClick={clearAllShapes}
          disabled={shapeCount === 0}
          title={shapeCount === 0 ? 'ยังไม่มีรูปที่วาด' : `ล้างรูปที่วาดทั้งหมด (${shapeCount})`}
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Base layer switcher */}
      {onBaseLayerChange && (
        <div className="map-tile-switch">
          <div className="tile-toggle-group">
            {BASE_LAYER_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`tile-toggle-btn ${baseLayer === opt.id ? 'active' : ''}`}
                onClick={() => onBaseLayerChange(opt.id)}
                title={opt.title}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {activeHint && (
        <div className="map-tool-hint">
          {activeHint} · กด <kbd>Esc</kbd> เพื่อยกเลิก
        </div>
      )}

      <div id="map-coord-hud" className="map-coord-hud">
        {cursorCoord.lat.toFixed(6)}, {cursorCoord.lng.toFixed(6)}
      </div>
    </div>
  );
}

function createPopupContent(house: House): string {
  let healthTag = `<span class="health-tag tag-normal">ปกติ</span>`;
  if (house.has_vulnerable) {
    healthTag = `<span class="health-tag tag-vulnerable">กลุ่มติดตามต่อเนื่อง</span>`;
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
