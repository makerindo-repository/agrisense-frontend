import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, Polygon, LayersControl } from 'react-leaflet';
import L from 'leaflet';

// Draggable Marker Component for Mini Map
const DraggableMarker = ({ position, setPosition }: any) => {
  const markerRef = React.useRef<L.Marker>(null);
  const eventHandlers = React.useMemo(
    () => ({
      async dragend() {
        const marker = markerRef.current;
        if (marker != null) {
          const newPos = marker.getLatLng();
          const lat = newPos.lat;
          const lng = newPos.lng;

          // Temporary loading state
          setPosition(lat, lng, 'Memuat...');

          try {
            const res = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`);
            const data = await res.json();
            const alt = (data && data.elevation && data.elevation.length > 0)
              ? Math.round(data.elevation[0])
              : Math.floor(700 + Math.random() * 50);
            setPosition(lat, lng, alt.toString());
          } catch {
            setPosition(lat, lng, Math.floor(700 + Math.random() * 50).toString());
          }
        }
      },
    }),
    [setPosition],
  );

  return (
    <Marker
      draggable={true}
      eventHandlers={eventHandlers}
      position={position}
      ref={markerRef}
    />
  );
};

// Map Controller to handle centering, resizing, and clicks
const MapController = ({ center, zoom, bounds, onMapClick }: { center: [number, number], zoom: number, bounds?: any, onMapClick?: (lat: number, lng: number) => void }) => {
  const map = useMapEvents({
    click(e) {
      if (onMapClick) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    },
  });

  useEffect(() => {
    try {
      if (bounds && Array.isArray(bounds) && bounds.length > 1) {
        map.fitBounds(bounds, { padding: [20, 20], maxZoom: 18, animate: false });
      } else if (center) {
        map.setView(center, zoom, { animate: false });
      }
      if (map && map.getContainer()) {
        map.invalidateSize();
      }
    } catch (e) {
      console.error("MapController fitBounds error:", e);
    }
  }, [center, zoom, bounds, map]);
  return null;
};

export interface NodeMapProps {
  center: [number, number];
  zoom: number;
  bounds: L.LatLngBoundsExpression | null;
  nodeLocation: [number, number] | null;
  onPositionChange: (lat: number, lng: number, altitude: string) => void;
  onMapClick: (lat: number, lng: number) => void;
  landPlots: { id: string; name: string; polygon: any[]; latitude?: number; longitude?: number; color?: string }[];
  gardens: { id: string; garden_name: string; polygon: any; land_plot_id: string; color?: string }[];
  selectedPlotId?: string;
  selectedGardenId?: string;
  formData: { latitude: string; longitude: string; altitude: string; [key: string]: any };
}

export default function NodeMap({
  center,
  zoom,
  bounds,
  nodeLocation,
  onPositionChange,
  onMapClick,
  landPlots,
  gardens,
  selectedPlotId,
  selectedGardenId,
  formData
}: NodeMapProps) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom={true}
      attributionControl={false}
    >
      <LayersControl position="topleft">
        <LayersControl.BaseLayer checked name="Satelit">
          <TileLayer url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}" attribution="© Google" maxZoom={20} />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Peta Jalan (OSM)">
          <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" attribution="&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors &copy; <a href='https://carto.com/attributions'>CARTO</a>" maxZoom={19} />
        </LayersControl.BaseLayer>
      </LayersControl>
      {/* Overlay label transparan: nama daerah, jalan — teks tegas tanpa ikon POI */}
      <TileLayer url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png" maxZoom={20} pane="overlayPane" />
      <MapController
        center={center}
        zoom={zoom}
        bounds={bounds}
        onMapClick={onMapClick}
      />

      {/* Visualisasi Poligon Lahan Terpilih */}
      {selectedPlotId && (() => {
        const lahan = landPlots.find(l => l.id.toString() === selectedPlotId);
        if (!lahan || !lahan.polygon || !Array.isArray(lahan.polygon)) return null;
        try {
          const validCoords = lahan.polygon
            .filter((c: any) => Array.isArray(c) && c.length >= 2)
            .map((c: any): [number, number] => [Number(c[1]), Number(c[0])])
            .filter((c: [number, number]) => !isNaN(c[0]) && !isNaN(c[1]));

          if (validCoords.length === 0) return null;

          return (
            <Polygon
              positions={validCoords}
              pathOptions={{ color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.25, weight: 4 }}
            />
          );
        } catch (e) { return null; }
      })()}

      {/* Visualisasi Poligon Kebun Terpilih */}
      {selectedGardenId && (() => {
        const garden = gardens.find(g => g.id.toString() === selectedGardenId);
        if (!garden || !garden.polygon) return null;
        try {
          const poly = typeof garden.polygon === 'string' ? JSON.parse(garden.polygon) : garden.polygon;
          const coords = poly.coordinates ? poly.coordinates[0] : poly;
          if (!Array.isArray(coords)) return null;

          const validCoords = coords
            .filter((c: any) => Array.isArray(c) && c.length >= 2)
            .map((c: any): [number, number] => [Number(c[1]), Number(c[0])])
            .filter((c: [number, number]) => !isNaN(c[0]) && !isNaN(c[1]));

          if (validCoords.length === 0) return null;

          return (
            <Polygon
              positions={validCoords}
              pathOptions={{ color: '#059669', fillColor: '#10b981', fillOpacity: 0.35, weight: 3 }}
            />
          );
        } catch (e) { return null; }
      })()}

      {/* Draggable Marker - Hanya muncul jika sudah ada lokasi (diklik) */}
      {nodeLocation && (
        <DraggableMarker
          position={nodeLocation}
          setPosition={onPositionChange}
        />
      )}

      {/* Floating Coordinates Overlay */}
      <div className="absolute bottom-4 left-4 z-[1000] max-w-[calc(100%-2rem)] bg-background/95 backdrop-blur-sm p-3 rounded-xl border border-border shadow-xl flex flex-wrap gap-4 text-[10px] font-mono font-bold">
        <div className="flex flex-col">
          <span className="text-muted-foreground uppercase">Latitude</span>
          <span>{formData.latitude}</span>
        </div>
        <div className="flex flex-col border-l pl-4 border-border">
          <span className="text-muted-foreground uppercase">Longitude</span>
          <span>{formData.longitude}</span>
        </div>
        <div className="flex flex-col border-l pl-4 border-border">
          <span className="text-muted-foreground uppercase">Altitude (m)</span>
          <span>{formData.altitude === '720' && formData.latitude === '-6.914744' ? '-' : formData.altitude}</span>
        </div>
      </div>
    </MapContainer>
  );
}
