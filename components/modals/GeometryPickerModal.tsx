'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Pentagon, Spline, Undo2 } from 'lucide-react';
import { DEFAULT_MAP_CENTER, FeatureGeometry, LatLngTuple, TILE_PROVIDERS } from '@/lib/types/gis';

export type GeometryPickerMode = 'polygon' | 'line' | 'circle';

export interface GeometryPickerModalProps {
  mode: GeometryPickerMode;
  title: string;
  /** Stroke width for line mode, in pixels */
  weight?: number;
  onConfirm: (geometry: FeatureGeometry) => void;
  onClose: () => void;
}

const DRAW_COLOR = '#4f46e5';
const MIN_POINTS: Record<GeometryPickerMode, number> = { polygon: 3, line: 2, circle: 1 };

const HINT: Record<GeometryPickerMode, string> = {
  polygon: 'คลิกบนแผนที่เพื่อวางมุมของพื้นที่ อย่างน้อย 3 จุด',
  line: 'คลิกบนแผนที่เพื่อวางจุดของเส้น อย่างน้อย 2 จุด',
  circle: 'คลิกบนแผนที่เพื่อวางจุดกึ่งกลาง แล้วกำหนดรัศมีเป็นเมตร'
};

export default function GeometryPickerModal({
  mode,
  title,
  weight = 4,
  onConfirm,
  onClose
}: GeometryPickerModalProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const shapeGroupRef = useRef<any>(null);

  const [tile, setTile] = useState<'osm' | 'satellite'>('osm');
  const [points, setPoints] = useState<LatLngTuple[]>([]);
  const [radius, setRadius] = useState(200);

  // Redraw the whole shape on every change — the point count is small enough
  // that rebuilding beats tracking individual vertex layers
  const redraw = useCallback((pts: LatLngTuple[], r: number) => {
    const L = leafletRef.current;
    const group = shapeGroupRef.current;
    if (!L || !group) return;

    group.clearLayers();
    const style = { color: DRAW_COLOR, weight: mode === 'line' ? weight : 2.5, fillColor: DRAW_COLOR, fillOpacity: 0.12 };

    if (mode === 'circle' && pts.length) {
      L.circle(pts[0], { ...style, radius: r }).addTo(group);
    } else if (mode === 'polygon' && pts.length >= 3) {
      L.polygon(pts, style).addTo(group);
    } else if (mode === 'line' && pts.length >= 2) {
      L.polyline(pts, style).addTo(group);
    } else if (pts.length >= 2) {
      L.polyline(pts, { ...style, dashArray: '6 6' }).addTo(group);
    }

    pts.forEach((p) =>
      L.circleMarker(p, { color: DRAW_COLOR, fillColor: DRAW_COLOR, fillOpacity: 1, radius: 4 }).addTo(group)
    );
  }, [mode, weight]);

  useEffect(() => {
    let isMounted = true;

    async function initPicker() {
      const L = (await import('leaflet')).default;
      if (!isMounted || !mapContainerRef.current || mapInstanceRef.current) return;

      const map = L.map(mapContainerRef.current, {
        center: DEFAULT_MAP_CENTER,
        zoom: 15,
        zoomControl: false,
        doubleClickZoom: false
      });
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      tileLayerRef.current = L.tileLayer(TILE_PROVIDERS.osm.url, {
        maxZoom: 19,
        attribution: TILE_PROVIDERS.osm.attribution
      }).addTo(map);

      leafletRef.current = L;
      shapeGroupRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
      map.getContainer().classList.add('map-draw-cursor');

      // A circle has exactly one point, so each click moves its centre
      map.on('click', (e: any) => {
        const next: LatLngTuple = [e.latlng.lat, e.latlng.lng];
        setPoints((prev) => (mode === 'circle' ? [next] : [...prev, next]));
      });

      setTimeout(() => map.invalidateSize(), 0);
    }

    initPicker();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [mode]);

  useEffect(() => {
    redraw(points, radius);
  }, [points, radius, redraw]);

  // Swap the base layer without touching the shape or the current view
  useEffect(() => {
    const map = mapInstanceRef.current;
    const L = leafletRef.current;
    if (!map || !L) return;

    if (tileLayerRef.current) map.removeLayer(tileLayerRef.current);
    const provider = TILE_PROVIDERS[tile];
    tileLayerRef.current = L.tileLayer(provider.url, {
      maxZoom: 19,
      attribution: provider.attribution
    }).addTo(map);
    tileLayerRef.current.bringToBack();
  }, [tile]);

  const isReady = points.length >= MIN_POINTS[mode] && (mode !== 'circle' || radius > 0);

  const confirm = () => {
    if (!isReady) return;
    if (mode === 'circle') {
      onConfirm({ type: 'circle', lat: points[0][0], lng: points[0][1], radius });
    } else if (mode === 'polygon') {
      onConfirm({ type: 'polygon', path: points });
    } else {
      onConfirm({ type: 'line', path: points, weight });
    }
  };

  return (
    <div
      className="modal-backdrop modal-backdrop-nested animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-content modal-content-map animate-scale-up" role="dialog" aria-modal="true">
        <div className="modal-header">
          <div className="modal-title-row">
            <span className="house-badge-icon">
              {mode === 'line' ? <Spline size={22} /> : <Pentagon size={22} />}
            </span>
            <div>
              <div className="modal-house-title">{title}</div>
              <div className="modal-house-subtitle">{HINT[mode]}</div>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="ปิด">&times;</button>
        </div>

        <div className="map-picker-toolbar">
          <div className="tile-toggle-group">
            <button
              type="button"
              className={`tile-toggle-btn ${tile === 'osm' ? 'active' : ''}`}
              onClick={() => setTile('osm')}
            >
              แผนที่
            </button>
            <button
              type="button"
              className={`tile-toggle-btn ${tile === 'satellite' ? 'active' : ''}`}
              onClick={() => setTile('satellite')}
            >
              ดาวเทียม
            </button>
          </div>

          {mode === 'circle' ? (
            <div className="geometry-picker-radius">
              <label htmlFor="geometry-radius">รัศมี (เมตร)</label>
              <input
                id="geometry-radius"
                type="number"
                min={1}
                className="setting-number"
                value={radius}
                onChange={(e) => setRadius(Math.max(1, Number(e.target.value) || 0))}
              />
            </div>
          ) : (
            <div className="map-picker-readout font-mono">
              {points.length} จุด
              <button
                type="button"
                className="setting-grid-btn"
                disabled={!points.length}
                onClick={() => setPoints((prev) => prev.slice(0, -1))}
              >
                <Undo2 size={13} />
                ย้อนกลับ
              </button>
            </div>
          )}
        </div>

        <div className="map-picker-canvas">
          <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
        </div>

        <div className="map-picker-footer">
          <button type="button" className="btn-action btn-pin-pick" onClick={onClose}>
            ยกเลิก
          </button>
          <button type="button" className="btn-action btn-save-pin" disabled={!isReady} onClick={confirm}>
            <Check size={15} />
            ใช้รูปทรงนี้
          </button>
        </div>
      </div>
    </div>
  );
}
