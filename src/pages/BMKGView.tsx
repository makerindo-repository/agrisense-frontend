import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { CloudSun, Zap, AlertTriangle, Activity, Calendar as CalendarIcon, FlaskConical, MapPin, Wind, Thermometer, Droplets, Sparkles, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslation } from 'react-i18next';

export default function BMKGView() {
  const { t, i18n } = useTranslation();
  const [bmkgData, setBmkgData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [landPlots, setLandPlots] = useState<any[]>([]);
  const [selectedLandId, setSelectedLandId] = useState<string>("");

  const formatNum = (val: any, dec = 1) => {
    if (val === null || val === undefined) return "0.00";
    const num = Number(val);
    if (isNaN(num)) return "0.00";
    return num.toFixed(dec);
  };

  useEffect(() => {
    const fetchLandPlots = async () => {
      try {
        const res = await api.get('/land-plots');
        const data = Array.isArray(res.data) ? res.data : res.data?.data;
        if (Array.isArray(data)) {
          setLandPlots(data);
          if (data.length > 0) {
            setSelectedLandId(data[0].id.toString());
          }
        }
      } catch (err) {
        console.error("Failed to fetch land plots", err);
      }
    };
    fetchLandPlots();
  }, []);

  useEffect(() => {
    const fetchBMKG = async () => {
      if (!selectedLandId) return;
      
      const selectedLand = landPlots.find(l => l.id.toString() === selectedLandId);
      let url = "/bmkg";
      
      if (selectedLand) {
        let lat = selectedLand.latitude;
        let lng = selectedLand.longitude;

        if (!lat || !lng) {
          try {
            const polyData = typeof selectedLand.polygon === 'string' ? JSON.parse(selectedLand.polygon) : selectedLand.polygon;
            if (polyData.coordinates && polyData.coordinates[0]) {
              lng = polyData.coordinates[0][0][0];
              lat = polyData.coordinates[0][0][1];
            } else if (Array.isArray(polyData) && polyData[0]) {
              lat = Array.isArray(polyData[0]) ? polyData[0][0] : polyData[0];
              lng = Array.isArray(polyData[0]) ? polyData[0][1] : polyData[1];
            }
          } catch (e) {}
        }
        
        if (lat && lng) url += `?lat=${lat}&lng=${lng}`;
      }

      try {
        setLoading(true);
        const res = await api.get(url);
        const data = res.data;
        if (data.status === "success") {
          setBmkgData(data);
          setError(null);
        } else {
          setError(data.message || t("Data Cuaca tidak tersedia untuk wilayah ini"));
        }
      } catch (err: any) {
        setError(t("Gagal terhubung ke API Cuaca. Pastikan backend berjalan."));
      } finally {
        setLoading(false);
      }
    };

    fetchBMKG();
  }, [selectedLandId, landPlots, t]);

  // Logic Analisis Fluks Karbon Cerdas (Bilingual EN/ID)
  const getAgronomicAdvice = (data: any, customStation?: string) => {
    const isEn = i18n.language === 'en';
    if (!data || !data.current) {
      return isEn 
        ? "Waiting for weather data for carbon dynamics analysis..." 
        : t("Menunggu data cuaca untuk analisis dinamika karbon...");
    }
    
    const temp = data.current.temp;
    const humidity = data.current.humidity;
    const weather = data.current.weather.toLowerCase();
    const wind = data.windSpeed || 0;
    const station = customStation || data.station || (isEn ? "Plot" : "Lahan");

    const svp = 0.6108 * Math.exp((17.27 * temp) / (temp + 237.3));
    const avp = svp * (humidity / 100);
    const vpd = svp - avp;
    const vpdStr = vpd.toFixed(2);

    let adviceText = isEn
      ? `Based on climatological data for ${station} region — `
      : `Berdasarkan data klimatologi wilayah ${station} — `;
    
    const isRaining = weather.includes('rain') || weather.includes('hujan') || weather.includes('drizzle') || weather.includes('gerimis') || weather.includes('thunderstorm') || weather.includes('badai');
    
    if (isRaining && wind > 20) {
      return adviceText + (isEn
        ? `Rain accompanied by strong winds (${wind.toFixed(1)} km/h) at ${temp.toFixed(1)}°C. Low sunlight triggers temporary reduction in photosynthesis. Measured VPD is ${vpdStr} kPa.`
        : `Hujan disertai angin kencang (${wind.toFixed(1)} km/j) pada suhu ${temp.toFixed(1)}°C. Cahaya matahari rendah memicu penurunan fotosintesis sementara. VPD terukur ${vpdStr} kPa.`);
    }
    
    if (isRaining) {
      return adviceText + (isEn
        ? `Rain detected at ${temp.toFixed(1)}°C with humidity of ${humidity}% (VPD: ${vpdStr} kPa). CO₂ exchange operates at a steady rate and moist soil supports biological respiration.`
        : `Hujan terdeteksi pada suhu ${temp.toFixed(1)}°C dengan kelembapan ${humidity}% (VPD: ${vpdStr} kPa). Pertukaran CO₂ berada pada laju teratur dan tanah basah mendukung respirasi biologis.`);
    }

    if (temp > 32 && humidity < 50) {
      return adviceText + (isEn
        ? `Hot conditions (${temp.toFixed(1)}°C) and dry (humidity ${humidity}%, VPD: ${vpdStr} kPa). High evaporation triggers leaf stomata protection.`
        : `Kondisi terik (${temp.toFixed(1)}°C) dan kering (kelembapan ${humidity}%, VPD: ${vpdStr} kPa). Penguapan tinggi memicu perlindungan stomata pada daun.`);
    }
    
    if (temp >= 24 && temp <= 30 && humidity >= 50 && humidity <= 80 && wind < 15) {
      return adviceText + (isEn
        ? `Optimal conditions for carbon sequestration — temperature ${temp.toFixed(1)}°C, humidity ${humidity}%, VPD ${vpdStr} kPa. Photosynthesis and CO₂ absorption run at peak capacity.`
        : `Kondisi sangat ideal untuk penyerapan karbon — suhu ${temp.toFixed(1)}°C, kelembapan ${humidity}%, VPD ${vpdStr} kPa. Fotosintesis dan serapan CO₂ berjalan optimal.`);
    }

    return adviceText + (isEn
      ? `Monitored temperature ${temp.toFixed(1)}°C with humidity ${humidity}% (VPD: ${vpdStr} kPa). Microclimate remains in a stable range for plant gas exchange.`
      : `Suhu termonitor ${temp.toFixed(1)}°C dengan kelembapan ${humidity}% (VPD: ${vpdStr} kPa). Mikroklimat berada pada rentang stabil untuk pertukaran gas tanaman.`);
  };

  if (loading && !bmkgData) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center space-y-4">
        <Loader2 className="w-12 h-12 text-emerald-600 animate-spin" />
        <h2 className="text-xl font-bold">{t('Menghubungkan ke Server Cuaca...')}</h2>
      </div>
    );
  }

  const cleanAddress = (address: string | undefined) => {
    if (!address) return t("Mencari Wilayah...");
    const parts = address.split(',').map(s => s.trim());
    const cleaned = parts.filter(p => {
      const lower = p.toLowerCase();
      if (lower === 'indonesia' || lower === 'jawa') return false;
      if (/^\d{5}$/.test(p)) return false;
      return true;
    });
    return cleaned.join(', ');
  };

  const currentLand = landPlots.find(l => l.id.toString() === selectedLandId);
  const currentAddress = currentLand?.address || bmkgData?.station;
  const displayAddress = cleanAddress(currentAddress);

  return (
    <div className="w-full space-y-6 max-w-5xl mx-auto pb-24 select-none block">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border/60">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 shadow-xs shrink-0">
            <CloudSun size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-foreground">
              {t('Data Klimatologi dan Cuaca')}
            </h1>
            <p className="text-xs font-semibold text-muted-foreground mt-0.5">
              {t('Prakiraan cuaca BMKG dan analisis iklim mikro berbasis lokasi lahan')}
            </p>
            {currentLand && (
              <div className="mt-1 flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <MapPin size={13} />
                <span className="font-mono">
                  {formatNum(currentLand?.latitude, 4)}, {formatNum(currentLand?.longitude, 4)}
                </span>
                <span className="text-muted-foreground">|</span>
                <span className="font-extrabold text-muted-foreground uppercase tracking-tight truncate max-w-[320px]" title={displayAddress}>
                  {displayAddress}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 w-full lg:w-auto shrink-0">
          <div className="w-full sm:w-[260px]">
            <Select value={selectedLandId} onValueChange={(v) => setSelectedLandId(v || '')}>
              <SelectTrigger className="h-11 w-full rounded-2xl bg-card border-border/80 font-extrabold text-xs shadow-sm">
                <SelectValue placeholder={t('Pilih Lahan Utama')}>
                  {currentLand?.name || currentLand?.plot_name || t('Pilih Lahan Utama')}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-border shadow-xl">
                {landPlots.map(l => (
                  <SelectItem key={l.id} value={l.id.toString()} className="text-xs font-bold uppercase cursor-pointer">
                    {l.name || l.plot_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Grid Layout: 2 Equal Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
        {/* Forecast Card */}
        <Card className="bg-card border-border/80 shadow-md rounded-3xl overflow-hidden w-full">
          <CardHeader className="bg-muted/30 border-b border-border/60 p-6 py-5">
            <div className="flex items-center gap-3.5">
              <div className="p-3 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 shrink-0 border border-teal-500/20 shadow-xs">
                <CloudSun size={22} />
              </div>
              <div>
                <CardTitle className="text-base font-black text-foreground">{t('Prakiraan Cuaca (24 Jam Ke Depan)')}</CardTitle>
                <CardDescription className="text-xs font-semibold text-muted-foreground mt-0.5">{t('Proyeksi cuaca dan suhu udara per interval jam')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/60">
              {bmkgData?.forecast?.map((f: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-4 px-6 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-extrabold uppercase text-muted-foreground">{f.time.split(' ')[0]}</span>
                      <span className="text-xs font-black text-foreground">{f.time.split(' ')[1]}</span>
                    </div>
                    <div className="w-9 h-9 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center border border-teal-500/20 shrink-0">
                      <CloudSun size={18} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-foreground">{f.weather}</span>
                      <span className="text-[11px] font-semibold text-muted-foreground">RH: {formatNum(f.humidity)}%</span>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-black text-foreground">{formatNum(f.temp)}</span>
                    <span className="text-xs font-bold text-muted-foreground">°C</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Current Parameters Card */}
        <Card className="bg-card border-border/80 shadow-md rounded-3xl overflow-hidden w-full">
          <CardHeader className="bg-muted/30 border-b border-border/60 p-6 py-5">
            <div className="flex items-center gap-3.5">
              <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0 border border-emerald-500/20 shadow-xs">
                <Zap size={22} />
              </div>
              <div>
                <CardTitle className="text-base font-black text-foreground">{t('Parameter Klimatologi Saat Ini')}</CardTitle>
                <CardDescription className="text-xs font-semibold text-muted-foreground mt-0.5">{t('Telemetri lingkungan atmosferik terukur')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-muted/30 border border-border/50 space-y-1">
                <p className="text-[10px] font-extrabold uppercase text-muted-foreground">{t('Kelembapan Relatif')}</p>
                <div className="flex items-baseline gap-1">
                  <p className="text-2xl font-black text-foreground">{formatNum(bmkgData?.current?.humidity)}</p>
                  <p className="text-xs font-bold text-muted-foreground">%</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-muted/30 border border-border/50 space-y-1">
                <p className="text-[10px] font-extrabold uppercase text-muted-foreground">{t('Kecepatan Angin')}</p>
                <div className="flex items-baseline gap-1">
                  <p className="text-2xl font-black text-foreground">{formatNum(bmkgData?.windSpeed)}</p>
                  <p className="text-xs font-bold text-muted-foreground">km/j</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-muted/30 border border-border/50 space-y-1">
                <p className="text-[10px] font-extrabold uppercase text-muted-foreground">{t('Suhu Udara')}</p>
                <div className="flex items-baseline gap-1">
                  <p className="text-2xl font-black text-foreground">{formatNum(bmkgData?.current?.temp)}</p>
                  <p className="text-xs font-bold text-muted-foreground">°C</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-muted/30 border border-border/50 space-y-1">
                <p className="text-[10px] font-extrabold uppercase text-muted-foreground">{t('Arah Angin')}</p>
                <p className="text-sm font-black text-foreground truncate">
                  {(() => {
                    const deg = bmkgData?.current?.wind_direction_deg ?? 0;
                    const dirs = ['Utara (N)', 'Timur Laut (NE)', 'Timur (E)', 'Tenggara (SE)', 'Selatan (S)', 'Barat Daya (SW)', 'Barat (W)', 'Barat Laut (NW)'];
                    const idx = Math.round(deg / 45) % 8;
                    return `${deg}° ${dirs[idx]}`;
                  })()}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-muted/30 border border-border/50 space-y-1">
                <p className="text-[10px] font-extrabold uppercase text-muted-foreground">{t('Tekanan Udara')}</p>
                <div className="flex items-baseline gap-1">
                  <p className="text-2xl font-black text-foreground">{formatNum(bmkgData?.current?.pressure ?? 1013.25)}</p>
                  <p className="text-xs font-bold text-muted-foreground">hPa</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-muted/30 border border-border/50 space-y-1">
                <p className="text-[10px] font-extrabold uppercase text-muted-foreground">{t('Kondisi')}</p>
                <p className="text-sm font-black text-foreground truncate">{bmkgData?.current?.weather}</p>
              </div>
            </div>

            {/* AI Advice Card */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-lg shadow-emerald-600/15 relative overflow-hidden space-y-2">
              <p className="text-xs font-black uppercase tracking-wider text-emerald-100 flex items-center gap-1.5">
                <Sparkles size={16} />
                {t('Analisis AgriSense AI')}
              </p>
              <p className="text-xs font-medium leading-relaxed text-white/95">
                {getAgronomicAdvice(bmkgData, cleanAddress(currentLand?.address))}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
