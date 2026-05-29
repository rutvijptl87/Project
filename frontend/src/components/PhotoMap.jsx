import React, { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapPin } from 'lucide-react';

/**
 * Renders a small OpenStreetMap-based map plotting:
 *  - All photos that have lat/lng (numbered pins 1, 2, 3 …)
 *  - The visit-level GPS (a green star pin labeled "📍")
 *
 * Props:
 *  - photos: array of SiteVisitPhoto { latitude, longitude, caption }
 *  - visitGps: { latitude, longitude, accuracy } | null
 *  - height: CSS pixels (default 280)
 */
const numberedIcon = (n, color = '#0A2E1F') => L.divIcon({
  className: 'cc-numbered-pin',
  html: `<div style="
    width: 28px; height: 28px;
    border-radius: 50% 50% 50% 0;
    background: ${color};
    color: white;
    font-weight: 700;
    font-size: 12px;
    display: flex; align-items: center; justify-content: center;
    transform: rotate(-45deg);
    border: 2px solid white;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  "><span style="transform: rotate(45deg);">${n}</span></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -28],
});

const PhotoMap = ({ photos = [], visitGps = null, height = 280 }) => {
  const wrapRef = useRef(null);
  const mapRef = useRef(null);

  const geoPhotos = (photos || []).filter(
    (p) => p.latitude != null && p.longitude != null,
  );
  const hasVisit = visitGps && visitGps.latitude != null && visitGps.longitude != null;

  useEffect(() => {
    if (!wrapRef.current) return;
    if (!geoPhotos.length && !hasVisit) return;

    // Tear down any prior instance (defensive — React strict-mode double-invokes)
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    // Initial center: prefer visit GPS, else first photo
    const center = hasVisit
      ? [visitGps.latitude, visitGps.longitude]
      : [geoPhotos[0].latitude, geoPhotos[0].longitude];

    const map = L.map(wrapRef.current, {
      center,
      zoom: 17,
      scrollWheelZoom: false,
      attributionControl: true,
    });
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    const bounds = [];

    if (hasVisit) {
      const m = L.marker([visitGps.latitude, visitGps.longitude], {
        icon: numberedIcon('★', '#10B981'),
      }).addTo(map);
      m.bindPopup(
        `<strong>Visit GPS</strong><br/>${visitGps.latitude.toFixed(6)}, ${visitGps.longitude.toFixed(6)}` +
          (visitGps.accuracy != null ? `<br/>±${Math.round(visitGps.accuracy)} m` : ''),
      );
      bounds.push([visitGps.latitude, visitGps.longitude]);
    }

    geoPhotos.forEach((p, idx) => {
      const m = L.marker([p.latitude, p.longitude], {
        icon: numberedIcon(idx + 1),
      }).addTo(map);
      const cap = p.caption ? `<br/>${p.caption}` : '';
      m.bindPopup(
        `<strong>Photo ${idx + 1}</strong>${cap}<br/>${p.latitude.toFixed(6)}, ${p.longitude.toFixed(6)}`,
      );
      bounds.push([p.latitude, p.longitude]);
    });

    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 19 });
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [geoPhotos.length, hasVisit, visitGps?.latitude, visitGps?.longitude]); // eslint-disable-line

  if (!geoPhotos.length && !hasVisit) return null;

  return (
    <div className="card p-5 mb-4" data-testid="photo-map">
      <h2 className="font-head text-lg font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--cc-dark-green)' }}>
        <MapPin size={16}/> Site Walk-around Map
        <span className="text-xs font-normal ml-1" style={{ color: 'var(--cc-text-muted)' }}>
          ({geoPhotos.length} geotagged photo{geoPhotos.length === 1 ? '' : 's'}{hasVisit ? ' + visit pin' : ''})
        </span>
      </h2>
      <div
        ref={wrapRef}
        style={{ width: '100%', height: `${height}px`, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--cc-border)' }}
        data-testid="photo-map-canvas"
      />
      <p className="text-[11px] mt-2" style={{ color: 'var(--cc-text-muted)' }}>
        Green star = visit-level GPS. Numbered pins = individual photo locations. Click a pin to see the caption + coordinates.
      </p>
    </div>
  );
};

export default PhotoMap;
