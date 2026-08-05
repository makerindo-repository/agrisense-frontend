// ============================================================
// Utilitas Peta (Leaflet Map Helpers)
// Sumber: MapView.tsx L46-L75 (createStatusIcon) + L121-L146 (extractPolygonPositions)
// ============================================================

import * as L from 'leaflet';

/**
 * Membuat ikon marker Leaflet custom berdasarkan status node IoT.
 * Menggunakan L.divIcon dengan HTML inline.
 *
 * @param status - 'online' | 'warning' | 'offline'
 */
export const createStatusIcon = (status: string) => {
  const colorMap: Record<string, string> = {
    online: '#10b981',  // emerald-500
    warning: '#eab308', // yellow-500
    offline: '#ef4444', // red-500
  };
  const color = colorMap[status] || '#ef4444';

  return L.divIcon({
    html: `
      <div style="
        width: 15px; 
        height: 15px; 
        background-color: ${color}; 
        border: 2px solid white; 
        border-radius: 50%; 
        box-shadow: 0 0 6px ${color};
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="width: 4px; height: 4px; background-color: white; border-radius: 50%; opacity: 0.8;"></div>
      </div>
    `,
    className: 'custom-status-icon',
    iconSize: [15, 15],
    iconAnchor: [7.5, 7.5],
    popupAnchor: [0, -7.5],
  });
};

/**
 * Mengekstrak posisi [lat, lng][] dari data polygon GeoJSON atau array biasa.
 * Menangani format: GeoJSON Polygon, array sederhana, dan objek {lat, lng}.
 * Heuristik Indonesia: jika abs(coord[0]) > 90, itu longitude (bukan latitude).
 *
 * @param polygon - Data polygon mentah (string JSON, GeoJSON object, atau array)
 */
export const extractPolygonPositions = (polygon: any): [number, number][] => {
  try {
    const geom = typeof polygon === 'string' ? JSON.parse(polygon) : polygon;
    let rawCoords: any[] = [];
    if (geom.type === 'Polygon' && Array.isArray(geom.coordinates)) {
      rawCoords = geom.coordinates[0];
    } else if (Array.isArray(geom)) {
      rawCoords = geom;
    } else if (Array.isArray(geom.coordinates)) {
      rawCoords = geom.coordinates;
    }
    return rawCoords.map((pt: any) => {
      let lat: number, lng: number;
      if (Array.isArray(pt)) {
        if (Math.abs(pt[0]) > 90) { lng = parseFloat(pt[0]); lat = parseFloat(pt[1]); }
        else { lat = parseFloat(pt[0]); lng = parseFloat(pt[1]); }
      } else if (pt && typeof pt === 'object') {
        lat = parseFloat(pt.lat || pt.latitude);
        lng = parseFloat(pt.lng || pt.longitude);
      } else {
        return null;
      }
      return [lat, lng] as [number, number];
    }).filter((p): p is [number, number] => p !== null && !isNaN(p[0]) && !isNaN(p[1]));
  } catch {
    return [];
  }
};
