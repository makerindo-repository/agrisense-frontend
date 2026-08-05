import React, { useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw';
import 'leaflet-draw/dist/leaflet.draw.css';
import { toast } from 'sonner';

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
  drawColor = '#10b981',
  children,
}: LeafletDrawMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const drawnItemsRef = useRef<L.FeatureGroup>(new L.FeatureGroup());
  const parentLayerRef = useRef<L.GeoJSON | null>(null);
  const gardensLayerRef = useRef<L.LayerGroup>(L.layerGroup());

  // Calculate polygon info from a layer
  const calculatePolygonInfo = useCallback((layer: L.Polygon) => {
    const geojson = layer.toGeoJSON();
    const bounds = layer.getBounds();
    const center = bounds.getCenter();
    const latlngs = layer.getLatLngs()[0] as L.LatLng[];
    const areaSquareMeters = L.GeometryUtil.geodesicArea(latlngs);
    const areaHectares = areaSquareMeters / 10000;

    return {
      polygon: geojson.geometry,
      latitude: parseFloat(center.lat.toFixed(7)),
      longitude: parseFloat(center.lng.toFixed(7)),
      area_hectare: parseFloat(areaHectares.toFixed(3)),
    };
  }, []);

  // Initialize the map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Center over Indonesia (Java region) with a provincial zoom of 9
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

    L.control.layers({
      "Satelit": satellite,
      "Peta Jalan": streets
    }, undefined, { position: 'topleft' }).addTo(map);

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
          shapeOptions: { color: drawColor },
        },
        polyline: false,
        rectangle: {
          shapeOptions: { color: drawColor },
        },
        circle: false,
        marker: false,
        circlemarker: false,
      },
    });
    map.addControl(drawControl);

    // Handle polygon creation
    map.on(L.Draw.Event.CREATED, (e: any) => {
      const layer = e.layer as L.Polygon;
      const latlngs = layer.getLatLngs()[0] as L.LatLng[];

      if (latlngs.length < 3) {
        toast.error('Area harus mempunyai minimal 3 titik sudut!');
        return;
      }

      drawnItemsRef.current.clearLayers();
      drawnItemsRef.current.addLayer(layer);

      const result = calculatePolygonInfo(layer);
      onPolygonChange(result);
    });

    // Handle polygon edit
    map.on(L.Draw.Event.EDITED, (e: any) => {
      const layers = e.layers;
      layers.eachLayer((layer: L.Polygon) => {
        const result = calculatePolygonInfo(layer);
        onPolygonChange(result);
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
    <div className="flex flex-col h-full min-h-[300px] w-full gap-2 relative">
      <div className="relative flex-1 rounded-xl border border-border/50 overflow-hidden z-0">
        <div
          ref={mapContainerRef}
          style={{ minHeight: height === '100%' ? '300px' : height, width: '100%', height: '100%' }}
          className="absolute inset-0"
        />
        {children}
      </div>
      <div className="flex flex-wrap items-center gap-4 text-[10px] font-medium text-muted-foreground mt-2">
        {parentLandPolygon && (
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 inline-block" style={{ borderTop: `2px dashed ${parentLandColor}` }} />
            Batas Lahan Induk
          </span>
        )}
        {existingGardens && existingGardens.length > 0 && (
          <span className="flex items-center gap-1">
            <span className="w-3 h-2 bg-amber-500/30 border border-amber-500 inline-block rounded-sm" />
            Kebun yang sudah ada
          </span>
        )}
        <span className="flex items-center gap-1">
          <span className="w-3 h-2 inline-block rounded-sm" style={{ backgroundColor: drawColor + '30', border: `1px solid ${drawColor}` }} />
          Area baru / yang diedit
        </span>
      </div>
    </div>
  );
}
