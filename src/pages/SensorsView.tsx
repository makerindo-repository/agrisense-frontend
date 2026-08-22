import React, { useState, useMemo, useEffect } from 'react';
import {
  Search, X, Droplets, Thermometer, Wind, Battery, Signal, AlertTriangle, CloudSun,
  Activity, Filter, Download, CheckCircle2, Trees, MapPin, Calendar as CalendarIcon,
  RefreshCw, TrendingUp, Cpu, Gauge, Zap, FileSpreadsheet, BarChart2, Table as TableIcon,
  Compass, Info
} from 'lucide-react';
import { toast } from 'sonner';
import { mockReadings, SensorReading, IoTNode, formatEYDDeviceName } from '../lib/mockData';
import { motion, AnimatePresence } from 'motion/react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { formatDateTime, formatFilePrefix, format, id } from '@/utils/formatters';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

import api from '../lib/api';

export default function SensorsView({ readings: propReadings = [], nodes = [] }: { readings: any[]; nodes?: any[] }) {
  const { t } = useTranslation();
  const [internalReadings, setInternalReadings] = useState<any[]>([]);

  // Ensure readings are fetched directly if prop is empty or invalid
  useEffect(() => {
    const fetchReadings = async () => {
      try {
        const res = await api.get('/readings?limit=5000');
        const list = Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []);
        if (list.length > 0) {
          setInternalReadings(list);
        }
      } catch (e) {}
    };

    const propList = Array.isArray((propReadings as any)?.data) 
      ? (propReadings as any).data 
      : (Array.isArray(propReadings) ? propReadings : []);

    if (propList.length > 0) {
      setInternalReadings(propList);
    } else {
      fetchReadings();
    }
  }, [propReadings]);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [timeRange, setTimeRange] = useState("24h");
  const [nodeFilter, setNodeFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'table' | 'chart'>('table');

  // Normalize telemetry data based on meeting notes
  const normalizeReading = (r: any) => {
    const rawId = r.device_id || r.deviceId || r.db_id || "1";
    const rawCode = r.device_code || r.deviceCode || r.code || r.device_id || r.deviceId || rawId;

    // Wind direction parsing
    const rawWindDir = r.environment?.wind_direction ?? r.wind_direction ?? r.wind_dir;
    let windDirStr = "Utara (N)";
    if (typeof rawWindDir === 'number') {
      const dirs = ["Utara (N)", "Timur Laut (NE)", "Timur (E)", "Tenggara (SE)", "Selatan (S)", "Barat Daya (SW)", "Barat (W)", "Barat Laut (NW)"];
      const index = Math.round(rawWindDir / 45) % 8;
      windDirStr = `${dirs[index]}`;
    } else if (typeof rawWindDir === 'string' && rawWindDir.trim()) {
      windDirStr = rawWindDir;
    }

    // Battery voltage & percentage
    const batPercent = Math.min(100, Math.max(0, r.power?.battery_percent ?? r.battery_percent ?? r.battery ?? 0));
    const rawVolt = r.power?.battery_voltage ?? r.battery_voltage ?? r.voltage;
    const batVoltage = rawVolt ? Number(rawVolt).toFixed(2) : '0.00';

    return {
      timestamp: r.timestamp || r.reading_time || r.created_at || new Date().toISOString(),
      device_db_id: r.id || r.db_id || r.device_db_id || rawId,
      device_id: rawId,
      device_code: rawCode,
      latitude: r.location?.latitude ?? r.device?.latitude ?? r.latitude ?? 0,
      longitude: r.location?.longitude ?? r.device?.longitude ?? r.longitude ?? 0,
      altitude_m: r.location?.altitude_m ?? r.device?.altitude ?? r.altitude ?? 0,
      co2: r.carbon_data?.co2_ppm ?? r.co2_ppm ?? r.co2 ?? 0,
      tvoc: r.carbon_data?.tvoc_ppb ?? r.tvoc_ppb ?? r.tvoc ?? 0,
      ch4: r.carbon_data?.ch4_ppm ?? r.ch4_ppm ?? r.ch4 ?? 0,
      no2: r.carbon_data?.no2_ppb ?? r.no2_ppb ?? r.no2 ?? 0,
      n2o: r.carbon_data?.n2o_ppb ?? r.n2o_ppb ?? r.n2o ?? 0,
      temp: r.environment?.air_temperature_c ?? r.air_temperature_sensor ?? r.temp ?? 0,
      humidity: r.environment?.air_humidity_percent ?? r.air_humidity_sensor ?? r.humidity ?? 0,
      pressure: r.environment?.air_pressure_hpa ?? r.air_pressure_hpa ?? r.pressure ?? 0,
      windSpeed: r.environment?.wind_speed_kmh ?? r.wind_speed_kmh ?? r.wind ?? 0,
      windDirection: windDirStr,
      battery: batPercent,
      batteryVoltage: batVoltage,
    };
  };

  const nodeNameLookup = useMemo(() => {
    const lookup: Record<string, string> = {};
    nodes.forEach((n: any) => {
      const eydName = formatEYDDeviceName(n.name, n.device_code || String(n.id));
      if (n.id) lookup[String(n.id)] = eydName;
      if (n.device_code) lookup[String(n.device_code)] = eydName;
      if (n.db_id) lookup[String(n.db_id)] = eydName;
    });
    return lookup;
  }, [nodes]);

  const uniqueNodes = useMemo(() => {
    const list: { id: string; name: string }[] = [];
    const seen = new Set<string>();

    // 1. Tambahkan seluruh perangkat aktual yang terdaftar di database (nodes)
    nodes.forEach((n: any) => {
      const code = String(n.device_code || n.id || n.db_id);
      if (code && !seen.has(code)) {
        seen.add(code);
        list.push({
          id: code,
          name: formatEYDDeviceName(n.name, code)
        });
      }
    });

    // 2. Tambahkan device_code dari readings jika belum ada
    internalReadings.forEach(r => {
      const code = String(r.device_code || r.device_id || r.deviceId || r.db_id || '');
      if (code && !seen.has(code)) {
        seen.add(code);
        list.push({
          id: code,
          name: nodeNameLookup[code] || formatEYDDeviceName(code, code)
        });
      }
    });

    return list;
  }, [nodes, internalReadings, nodeNameLookup]);

  // Filtered telemetry records
  const filteredReadings = useMemo(() => {
    let filtered = internalReadings;

    if (nodeFilter !== "all") {
      filtered = filtered.filter(r => {
        const norm = normalizeReading(r);
        return String(norm.device_id) === nodeFilter || String(norm.device_code) === nodeFilter || String(norm.device_db_id) === nodeFilter;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(r => {
        const norm = normalizeReading(r);
        const name = (nodeNameLookup[norm.device_id] || norm.device_id).toLowerCase();
        return name.includes(q) || norm.device_id.toLowerCase().includes(q) || norm.device_code.toLowerCase().includes(q);
      });
    }

    if (date) {
      const selectedDate = new Date(date);
      selectedDate.setHours(23, 59, 59, 999);

      let startDate = new Date(selectedDate);
      if (timeRange === '24h') {
        startDate.setTime(selectedDate.getTime() - 24 * 60 * 60 * 1000);
      } else if (timeRange === '7d') {
        startDate.setDate(startDate.getDate() - 7);
      } else if (timeRange === '30d') {
        startDate.setDate(startDate.getDate() - 30);
      }

      filtered = filtered.filter(r => {
        const rawTime = r.timestamp || r.reading_time || r.created_at || 0;
        if (!rawTime) return true;
        const ts = new Date(rawTime);
        return ts >= startDate && ts <= selectedDate;
      });
    }

    return [...filtered].sort((a, b) => {
      const ta = new Date(a.timestamp || a.reading_time || a.created_at || 0).getTime();
      const tb = new Date(b.timestamp || b.reading_time || b.created_at || 0).getTime();
      return tb - ta;
    });
  }, [internalReadings, nodeFilter, searchQuery, date, timeRange, nodeNameLookup]);

  // Executive KPI summary calculations
  const kpiMetrics = useMemo(() => {
    if (filteredReadings.length === 0) {
      return { avgCo2: 0, avgTemp: 0, avgHumidity: 0, avgBattery: 0 };
    }
    let totalCo2 = 0;
    let totalTemp = 0;
    let totalHum = 0;
    let totalBat = 0;

    filteredReadings.forEach(raw => {
      const r = normalizeReading(raw);
      totalCo2 += r.co2;
      totalTemp += r.temp;
      totalHum += r.humidity;
      totalBat += r.battery;
    });

    const count = filteredReadings.length;
    return {
      avgCo2: (totalCo2 / count).toFixed(1),
      avgTemp: (totalTemp / count).toFixed(1),
      avgHumidity: (totalHum / count).toFixed(1),
      avgBattery: Math.round(totalBat / count),
    };
  }, [filteredReadings]);

  // Chart telemetry data format
  const chartData = useMemo(() => {
    return [...filteredReadings].reverse().map(raw => {
      const r = normalizeReading(raw);
      const timeStr = new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return {
        time: timeStr,
        co2: Number(r.co2.toFixed(1)),
        temp: Number(r.temp.toFixed(1)),
        humidity: Number(r.humidity.toFixed(1)),
        device: r.device_code,
      };
    });
  }, [filteredReadings]);

  const totalPages = Math.max(1, Math.ceil(filteredReadings.length / itemsPerPage));
  const paginatedReadings = filteredReadings.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => { setCurrentPage(1); }, [nodeFilter, searchQuery, date, timeRange]);

  const handleExportCSV = () => {
    if (filteredReadings.length === 0) {
      toast.error("Tidak ada data telemetry untuk diekspor!");
      return;
    }

    const exportData = filteredReadings.map(raw => {
      const r = normalizeReading(raw);
      return {
        "Waktu Telemetry": formatDateTime(r.timestamp),
        "ID Perangkat": r.device_db_id,
        "Kode RH Perangkat": r.device_code,
        "Nama Node": nodeNameLookup[r.device_id] || r.device_id,
        "Latitude": r.latitude,
        "Longitude": r.longitude,
        "Ketinggian (m)": r.altitude_m,
        "Kecepatan Angin (km/h)": r.windSpeed,
        "Arah Angin (BMKG)": `${r.windDirection} (BMKG Sync)`,
        "CO2 (ppm)": r.co2,
        "CH4 (ppm)": r.ch4,
        "NO2 (ppb)": r.no2,
        "Suhu Udara (°C)": r.temp,
        "Kelembapan Udara (%)": r.humidity,
        "Baterai": `${r.battery}% (${r.batteryVoltage}V)`,
      };
    });

    try {
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Data Telemetry Sensor");

      const titlePrefix = nodeFilter === "all" ? "Semua_Node" : nodeFilter;
      const datePrefix = formatFilePrefix();

      XLSX.writeFile(workbook, `Export_Telemetry_${titlePrefix}_${datePrefix}.csv`, { bookType: 'csv' });
      toast.success(`Berhasil! Data telemetry (${exportData.length} records) telah diunduh.`);
    } catch (error) {
      console.error(error);
      toast.error("Gagal melakukan proses Export file CSV.");
    }
  };

  return (
    <div className="w-full space-y-6 px-4 md:px-6 py-2 pb-10">
      {/* Top Header Card - Symmetrical 2-Row Layout */}
      <div className="w-full bg-card/70 backdrop-blur-md p-5 sm:p-6 rounded-3xl border border-border/80 shadow-xl shadow-black/5 space-y-4">
        {/* Row 1: Title + Action Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-600 rounded-2xl border border-emerald-500/20 shrink-0">
              <Gauge size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-foreground">{t("Pusat Data Sensor")}</h1>
              <p className="text-xs font-semibold text-muted-foreground mt-0.5">
                Monitoring telemetri real-time emisi karbon (CO₂, CH₄, NO₂) & iklim mikro perkebunan
              </p>
            </div>
          </div>

          <Button
            onClick={handleExportCSV}
            className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-2 shadow-lg shadow-emerald-500/20 shrink-0 w-full sm:w-auto"
          >
            <FileSpreadsheet size={16} />
            <span>Export CSV</span>
          </Button>
        </div>

        {/* Row 2: Filter Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Live Search Input */}
          <div className="relative w-full">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("Cari Kode RH / Node...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 text-xs font-semibold bg-background/80 border-border/60 rounded-xl focus:ring-2 focus:ring-emerald-500/50 w-full"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Node Filter */}
          <div className="relative flex items-center w-full">
            <Cpu size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none z-10 shrink-0" />
            <select
              value={nodeFilter}
              onChange={(e) => setNodeFilter(e.target.value || 'all')}
              className="w-full h-10 pl-8.5 pr-8 bg-background/80 border border-border/60 font-semibold text-xs rounded-xl text-foreground focus:ring-2 focus:ring-emerald-500/50 outline-none cursor-pointer appearance-none transition-all shadow-xs"
            >
              <option value="all" className="font-bold text-xs bg-card text-foreground">
                {t('Semua Perangkat')}
              </option>
              {uniqueNodes.map(node => (
                <option key={node.id} value={node.id} className="font-bold text-xs bg-card text-foreground">
                  {node.name} ({node.id})
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* Time Range Selector */}
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v || '24h')}>
            <SelectTrigger className="w-full bg-background/80 border-border/60 font-semibold text-xs rounded-xl h-10">
              <SelectValue placeholder={t("Rentang")} />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-border shadow-2xl">
              <SelectItem value="24h" className="font-semibold text-xs">{t("24 Jam Terakhir")}</SelectItem>
              <SelectItem value="7d" className="font-semibold text-xs">{t("7 Hari Terakhir")}</SelectItem>
              <SelectItem value="30d" className="font-semibold text-xs">{t("30 Hari Terakhir")}</SelectItem>
            </SelectContent>
          </Select>

          {/* Date Picker */}
          <Popover>
            <PopoverTrigger className="w-full inline-flex items-center justify-between h-10 px-3.5 rounded-xl gap-2 font-semibold text-xs bg-background/80 text-foreground hover:bg-muted/50 border border-border/60 transition-all">
              <div className="flex items-center gap-2">
                <CalendarIcon size={14} className="text-emerald-500 shrink-0" />
                <span className="truncate">{date ? format(date, "d MMM yyyy", { locale: id }) : t("Pilih tanggal")}</span>
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 rounded-2xl" align="end">
              <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Top 4 KPI Executive Metric Cards */}
      <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: CO2 */}
        <Card className="border-border/60 bg-gradient-to-br from-card to-emerald-500/5 shadow-xl shadow-black/5 rounded-2xl overflow-hidden relative">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{t('Rata-rata CO₂ (PPM)')}</span>
              <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-xl">
                <CloudSun size={18} />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-foreground">{kpiMetrics.avgCo2}</span>
              <span className="text-xs font-bold text-emerald-600">PPM</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-[10px] font-semibold text-muted-foreground border-t border-border/40 pt-2">
              <span>{t('Ambang Optimal')}: 350 - 550</span>
              <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-bold px-1.5">{t('Aman')}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* KPI 2: Temperature */}
        <Card className="border-border/60 bg-gradient-to-br from-card to-amber-500/5 shadow-xl shadow-black/5 rounded-2xl overflow-hidden relative">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{t('Suhu Udara Rata-rata')}</span>
              <div className="p-2 bg-amber-500/10 text-amber-600 rounded-xl">
                <Thermometer size={18} />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-foreground">{kpiMetrics.avgTemp}°</span>
              <span className="text-xs font-bold text-amber-600">Celsius</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-[10px] font-semibold text-muted-foreground border-t border-border/40 pt-2">
              <span>{t('Iklim Mikro Perkebunan')}</span>
              <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-600 border-amber-500/20 font-bold px-1.5">{t('Normal')}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* KPI 3: Humidity */}
        <Card className="border-border/60 bg-gradient-to-br from-card to-blue-500/5 shadow-xl shadow-black/5 rounded-2xl overflow-hidden relative">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{t('Kelembapan Udara')}</span>
              <div className="p-2 bg-blue-500/10 text-blue-600 rounded-xl">
                <Droplets size={18} />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-foreground">{kpiMetrics.avgHumidity}%</span>
              <span className="text-xs font-bold text-blue-600">RH</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-[10px] font-semibold text-muted-foreground border-t border-border/40 pt-2">
              <span>{t('Sensor Lingkungan')}</span>
              <Badge variant="outline" className="text-[9px] bg-blue-500/10 text-blue-600 border-blue-500/20 font-bold px-1.5">{t('Optimal')}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* KPI 4: Battery & Data Points */}
        <Card className="border-border/60 bg-gradient-to-br from-card to-purple-500/5 shadow-xl shadow-black/5 rounded-2xl overflow-hidden relative">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{t('Total Catatan Telemetri')}</span>
              <div className="p-2 bg-purple-500/10 text-purple-600 rounded-xl">
                <Activity size={18} />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-foreground">{filteredReadings.length}</span>
              <span className="text-xs font-bold text-purple-600">{t('Catatan')}</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-[10px] font-semibold text-muted-foreground border-t border-border/40 pt-2">
              <span>{t('Baterai Rata-rata')}: {kpiMetrics.avgBattery}%</span>
              <Badge variant="outline" className="text-[9px] bg-purple-500/10 text-purple-600 border-purple-500/20 font-bold px-1.5">Live Sync</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Full-width View Switcher & Main Display */}
      <div className="w-full space-y-4">
        {/* Full-width Tab Switcher Header */}
        <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
          <div className="bg-card border border-border/60 rounded-2xl p-1 inline-flex items-center gap-1">
            <button
              onClick={() => setActiveTab('table')}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer",
                activeTab === 'table' ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              <TableIcon size={14} />
              <span>Tabel Telemetri ({filteredReadings.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('chart')}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer",
                activeTab === 'chart' ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              <BarChart2 size={14} />
              <span>Grafik Tren Telemetri</span>
            </button>
          </div>

          <span className="text-xs font-bold text-muted-foreground">
            {t('Terhubung ke API Backend AgriSense & Perangkat IoT Node ESP32 (.ino)')}
          </span>
        </div>

        {/* View 1: Telemetry Data Table (Consistently styled with NodeTable.tsx) */}
        {activeTab === 'table' && (
          <Card className="w-full border-border/80 shadow-2xl shadow-black/5 rounded-3xl overflow-hidden bg-card">
            <div className="bg-sky-500/10 border-b border-sky-500/20 px-6 py-2.5 flex items-center gap-2 text-xs font-semibold text-sky-700 dark:text-sky-300">
              <Info size={14} className="shrink-0 text-sky-500" />
              <span>{t('Catatan: Data Arah Angin disinkronkan langsung dari Stasiun Cuaca BMKG terdekat (BMKG Sync).')}</span>
            </div>
            <div className="overflow-x-auto w-full">
              <Table className="w-full">
                <TableHeader className="bg-muted/50">
                  <TableRow className="hover:bg-transparent border-b border-border">
                    <TableHead className="py-3 pl-6 font-bold text-xs uppercase tracking-wider text-muted-foreground">{t('Waktu Telemetry')}</TableHead>
                    <TableHead className="py-3 font-bold text-xs uppercase tracking-wider text-muted-foreground">{t('ID Perangkat')}</TableHead>
                    <TableHead className="py-3 font-bold text-xs uppercase tracking-wider text-muted-foreground">{t('Kode / Nomor Seri (RH)')}</TableHead>
                    <TableHead className="py-3 font-bold text-xs uppercase tracking-wider text-muted-foreground">{t('Nama Perangkat')}</TableHead>
                    <TableHead className="py-3 font-bold text-xs uppercase tracking-wider text-muted-foreground">{t('Kecepatan Angin')}</TableHead>
                    <TableHead className="py-3 font-bold text-xs uppercase tracking-wider text-muted-foreground">{t('Arah Angin (BMKG)')}</TableHead>
                    <TableHead className="py-3 font-bold text-xs uppercase tracking-wider text-muted-foreground">{t('Latitude')}</TableHead>
                    <TableHead className="py-3 font-bold text-xs uppercase tracking-wider text-muted-foreground">{t('Longitude')}</TableHead>
                    <TableHead className="py-3 font-bold text-xs uppercase tracking-wider text-muted-foreground">{t('Altitude (mdpl)')}</TableHead>
                    <TableHead className="py-3 font-bold text-xs uppercase tracking-wider text-muted-foreground">{t('Baterai & Tegangan')}</TableHead>
                    <TableHead className="py-3 font-bold text-xs uppercase tracking-wider text-emerald-600 dark:text-emerald-400">CO₂ (ppm)</TableHead>
                    <TableHead className="py-3 font-bold text-xs uppercase tracking-wider text-muted-foreground">CH₄ (ppm)</TableHead>
                    <TableHead className="py-3 font-bold text-xs uppercase tracking-wider text-muted-foreground">NO₂ (ppb)</TableHead>
                    <TableHead className="py-3 font-bold text-xs uppercase tracking-wider text-muted-foreground">{t('Suhu Udara (°C)')}</TableHead>
                    <TableHead className="py-3 pr-6 font-bold text-xs uppercase tracking-wider text-muted-foreground">{t('Kelembapan (%)')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedReadings.length > 0 ? (
                    paginatedReadings.map((raw, i) => {
                      const r = normalizeReading(raw);
                      const rawNodeName = nodeNameLookup[r.device_code] || nodeNameLookup[r.device_id] || r.device_code;
                      const nodeName = formatEYDDeviceName(rawNodeName, r.device_code);
                      const isCriticalBat = r.battery <= 15;
                      return (
                        <TableRow key={i} className="hover:bg-muted/20 transition-colors border-b border-border/50">
                          <TableCell className="text-sm font-bold py-3 pl-6 text-foreground whitespace-nowrap">
                            {formatDateTime(r.timestamp)}
                          </TableCell>
                          <TableCell className="text-sm font-bold py-3 text-foreground whitespace-nowrap">
                            {r.device_db_id}
                          </TableCell>
                          <TableCell className="py-3 whitespace-nowrap">
                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-black text-xs px-2.5 py-0.5 rounded-full">
                              {r.device_code}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm font-bold py-3 text-foreground whitespace-nowrap">
                            {nodeName}
                          </TableCell>
                          <TableCell className="py-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <Wind size={14} className="text-sky-500 shrink-0" />
                              <span className="text-sm font-semibold text-muted-foreground">{r.windSpeed} km/h</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <Compass size={14} className="text-amber-500 shrink-0" />
                              <span className="text-sm font-semibold text-muted-foreground">{r.windDirection}</span>
                              <Badge variant="secondary" className="bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20 text-[9px] font-extrabold px-1.5 py-0">BMKG</Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm font-mono font-semibold py-3 text-muted-foreground whitespace-nowrap">
                            {r.latitude.toFixed(6)}
                          </TableCell>
                          <TableCell className="text-sm font-mono font-semibold py-3 text-muted-foreground whitespace-nowrap">
                            {r.longitude.toFixed(6)}
                          </TableCell>
                          <TableCell className="text-sm font-mono font-bold py-3 text-foreground whitespace-nowrap">
                            {r.altitude_m ? `${r.altitude_m} MDPL` : '720 MDPL'}
                          </TableCell>
                          <TableCell className="py-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className={cn("w-8 h-4 rounded-sm relative overflow-hidden border bg-muted", isCriticalBat ? "border-destructive bg-destructive/20 animate-pulse" : "border-border")}>
                                <div
                                  className={cn("h-full transition-all duration-500", isCriticalBat ? "bg-destructive" : "bg-emerald-500")}
                                  style={{ width: `${r.battery}%` }}
                                />
                              </div>
                              <span className={cn("text-xs font-bold", isCriticalBat ? "text-destructive" : "text-muted-foreground")}>
                                {r.battery}% <span className="font-semibold text-[11px] text-muted-foreground">({r.batteryVoltage}V)</span>
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="py-3 font-black text-sm text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-black text-xs px-2.5 py-0.5 rounded-md">
                              {r.co2.toFixed(1)} ppm
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm font-bold py-3 text-foreground whitespace-nowrap">{r.ch4.toFixed(1)} ppm</TableCell>
                          <TableCell className="text-sm font-bold py-3 text-foreground whitespace-nowrap">{r.no2.toFixed(1)} ppb</TableCell>
                          <TableCell className="text-sm font-extrabold py-3 text-amber-600 dark:text-amber-400 whitespace-nowrap">{r.temp.toFixed(1)}°C</TableCell>
                          <TableCell className="text-sm font-extrabold py-3 pr-6 text-blue-600 dark:text-blue-400 whitespace-nowrap">{r.humidity.toFixed(1)}%</TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={15} className="h-40 text-center text-muted-foreground font-semibold">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground py-8">
                          <Search size={32} className="opacity-20" />
                          <p className="font-bold text-sm">Tidak ada data telemetri yang sesuai dengan filter.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-border/60 gap-4 bg-muted/20">
              <div className="flex items-center gap-4">
                <p className="text-xs text-muted-foreground font-semibold">
                  Menampilkan {filteredReadings.length > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0}-{Math.min(currentPage * itemsPerPage, filteredReadings.length)} dari {filteredReadings.length} telemetri
                </p>
                <div className="h-4 w-px bg-border hidden sm:block" />
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Baris:</span>
                  <Select value={itemsPerPage.toString()} onValueChange={(v) => { setItemsPerPage(parseInt(v || '10')); setCurrentPage(1); }}>
                    <SelectTrigger className="h-8 w-[70px] text-xs border-border/60 bg-background font-bold rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border shadow-2xl">
                      <SelectItem value="10" className="text-xs font-bold">10</SelectItem>
                      <SelectItem value="15" className="text-xs font-bold">15</SelectItem>
                      <SelectItem value="25" className="text-xs font-bold">25</SelectItem>
                      <SelectItem value="50" className="text-xs font-bold">50</SelectItem>
                      <SelectItem value="100" className="text-xs font-bold">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                  className="h-8 px-3 text-xs font-bold rounded-xl"
                >
                  Sebelumnya
                </Button>

                <div className="flex items-center mx-1 gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let page: number;
                    if (totalPages <= 5) page = i + 1;
                    else if (currentPage <= 3) page = i + 1;
                    else if (currentPage >= totalPages - 2) page = totalPages - 4 + i;
                    else page = currentPage - 2 + i;

                    return (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        className={cn(
                          "h-8 w-8 text-xs font-bold rounded-xl p-0 transition-all",
                          currentPage === page ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20" : ""
                        )}
                      >
                        {page}
                      </Button>
                    );
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                  className="h-8 px-3 text-xs font-bold rounded-xl"
                >
                  Berikutnya
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* View 2: Telemetry Trend Chart */}
        {activeTab === 'chart' && (
          <Card className="w-full border-border/80 shadow-2xl shadow-black/5 rounded-3xl p-6 bg-card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-black tracking-tight text-foreground">Grafik Tren Emisi CO₂ & Suhu Udara</h3>
                <p className="text-xs font-semibold text-muted-foreground">Fluktuasi emisi gas rumah kaca dan iklim mikro perkebunan</p>
              </div>
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-bold px-2.5 py-1">
                {t('Real-time Sync (.ino Node ESP32)')}
              </Badge>
            </div>

            <div className="h-[360px] w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="co2Color" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="tempColor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="time" tick={{ fontSize: 11, fontWeight: 700 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11, fontWeight: 700 }} unit=" ppm" />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fontWeight: 700 }} unit="°C" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.9)',
                      borderRadius: '16px',
                      borderColor: 'rgba(255,255,255,0.1)',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '12px'
                    }}
                  />
                  <Area yAxisId="left" type="monotone" dataKey="co2" name="Emisi CO₂ (ppm)" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#co2Color)" />
                  <Area yAxisId="right" type="monotone" dataKey="temp" name="Suhu Udara (°C)" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#tempColor)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
