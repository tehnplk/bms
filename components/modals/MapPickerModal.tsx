'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, MapPin, Move } from 'lucide-react';
import { DEFAULT_MAP_CENTER, TILE_PROVIDERS } from '@/lib/types/gis';

export type PickerLayer = 'osm' | 'satellite';

export interface MapPickerModalProps {
  title: string;
  subtitle: string;
  initialLat: number | null;
  initialLng: number | null;
  onConfirm: (lat: number, lng: number) => void;
  onClose: () => void;
}

export default function MapPickerModal({
  title,
  subtitle,
  initialLat,
  initialLng,
  onConfirm,
  onClose
}: MapPickerModalProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);

  const [layer, setLayer] = useState<PickerLayer>('osm');
  const [coord, setCoord] = useState<{ lat: number; lng: number }>({
    lat: initialLat ?? DEFAULT_MAP_CENTER[0],
    lng: initialLng ?? DEFAULT_MAP_CENTER[1]
  });

  // Initialise the picker map with a single draggable red pin
  useEffect(() => {
    let isMounted = true;

    async function initPicker() {
      const L = (await import('leaflet')).default;
      if (!isMounted || !mapContainerRef.current || mapInstanceRef.current) return;

      const start: [number, number] = [
        initialLat ?? DEFAULT_MAP_CENTER[0],
        initialLng ?? DEFAULT_MAP_CENTER[1]
      ];

      const map = L.map(mapContainerRef.current, {
        center: start,
        // An existing coordinate only needs fine tuning
        zoom: initialLat !== null ? 18 : 15,
        zoomControl: false
      });
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      tileLayerRef.current = L.tileLayer(TILE_PROVIDERS.osm.url, {
        maxZoom: 19,
        attribution: TILE_PROVIDERS.osm.attribution
      }).addTo(map);

      const pinIcon = L.divIcon({
        html: `
          <div class="custom-house-pin pin-red">
            <div class="pin-bubble">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
            <div class="pin-point"></div>
          </div>
        `,
        className: 'house-marker-wrapper',
        iconSize: [32, 38],
        iconAnchor: [16, 38]
      });

      const marker = L.marker(start, { draggable: true, autoPan: true, icon: pinIcon }).addTo(map);
      marker.on('drag', () => {
        const pos = marker.getLatLng();
        setCoord({ lat: pos.lat, lng: pos.lng });
      });

      markerRef.current = marker;
      mapInstanceRef.current = map;

      // The modal animates in, so the container is not at its final size yet
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
  }, [initialLat, initialLng]);

  // Swap the base layer without touching the pin or the current view
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || typeof window === 'undefined') return;

    async function swapTile() {
      const L = (await import('leaflet')).default;
      if (tileLayerRef.current) map.removeLayer(tileLayerRef.current);
      const provider = TILE_PROVIDERS[layer];
      tileLayerRef.current = L.tileLayer(provider.url, {
        maxZoom: 19,
        attribution: provider.attribution
      }).addTo(map);
      // Keep the base layer under the pin
      tileLayerRef.current.bringToBack();
    }

    swapTile();
  }, [layer]);

  return (
    <div
      className="modal-backdrop modal-backdrop-nested animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-content modal-content-map animate-scale-up" role="dialog" aria-modal="true">
        <div className="modal-header">
          <div className="modal-title-row">
            <span className="house-badge-icon">
              <MapPin size={22} />
            </span>
            <div>
              <div className="modal-house-title">{title}</div>
              <div className="modal-house-subtitle">{subtitle}</div>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="ปิด">&times;</button>
        </div>

        <div className="map-picker-toolbar">
          <div className="tile-toggle-group">
            <button
              type="button"
              className={`tile-toggle-btn ${layer === 'osm' ? 'active' : ''}`}
              onClick={() => setLayer('osm')}
            >
              แผนที่
            </button>
            <button
              type="button"
              className={`tile-toggle-btn ${layer === 'satellite' ? 'active' : ''}`}
              onClick={() => setLayer('satellite')}
            >
              ดาวเทียม
            </button>
          </div>

          <div className="map-picker-readout font-mono">
            <Move size={13} />
            Lat {coord.lat.toFixed(6)}, Lng {coord.lng.toFixed(6)}
          </div>
        </div>

        <div className="map-picker-canvas">
          <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
        </div>

        <div className="map-picker-footer">
          <button type="button" className="btn-action btn-pin-pick" onClick={onClose}>
            ยกเลิก
          </button>
          <button
            type="button"
            className="btn-action btn-save-pin"
            onClick={() => onConfirm(coord.lat, coord.lng)}
          >
            <Check size={15} />
            ใช้พิกัดนี้
          </button>
        </div>
      </div>
    </div>
  );
}
