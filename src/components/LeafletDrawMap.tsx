import React, { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw';
import 'leaflet-draw/dist/leaflet.draw.css';
import { toast } from 'sonner';
import { Search, X, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Fix default marker icon paths for Leaflet in bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Fix Leaflet.draw "type is not defined" error by providing missing locale strings
(L as any).drawLocal = {
	draw: {
		toolbar: {
			actions: { title: 'Batal menggambar', text: 'Batal' },
			finish: { title: 'Selesai menggambar', text: 'Selesai' },
			undo: { title: 'Hapus titik terakhir', text: 'Hapus Titik' },
			buttons: {
				polyline: 'Gambar garis',
				polygon: 'Gambar area (poligon)',
				rectangle: 'Gambar kotak',
				circle: 'Gambar lingkaran',
				marker: 'Tambah penanda',
				circlemarker: 'Tambah penanda lingkaran'
			}
		},
		handlers: {
			circle: { tooltip: { start: 'Klik dan seret untuk menggambar lingkaran.' }, radius: 'Radius' },
			circlemarker: { tooltip: { start: 'Klik peta untuk menaruh penanda lingkaran.' } },
			marker: { tooltip: { start: 'Klik peta untuk menaruh penanda.' } },
			polygon: {
				tooltip: {
					start: 'Klik untuk mulai menggambar area.',
					cont: 'Klik untuk melanjutkan menggambar.',
					end: 'Klik titik pertama untuk menutup area.'
				}
			},
			polyline: {
				error: '<strong>Error:</strong> garis tidak boleh bersilangan!',
				tooltip: {
					start: 'Klik untuk mulai menggambar garis.',
					cont: 'Klik untuk melanjutkan menggambar.',
					end: 'Klik titik terakhir untuk selesai.'
				}
			},
			rectangle: { tooltip: { start: 'Klik dan seret untuk menggambar kotak.' } },
			simpleshape: { tooltip: { end: 'Lepas mouse untuk selesai menggambar.' } }
		}
	},
	edit: {
		toolbar: {
			actions: {
				save: { title: 'Simpan perubahan', text: 'Simpan' },
				cancel: { title: 'Batalkan semua perubahan', text: 'Batal' },
				clearAll: { title: 'Hapus semua area', text: 'Hapus Semua' }
			},
			buttons: {
				edit: 'Ubah area',
				editDisabled: 'Tidak ada area untuk diubah',
				remove: 'Hapus area',
				removeDisabled: 'Tidak ada area untuk dihapus'
			}
		},
		handlers: {
			edit: {
				tooltip: {
					text: 'Seret titik untuk mengubah bentuk.',
					subtext: 'Klik batal untuk membatalkan perubahan.'
				}
			},
			remove: { tooltip: { text: 'Klik pada area untuk menghapus.' } }
		}
	},
	format: {
		numeric: {
			delimiter: ',',
			decimalSeparator: '.',
			area: {
				ha: 'ha',
				m2: 'm²',
				km2: 'km²',
				ac: 'ac',
				ft2: 'ft²'
			},
			precision: {
				ha: 2,
				m2: 0,
				km2: 2,
				ac: 2,
				ft2: 0
			}
		}
	}
};

// Double safety check for specific plugin bugs
if (!(L as any).drawLocal.draw.handlers.polygon.tooltip) {
  (L as any).drawLocal.draw.handlers.polygon.tooltip = {};
}
(L as any).drawLocal.draw.handlers.polygon.tooltip.cont = 'Klik untuk melanjutkan menggambar.';
(L as any).drawLocal.draw.handlers.polygon.tooltip.end = 'Klik titik pertama untuk menutup area.';

export interface PolygonDrawResult {
  polygon: any; // GeoJSON geometry
  latitude: number;
  longitude: number;
  area_hectare: number;
}

interface LeafletDrawMapProps {
  /** Height of the map container */
  height?: string;
  /** Called when a polygon is drawn or edited */
  onPolygonChange: (result: PolygonDrawResult | null) => void;
  /** Existing polygon GeoJSON geometry to display for editing */
  existingPolygon?: any;
  /** Parent land plot polygon to show as a dashed boundary */
  parentLandPolygon?: any;
  /** Color for parent land plot */
  parentLandColor?: string;
  /** Other existing gardens to show as polygons */
  existingGardens?: Array<{ name: string; polygon: any; color?: string }>;
  /** Searchable land plots / gardens list for in-map search */
  searchablePlots?: Array<{ id: number; name: string; code?: string; latitude?: number; longitude?: number; polygon?: any }>;
  /** Draw color */
  drawColor?: string;
  /** Children elements to overlay on the map */
  children?: React.ReactNode;
}

export default function LeafletDrawMap({
  height = '400px',
  onPolygonChange,
  existingPolygon,
  parentLandPolygon,
  parentLandColor = '#3b82f6',
  existingGardens,
  searchablePlots = [],
  drawColor = '#10b981',
  children,
}: LeafletDrawMapProps) {
  const { t } = useTranslation();
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const drawnItemsRef = useRef<L.FeatureGroup>(new L.FeatureGroup());
  const parentLayerRef = useRef<L.GeoJSON | null>(null);
  const gardensLayerRef = useRef<L.LayerGroup>(L.layerGroup());

  const [mapSearch, setMapSearch] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const searchResults = useMemo(() => {
    if (!mapSearch.trim() || !searchablePlots.length) return [];
    const q = mapSearch.toLowerCase();
    return searchablePlots.filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.code || '').toLowerCase().includes(q)
    );
  }, [mapSearch, searchablePlots]);

  const handleSelectSearchResult = (item: any) => {
    setMapSearch(item.name);
    setIsSearchOpen(false);
    if (!mapRef.current) return;

    if (item.latitude && item.longitude) {
      mapRef.current.flyTo([item.latitude, item.longitude], 16, { duration: 1.5 });
    } else if (item.polygon) {
      try {
        const geom = typeof item.polygon === 'string' ? JSON.parse(item.polygon) : item.polygon;
        if (geom?.coordinates?.[0]?.length) {
          const positions = geom.coordinates[0].map((c: number[]) => [c[1], c[0]] as [number, number]);
          const bounds = L.latLngBounds(positions);
          mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 });
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Calculate polygon info from a layer
  const calculatePolygonInfo = useCallback((layer: L.Polygon) => {
    try {
      const geojson = layer.toGeoJSON();
      const bounds = layer.getBounds();
      const center = bounds.getCenter();

      const rawLatLngs = layer.getLatLngs();
      let latlngs: L.LatLng[] = [];

      if (Array.isArray(rawLatLngs)) {
        if (Array.isArray(rawLatLngs[0])) {
          latlngs = rawLatLngs[0] as L.LatLng[];
        } else {
          latlngs = rawLatLngs as unknown as L.LatLng[];
        }
      }

      let areaSquareMeters = 0;
      if (latlngs && latlngs.length >= 3 && (L as any).GeometryUtil) {
        areaSquareMeters = (L as any).GeometryUtil.geodesicArea(latlngs);
      }

      const areaHectares = areaSquareMeters / 10000;

      return {
        polygon: geojson.geometry,
        latitude: parseFloat(center.lat.toFixed(7)),
        longitude: parseFloat(center.lng.toFixed(7)),
        area_hectare: parseFloat(areaHectares.toFixed(3)),
      };
    } catch (err) {
      console.error('Error calculating polygon info:', err);
      return null;
    }
  }, []);

  // Initialize the map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Center over Indonesia (Java region) with a provincial zoom of 13
    const map = L.map(mapContainerRef.current).setView([-6.8315, 107.9160], 13);
    mapRef.current = map;

    const satellite = L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      attribution: '© Google',
    });
    
    const streets = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    });

    satellite.addTo(map);

    // Overlay label transparan: nama daerah, jalan — teks tegas tanpa ikon POI
    const labels = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png', {
      maxZoom: 20,
      pane: 'overlayPane',
    });
    labels.addTo(map);

    // 1-Click Layer Toggle Control (Satellite <-> Street Map)
    const isSatelliteRef = { current: true };
    const LayerToggleControl = L.Control.extend({
      options: { position: 'topleft' },
      onAdd: function() {
        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
        const link = L.DomUtil.create('a', 'leaflet-control-layers-toggle', container);
        link.href = '#';
        link.title = 'Sekali Klik: Beralih Peta Jalan / Satelit';
        link.role = 'button';

        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.on(link, 'click', (e) => {
          L.DomEvent.preventDefault(e);
          if (isSatelliteRef.current) {
            map.removeLayer(satellite);
            streets.addTo(map);
            isSatelliteRef.current = false;
            toast.info('Tampilan Peta Jalan', { duration: 1500 });
          } else {
            map.removeLayer(streets);
            satellite.addTo(map);
            isSatelliteRef.current = true;
            toast.info('Tampilan Peta Satelit', { duration: 1500 });
          }
        });
        return container;
      }
    });
    map.addControl(new LayerToggleControl());

    // Add drawn items layer
    map.addLayer(drawnItemsRef.current);
    map.addLayer(gardensLayerRef.current);

    // Add draw controls
    const drawControl = new L.Control.Draw({
      edit: {
        featureGroup: drawnItemsRef.current,
        remove: true,
      },
      draw: {
        polygon: {
          allowIntersection: true,
          showArea: true,
          metric: true,
          shapeOptions: { color: drawColor, weight: 3, opacity: 0.9, fillOpacity: 0.25 },
        },
        polyline: false,
        rectangle: false,
        circle: false,
        marker: false,
        circlemarker: false,
      },
    });
    map.addControl(drawControl);

    // Handle polygon / rectangle creation
    map.on(L.Draw.Event.CREATED, (e: any) => {
      const layer = e.layer as L.Polygon;
      const result = calculatePolygonInfo(layer);

      if (!result || result.area_hectare < 0.005) {
        toast.warning('Area terlalu kecil! Silahkan klik dan seret mouse lebih lebar untuk membuat area kotak/poligon.');
        return;
      }

      drawnItemsRef.current.clearLayers();
      drawnItemsRef.current.addLayer(layer);
      onPolygonChange(result);
    });

    // Handle polygon / rectangle edit & drag
    map.on(L.Draw.Event.EDITED, (e: any) => {
      const layers = e.layers;
      layers.eachLayer((layer: L.Polygon) => {
        const result = calculatePolygonInfo(layer);
        if (result) {
          onPolygonChange(result);
        }
      });
    });

    // Handle polygon delete
    map.on(L.Draw.Event.DELETED, () => {
      onPolygonChange(null);
    });

    // Try geolocation safely
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (mapRef.current) {
            mapRef.current.setView([position.coords.latitude, position.coords.longitude], 15);
          }
        },
        () => {
          // Geolocation denied or failed - keep default view
        },
        { timeout: 5000 }
      );
    }

    // Force a resize after render
    setTimeout(() => map.invalidateSize(), 200);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Render existing polygon for editing (only when existingPolygon structure actually changes)
  useEffect(() => {
    if (!mapRef.current) return;
    drawnItemsRef.current.clearLayers();

    if (existingPolygon) {
      try {
        const geometry = typeof existingPolygon === 'string' ? JSON.parse(existingPolygon) : existingPolygon;
        const geoLayer = L.geoJSON(geometry, {
          style: { color: drawColor, weight: 3, fillOpacity: 0.15 },
        });

        geoLayer.eachLayer((layer) => {
          drawnItemsRef.current.addLayer(layer);
        });

        mapRef.current.fitBounds(geoLayer.getBounds(), { padding: [50, 50] });
      } catch (e) {
        console.error('Error parsing existing polygon:', e);
      }
    }
  }, [existingPolygon]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update color dynamically when drawColor changes without resetting bounds
  useEffect(() => {
    if (!mapRef.current) return;
    drawnItemsRef.current.eachLayer((layer: any) => {
      if (layer.setStyle) {
        layer.setStyle({ color: drawColor, fillColor: drawColor });
      }
    });
  }, [drawColor]);

  // Render parent land plot polygon (blue dashed)
  useEffect(() => {
    if (!mapRef.current) return;

    if (parentLayerRef.current) {
      mapRef.current.removeLayer(parentLayerRef.current);
      parentLayerRef.current = null;
    }

    if (parentLandPolygon) {
      try {
        const geometry = typeof parentLandPolygon === 'string' ? JSON.parse(parentLandPolygon) : parentLandPolygon;
        parentLayerRef.current = L.geoJSON(geometry, {
          style: {
            color: parentLandColor,
            weight: 2,
            dashArray: '5, 10',
            fillOpacity: 0.05,
            interactive: false,
          },
        }).addTo(mapRef.current);

        mapRef.current.fitBounds(parentLayerRef.current.getBounds(), { padding: [40, 40] });
      } catch (e) {
        console.error('Error parsing parent land polygon:', e);
      }
    }
  }, [parentLandPolygon]);

  // Render existing gardens (orange)
  useEffect(() => {
    if (!mapRef.current) return;
    gardensLayerRef.current.clearLayers();

    if (existingGardens && existingGardens.length > 0) {
      existingGardens.forEach((garden) => {
        if (garden.polygon) {
          try {
            const gGeom = typeof garden.polygon === 'string' ? JSON.parse(garden.polygon) : garden.polygon;
            const color = garden.color || '#22c55e'; // Default to green if no color specified
            const gLayer = L.geoJSON(gGeom, {
              style: { color, weight: 2, fillOpacity: 0.2, interactive: false },
            });
            gLayer.bindTooltip(`Kebun: ${garden.name}`);
            gardensLayerRef.current.addLayer(gLayer);
          } catch (e) {
            console.error('Error rendering existing garden:', e);
          }
        }
      });
    }
  }, [existingGardens]);

  // Re-invalidate map size when the container changes using ResizeObserver
  useEffect(() => {
    if (!mapContainerRef.current) return;
    
    const resizeObserver = new ResizeObserver(() => {
      mapRef.current?.invalidateSize();
    });
    
    resizeObserver.observe(mapContainerRef.current);
    
    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div className="relative w-full h-full min-h-[320px] rounded-2xl overflow-hidden z-0">
      <div
        ref={mapContainerRef}
        style={{ minHeight: height === '100%' ? '320px' : height, width: '100%', height: '100%' }}
        className="absolute inset-0"
      />
      {children}

      {/* Glassmorphic Map Legend Overlay */}
      <div className="absolute bottom-3 right-3 z-[400] bg-slate-900/85 backdrop-blur-md border border-white/15 px-3 py-1.5 rounded-xl shadow-xl flex items-center gap-3 text-[10px] font-bold text-white pointer-events-none">
        {parentLandPolygon && (
          <span className="flex items-center gap-1.5">
            <span className="w-3.5 h-0.5 inline-block" style={{ borderTop: `2px dashed ${parentLandColor}` }} />
            <span>{t('Lahan Induk')}</span>
          </span>
        )}
        {existingGardens && existingGardens.length > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-2 bg-emerald-500/30 border border-emerald-400 inline-block rounded-sm" />
            <span>{t('Kebun Lain')}</span>
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-2 inline-block rounded-sm" style={{ backgroundColor: drawColor + '50', border: `1.5px solid ${drawColor}` }} />
          <span>{t('Poligon Ditargetkan')}</span>
        </span>
      </div>
    </div>
  );
}
