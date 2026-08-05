import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { CloudSun, Zap, AlertTriangle, Activity, Calendar as CalendarIcon, FlaskConical, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function BMKGView() {
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
      
      // Use direct coordinates if available, otherwise fallback to polygon parsing
      if (selectedLand) {
        let lat = selectedLand.latitude;
        let lng = selectedLand.longitude;

        if (!lat || !lng) {
          try {
            const polyData = typeof selectedLand.polygon === 'string' ? JSON.parse(selectedLand.polygon) : selectedLand.polygon;
            if (polyData.coordinates && polyData.coordinates[0]) {
              // GeoJSON format [lng, lat]
              lng = polyData.coordinates[0][0][0];
              lat = polyData.coordinates[0][0][1];
            } else if (Array.isArray(polyData) && polyData[0]) {
              // Simple array [lat, lng] or [[lat, lng], ...]
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
          setError(data.message || "Data Cuaca tidak tersedia untuk wilayah ini");
        }
      } catch (err: any) {
        setError("Gagal terhubung ke API Cuaca. Pastikan backend berjalan.");
      } finally {
        setLoading(false);
      }
    };

    fetchBMKG();
  }, [selectedLandId, landPlots]);

  // ── Logic Analisis Fluks Karbon Cerdas ──
  const getAgronomicAdvice = (data: any, customStation?: string) => {
    if (!data || !data.current) return "Menunggu data cuaca untuk analisis dinamika karbon...";
    
    const temp = data.current.temp;
    const humidity = data.current.humidity;
    const weather = data.current.weather.toLowerCase();
    const wind = data.windSpeed || 0;
    const station = customStation || data.station || "Anda";

    // VPD (Vapor Pressure Deficit) — indikator aktivitas pertukaran gas CO₂
    const svp = 0.6108 * Math.exp((17.27 * temp) / (temp + 237.3)); // kPa
    const avp = svp * (humidity / 100);
    const vpd = svp - avp;
    const vpdStr = vpd.toFixed(2);

    let adviceText = `Berdasarkan data klimatologi wilayah ${station} — `;
    
    const isRaining = weather.includes('rain') || weather.includes('hujan') || weather.includes('drizzle') || weather.includes('gerimis') || weather.includes('thunderstorm') || weather.includes('badai');
    
    // 1. Hujan + Angin Kencang
    if (isRaining && wind > 20) {
      return adviceText + `Hujan disertai angin kencang (${wind.toFixed(1)} km/j) pada suhu ${temp.toFixed(1)}°C. Cahaya matahari hampir tidak ada sehingga proses penyerapan CO₂ oleh tanaman (fotosintesis) berhenti total. VPD saat ini ${vpdStr} kPa, pertukaran gas antara tanaman dan udara sangat terbatas. Di sisi lain, genangan air meningkatkan pelepasan CO₂ dari tanah akibat proses penguraian tanpa oksigen. Secara keseluruhan, ekosistem melepaskan lebih banyak karbon ke atmosfer dibanding yang diserap.`;
    }
    
    // 2. Hujan Normal
    if (isRaining) {
      return adviceText + `Hujan terdeteksi pada suhu ${temp.toFixed(1)}°C dengan kelembapan ${humidity}% (VPD: ${vpdStr} kPa). Cahaya matahari sangat rendah sehingga laju penyerapan CO₂ oleh tanaman menurun tajam. Pori-pori daun (stomata) cenderung tertutup, mengurangi kemampuan tanaman menyerap karbon. Di sisi lain, tanah yang basah membuat mikroorganisme pengurai lebih aktif — mempercepat pelepasan CO₂ dari tanah. Saat ini, ekosistem cenderung menjadi pelepas karbon (carbon source) sementara hingga hujan reda.`;
    }

    // 3. Stres Panas Ekstrem (Kering)
    if (temp > 32 && humidity < 50) {
      return adviceText + `Kondisi sangat terik (${temp.toFixed(1)}°C) dan kering (kelembapan ${humidity}%). Tekanan uap udara sangat tinggi (VPD: ${vpdStr} kPa) — tanaman menutup pori-pori daunnya untuk mencegah kehilangan air, sehingga penyerapan CO₂ terhenti. Sementara itu, proses pernapasan tanaman (yang melepas CO₂) justru meningkat seiring naiknya suhu. Akibatnya, lebih banyak karbon yang dilepas ke udara dibanding yang diserap. Potensi penyimpanan karbon harian pada kondisi ini sangat rendah.`;
    }
    
    // 4. Stres Panas Lembap (Gerah)
    if (temp > 32 && humidity >= 50) {
      return adviceText + `Suhu tinggi (${temp.toFixed(1)}°C) dengan kelembapan ${humidity}% (VPD: ${vpdStr} kPa). Meskipun pori-pori daun masih terbuka sebagian, efisiensi tanaman dalam menangkap CO₂ menurun drastis di atas 32°C. Perbandingan antara karbon yang diserap vs yang dilepas kembali memburuk — artinya lebih banyak CO₂ yang dikeluarkan tanaman melalui proses pernapasan. Efisiensi konversi cahaya menjadi penyimpanan karbon turun 30–50% dari kondisi ideal.`;
    }

    // 5. Kondisi Optimal — Penyerapan CO₂ maksimal
    if (temp >= 24 && temp <= 30 && humidity >= 50 && humidity <= 80 && wind < 15) {
      return adviceText + `Kondisi sangat ideal untuk penyimpanan karbon — suhu ${temp.toFixed(1)}°C, kelembapan ${humidity}%, VPD ${vpdStr} kPa. Proses fotosintesis berjalan pada kapasitas penuh: pori-pori daun terbuka lebar, memaksimalkan masuknya CO₂ ke dalam daun. Laju penyerapan karbon (GPP) mencapai puncaknya, sementara pelepasan CO₂ dari tanaman dan tanah tetap terkendali. Ekosistem berfungsi sebagai penyerap karbon (carbon sink) yang sangat efisien. Pada kondisi ini, penyerapan CO₂ diestimasi dapat mencapai 15–25 gram karbon per m² per hari.`;
    }
    
    // 6. Kelembapan Sangat Tinggi + Sejuk
    if (humidity > 85 && temp < 26) {
      return adviceText + `Suhu sejuk (${temp.toFixed(1)}°C) dengan kelembapan sangat tinggi (${humidity}%, VPD rendah: ${vpdStr} kPa). Fotosintesis berjalan moderat karena cahaya dan suhu belum optimal, namun aktivitas mikroorganisme pengurai di dalam tanah sangat tinggi. Kelembapan tinggi mempercepat penguraian bahan organik — meningkatkan pelepasan CO₂ dan metana (CH₄) dari tanah. Emisi dari tanah bisa menyumbang 40–60% dari total pelepasan karbon ekosistem. Potensi sebagai penyerap karbon berkurang karena pelepasan karbon dari tanah hampir menyamai penyerapan oleh tanaman.`;
    }

    // 7. Angin Kencang
    if (wind > 25) {
      return adviceText + `Angin kencang (${wind.toFixed(1)} km/j) pada suhu ${temp.toFixed(1)}°C. Turbulensi udara meningkatkan pencampuran udara di sekitar kanopi tanaman dengan udara bebas, mempercepat pergerakan CO₂. Konsentrasi CO₂ di bawah tanaman menurun karena terdispersi cepat. Namun, kemampuan tanaman menyerap CO₂ melalui pori-pori daun tetap stabil. Secara fisiologis, tekanan angin membuat tanaman lebih banyak mengalokasikan karbon ke batang dan akar (untuk memperkuat struktur) dibanding ke daun.`;
    }

    // 8. Suhu Dingin
    if (temp < 20) {
      return adviceText + `Suhu relatif dingin (${temp.toFixed(1)}°C, VPD: ${vpdStr} kPa). Proses fotosintesis melambat karena reaksi kimia di dalam daun berjalan lebih lambat pada suhu rendah. Namun, proses pernapasan tanaman juga berkurang — sehingga rasio penyerapan terhadap pelepasan karbon masih bisa positif. Penguraian bahan organik di tanah juga melambat, mengurangi emisi CO₂ dari tanah sebesar 20–40%. Secara keseluruhan, ekosistem masih berfungsi sebagai penyerap karbon meskipun dengan kapasitas yang lebih rendah.`;
    }

    // 9. Default Stabil
    return adviceText + `Suhu termonitor ${temp.toFixed(1)}°C dengan kelembapan ${humidity}% (VPD: ${vpdStr} kPa). Kondisi cuaca cukup stabil untuk siklus karbon normal. Penyerapan CO₂ (fotosintesis) dan pelepasan CO₂ (pernapasan tanaman + penguraian tanah) berada dalam keseimbangan dinamis — ekosistem berfungsi sebagai penyerap karbon (carbon sink) moderat. Perhatikan suhu malam hari: kenaikan 1°C suhu malam dapat meningkatkan pelepasan CO₂ di malam hari sebesar 8–12%. Pantau rasio penyerapan vs pelepasan karbon untuk evaluasi efisiensi harian.`;
  };

  if (loading && !bmkgData) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] space-y-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-muted-foreground font-medium animate-pulse">Menghubungkan ke Server Cuaca...</p>
      </div>
    );
  }

  const cleanAddress = (address: string | undefined) => {
    if (!address) return "Mencari Wilayah...";
    const parts = address.split(',').map(s => s.trim());
    const cleaned = parts.filter(p => {
      const lower = p.toLowerCase();
      if (lower === 'indonesia' || lower === 'jawa') return false;
      if (/^\d{5}$/.test(p)) return false; // Postal code
      return true;
    });
    return cleaned.join(', ');
  };

  const currentAddress = landPlots.find(l => l.id.toString() === selectedLandId)?.address || bmkgData?.station;
  const displayAddress = cleanAddress(currentAddress);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Integrasi Cuaca & Klimatologi</h1>
          <p className="text-muted-foreground">Prakiraan cuaca berbasis lokasi lahan</p>
          {landPlots.find(l => l.id.toString() === selectedLandId) && (
            <div className="mt-2 flex items-center gap-2 text-xs font-medium text-primary">
              <MapPin size={14} />
              <span className="font-mono">
                {formatNum(landPlots.find(l => l.id.toString() === selectedLandId)?.latitude, 4)}, 
                {formatNum(landPlots.find(l => l.id.toString() === selectedLandId)?.longitude, 4)}
              </span>
              <span className="text-muted-foreground">|</span>
              <span className="font-bold text-muted-foreground/80 uppercase tracking-tight truncate max-w-[300px]" title={displayAddress}>
                {displayAddress}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 bg-card p-2 rounded-2xl shadow-sm border border-border/50">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Lokasi Lahan:</span>
          <Select value={selectedLandId} onValueChange={(v) => setSelectedLandId(v || '')}>
            <SelectTrigger className="w-[220px] border-none bg-muted/50 font-black text-xs uppercase tracking-wider h-10 rounded-xl px-4">
              <SelectValue>
                {landPlots.find(l => l.id.toString() === selectedLandId)?.name || 
                 landPlots.find(l => l.id.toString() === selectedLandId)?.plot_name || "Pilih Lahan Utama"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="rounded-xl border-none shadow-2xl z-[2000]">
              {landPlots.map(l => (
                <SelectItem key={l.id} value={l.id.toString()} className="font-bold py-2 text-xs uppercase cursor-pointer">
                  {l.name || l.plot_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="border-none shadow-xl shadow-black/5 overflow-hidden">
          <CardHeader className="bg-muted/30 border-b border-border/50">
            <CardTitle className="text-lg flex items-center gap-2">
              <img src="https://cdn-icons-png.flaticon.com/512/833/833593.png" alt="calendar" className="w-4 h-4 object-contain opacity-75 mr-2" />
              Prakiraan Cuaca (Next 24h)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/50">
              {bmkgData?.forecast?.map((f: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-4 hover:bg-muted/20 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground">{f.time.split(' ')[0]}</span>
                      <span className="text-sm font-medium">{f.time.split(' ')[1]}</span>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                      <CloudSun size={20} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{f.weather}</span>
                      <span className="text-xs text-muted-foreground">Lembap: {formatNum(f.humidity)}%</span>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-medium">{formatNum(f.temp)}</span>
                    <span className="text-sm font-medium text-muted-foreground">°C</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl shadow-black/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Parameter Klimatologi Saat Ini
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-muted/30 border border-border/50 group hover:border-primary/30 transition-colors">
                <p className="text-xs text-foreground uppercase tracking-wider mb-1">Kelembapan Relatif</p>
                <div className="flex items-baseline gap-1">
                  <p className="text-3xl tracking-tighter text-foreground">{formatNum(bmkgData?.current?.humidity)}</p>
                  <p className="text-sm text-foreground">%</p>
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-muted/30 border border-border/50 group hover:border-primary/30 transition-colors">
                <p className="text-xs text-foreground uppercase tracking-wider mb-1">Kecepatan Angin</p>
                <div className="flex items-baseline gap-1">
                  <p className="text-3xl tracking-tighter text-foreground">{formatNum(bmkgData?.windSpeed)}</p>
                  <p className="text-sm text-foreground">km/j</p>
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-muted/30 border border-border/50 group hover:border-primary/30 transition-colors">
                <p className="text-xs text-foreground uppercase tracking-wider mb-1">Suhu Udara</p>
                <div className="flex items-baseline gap-1">
                  <p className="text-3xl tracking-tighter text-foreground">{formatNum(bmkgData?.current?.temp)}</p>
                  <p className="text-sm text-foreground">°C</p>
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-muted/30 border border-border/50 group hover:border-primary/30 transition-colors">
                <p className="text-xs text-foreground uppercase tracking-wider mb-1">Kondisi</p>
                <p className="text-lg tracking-tight text-foreground truncate">{bmkgData?.current?.weather}</p>
              </div>
            </div>
            <div className="p-5 rounded-2xl bg-primary shadow-lg shadow-primary/20 border border-primary/10 relative overflow-hidden">
              <div className="absolute -right-4 -bottom-4 opacity-10 text-white rotate-12">
                <CloudSun size={120} />
              </div>
              <p className="text-base font-bold text-primary-foreground mb-3 flex items-center gap-2">
                <FlaskConical size={18} />
                Analisis AgriSense AI
              </p>
              <p className="text-sm text-primary-foreground/90 leading-relaxed font-medium relative z-10">
                {getAgronomicAdvice(bmkgData, cleanAddress(landPlots.find(l => l.id.toString() === selectedLandId)?.address))}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
