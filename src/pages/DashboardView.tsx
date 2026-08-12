import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard, Radio, Database, CloudSun, CloudRain, Map as MapIcon, BarChart3,
  FileText, Settings, Users, Bell, Search, Menu, X, Droplets, Thermometer,
  Wind, Battery, Signal, AlertTriangle, Leaf, LogIn, LogOut, Calendar as CalendarIcon,
  FlaskConical, Zap, Activity, Filter, Plus, Save, MoreVertical, Edit, Trash2,
  Download, CheckCircle2, Eye, EyeOff, Trees, Layers, Sprout, MapPin, SearchIcon,
  Share2, Info, Brain, ChevronRight, Globe, Layers3, Cpu, Compass, Building2,
  ArrowUpRight, ArrowDownRight, ShieldCheck, Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, formatTime, id } from '@/utils/formatters';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { IoTNode, formatEYDDeviceName } from '../lib/mockData';
import { cn } from '@/lib/utils';
import api from '../lib/api';
import { translateWeather } from '../constants/agriConstants';

import { StatCard } from '../components/Dashboard/StatCard';
import { SensorCard } from '../components/Dashboard/SensorCard';

export default function DashboardView({ stats, nodes: propNodes, onNavigate }: { stats: any, nodes: IoTNode[], onNavigate?: (path: string) => void }) {
  const { t, i18n } = useTranslation();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [timeRange, setTimeRange] = useState("24h");
  const [chartParam, setChartParam] = useState("co2_ppm");

  const [nodes, setNodes] = useState<IoTNode[]>(propNodes || []);
  const [selectedNodeId, setSelectedNodeId] = useState<string>("");
  const [weatherData, setWeatherData] = useState<any>(null);
  const [realReadings, setRealReadings] = useState<any[]>([]);
  const [landPlots, setLandPlots] = useState<any[]>([]);
  const [gardens, setGardens] = useState<any[]>([]);
  const [plantings, setPlantings] = useState<any[]>([]);
  const [displayMode, setDisplayMode] = useState<'lahan' | 'wilayah'>('lahan');

  // Auto-switch label display mode every 10 seconds for executive presentation
  useEffect(() => {
    const interval = setInterval(() => {
      setDisplayMode(prev => prev === 'wilayah' ? 'lahan' : 'wilayah');
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Sync prop nodes & auto select first available node
  useEffect(() => {
    if (propNodes && propNodes.length > 0) {
      setNodes(propNodes);
      if (!selectedNodeId) {
        setSelectedNodeId(propNodes[0].id);
      }
    }
  }, [propNodes]);

  // Fetch initial telemetry readings & GIS entities
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [readingsRes, landRes, gardenRes, plantRes] = await Promise.allSettled([
          api.get('/readings?limit=1500'),
          api.get('/land-plots'),
          api.get('/gardens'),
          api.get('/plantings')
        ]);

        if (readingsRes.status === 'fulfilled') {
          const rData = readingsRes.value.data?.data || readingsRes.value.data;
          if (Array.isArray(rData)) setRealReadings(rData);
        }

        if (landRes.status === 'fulfilled') {
          const lData = landRes.value.data?.data || landRes.value.data;
          if (Array.isArray(lData)) setLandPlots(lData);
        }

        if (gardenRes.status === 'fulfilled') {
          const gData = gardenRes.value.data?.data || gardenRes.value.data;
          if (Array.isArray(gData)) setGardens(gData);
        }

        if (plantRes.status === 'fulfilled') {
          const pData = plantRes.value.data?.data || plantRes.value.data;
          if (Array.isArray(pData)) setPlantings(pData);
        }
      } catch (err) {
        console.error("Dashboard failed to fetch initial data:", err);
      }
    };
    fetchInitialData();

    // Auto-refresh readings every 15 seconds for real-time telemetry
    const refreshReadings = async () => {
      try {
        const res = await api.get('/readings?limit=1500');
        const rData = res.data?.data || res.data;
        if (Array.isArray(rData)) setRealReadings(rData);
      } catch { /* silent */ }
    };
    const readingsInterval = setInterval(refreshReadings, 15000);

    // Listen to real-time node updates from backend event bus
    const handleNodesUpdated = async () => {
      try {
        const [nodesRes, readingsRes] = await Promise.allSettled([
          api.get('/nodes'),
          api.get('/readings?limit=1500')
        ]);
        if (nodesRes.status === 'fulfilled') {
          const list = nodesRes.value.data?.data || nodesRes.value.data;
          if (Array.isArray(list)) setNodes(list);
        }
        if (readingsRes.status === 'fulfilled') {
          const rData = readingsRes.value.data?.data || readingsRes.value.data;
          if (Array.isArray(rData)) setRealReadings(rData);
        }
      } catch (e) { console.error("Error refreshing nodes", e); }
    };
    window.addEventListener('nodes:updated', handleNodesUpdated);

    return () => {
      clearInterval(readingsInterval);
      window.removeEventListener('nodes:updated', handleNodesUpdated);
    };
  }, []);

  // Filter readings and data based on selected Node
  const activeNode = useMemo(() => {
    if (!selectedNodeId && nodes.length > 0) return nodes[0];
    return nodes.find(n => n.id.toString() === selectedNodeId) || nodes[0];
  }, [nodes, selectedNodeId]);

  const activeLandPlot = useMemo(() => {
    if (!activeNode) return null;
    const lId = (activeNode as any).lahanId || (activeNode as any).lahan_id;
    return landPlots.find(l => l.id.toString() === String(lId));
  }, [activeNode, landPlots]);

  const activeGarden = useMemo(() => {
    if (!activeNode) return null;
    const gId = (activeNode as any).gardenId || (activeNode as any).garden_id;
    return gardens.find(g => g.id.toString() === String(gId));
  }, [activeNode, gardens]);

  const activePlanting = useMemo(() => {
    if (!activeNode) return null;
    return plantings.find(p => p.device_id?.toString() === activeNode.id.toString() || p.device_code === activeNode.device_code);
  }, [activeNode, plantings]);

  const activeReadings = useMemo(() => {
    if (!activeNode) return realReadings;
    const targetCode = String(activeNode.device_code || activeNode.id);
    let filtered = realReadings.filter(r =>
      String(r.device_code || r.device_id || r.deviceId || '') === targetCode
    );

    if (date) {
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();

      const selectedDate = new Date(date);
      if (isToday) {
        selectedDate.setTime(now.getTime());
      } else {
        selectedDate.setHours(23, 59, 59, 999);
      }

      let startDate = new Date(selectedDate);
      if (timeRange === '24h') {
        startDate.setTime(selectedDate.getTime() - 24 * 60 * 60 * 1000);
      } else if (timeRange === '7d') {
        startDate.setDate(startDate.getDate() - 7);
      } else if (timeRange === '30d') {
        startDate.setDate(startDate.getDate() - 30);
      } else {
        startDate.setFullYear(startDate.getFullYear() - 1);
      }

      filtered = filtered.filter(r => {
        const ts = new Date(r.timestamp || r.created_at);
        return ts >= startDate && ts <= selectedDate;
      });
    }
    return filtered;
  }, [realReadings, activeNode, date, timeRange]);

  const latestReading = useMemo(() => {
    return activeReadings.length > 0 ? activeReadings[0] : null;
  }, [activeReadings]);

  // Fetch BMKG weather data
  useEffect(() => {
    const fetchWeather = async () => {
      if (!activeNode) return;
      const lat = (activeNode as any).latitude || activeNode.coords?.[0] || -6.8315;
      const lng = (activeNode as any).longitude || activeNode.coords?.[1] || 107.9160;

      try {
        const res = await api.get(`/bmkg?lat=${lat}&lng=${lng}`);
        if (res.data?.status === "success") setWeatherData(res.data);
      } catch (err) { }
    };
    fetchWeather();
  }, [activeNode]);

  // Group readings for Chart Analysis
  const chartData = useMemo(() => {
    const raw = activeReadings
      .map(r => ({
        timestamp: r.timestamp || r.created_at || new Date().toISOString(),
        co2_ppm: r.carbon_data?.co2_ppm ?? r.co2_ppm ?? 0,
        ch4_ppm: r.carbon_data?.ch4_ppm ?? r.ch4_ppm ?? 0,
        no2_ppb: r.carbon_data?.no2_ppb ?? r.no2_ppb ?? 0,
        air_temp: r.environment?.air_temperature_c ?? r.air_temperature_c ?? r.temp ?? 0,
        air_humidity: r.environment?.air_humidity_percent ?? r.air_humidity_percent ?? r.humidity ?? 0,
        wind_speed: r.environment?.wind_speed_kmh ?? r.wind_speed_kmh ?? 0,
        wind_direction: r.environment?.wind_direction_deg ?? r.wind_direction_deg ?? 180,
        battery_voltage: r.power?.battery_voltage ?? r.battery_voltage ?? 12.2,
        altitude: r.location?.altitude_m ?? r.altitude_m ?? 720,
        battery_percent: r.power?.battery_percent ?? r.battery_percent ?? 85,
        rssi: r.communication?.rssi_dbm ?? r.rssi ?? -72,
        rainfall_mm: r.environment?.rainfall_mm ?? r.rainfall_mm ?? r.rain ?? 0
      }))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    if (raw.length === 0) return [];

    const groupMap: Record<string, any> = {};

    raw.forEach(r => {
      const d = new Date(r.timestamp);
      let key = "";
      if (timeRange === '24h') {
        key = format(d, 'yyyy-MM-dd HH:00');
      } else if (timeRange === '7d') {
        key = format(d, 'yyyy-MM-dd');
      } else {
        const weekNum = Math.ceil((d.getDate()) / 7);
        key = `Minggu ${weekNum} - ${format(d, 'MMM', { locale: id })}`;
      }

      if (!groupMap[key]) {
        groupMap[key] = {
          timestamp: d.toISOString(),
          displayLabel: key,
          co2_ppm: 0, ch4_ppm: 0, no2_ppb: 0, air_temp: 0, air_humidity: 0,
          wind_speed: 0, wind_direction: 0, battery_voltage: 0, altitude: 0,
          battery_percent: 0, rssi: 0, rainfall_mm: 0, count: 0
        };
      }
      groupMap[key].co2_ppm += r.co2_ppm;
      groupMap[key].ch4_ppm += r.ch4_ppm;
      groupMap[key].no2_ppb += r.no2_ppb;
      groupMap[key].air_temp += r.air_temp;
      groupMap[key].air_humidity += r.air_humidity;
      groupMap[key].wind_speed += r.wind_speed;
      groupMap[key].wind_direction += r.wind_direction;
      groupMap[key].battery_voltage += r.battery_voltage;
      groupMap[key].altitude += r.altitude;
      groupMap[key].battery_percent += r.battery_percent;
      groupMap[key].rssi += r.rssi;
      groupMap[key].rainfall_mm += r.rainfall_mm;
      groupMap[key].count += 1;
    });

    return Object.values(groupMap).map((g: any) => ({
      timestamp: g.timestamp,
      displayLabel: g.displayLabel,
      co2_ppm: Number((g.co2_ppm / g.count).toFixed(1)),
      ch4_ppm: Number((g.ch4_ppm / g.count).toFixed(1)),
      no2_ppb: Number((g.no2_ppb / g.count).toFixed(1)),
      air_temp: Number((g.air_temp / g.count).toFixed(1)),
      air_humidity: Number((g.air_humidity / g.count).toFixed(1)),
      wind_speed: Number((g.wind_speed / g.count).toFixed(1)),
      wind_direction: Number((g.wind_direction / g.count).toFixed(0)),
      battery_voltage: Number((g.battery_voltage / g.count).toFixed(2)),
      altitude: Number((g.altitude / g.count).toFixed(0)),
      battery_percent: Number((g.battery_percent / g.count).toFixed(0)),
      rssi: Number((g.rssi / g.count).toFixed(0)),
      rainfall_mm: Number((g.rainfall_mm / g.count).toFixed(1)),
    }));
  }, [activeReadings, timeRange]);

  // Aggregate Executive Stats
  const onlineCount = nodes.filter(n => n.status === 'online').length;
  const warningCount = nodes.filter(n => n.status === 'warning').length;
  const offlineCount = nodes.filter(n => n.status === 'offline').length;
  const totalAreaHa = landPlots.reduce((sum, l) => sum + Number(l.area_hectare || 0), 0);

  const resolvedPlantName = activeNode?.plant_name || activePlanting?.nama_tanaman || activeGarden?.plant_types || activeLandPlot?.plant_types || t('Belum ditentukan');
  const resolvedFirmware = latestReading?.firmware_version || latestReading?.firmware || (activeNode as any)?.firmware_version || (activeNode as any)?.firmware || '1.0.0';
  const cleanFirmware = resolvedFirmware.toString().replace(/^fw\s*v?/i, '').replace(/^v/i, '');

  return (
    <div className="w-full space-y-8 max-w-7xl mx-auto pb-24 select-none">
      {/* ── Executive Header Dashboard & Node Selector Bar ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 border-b border-border/60 pb-5">
        <div className="flex flex-wrap items-center gap-3.5">
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-xs shrink-0">
            <LayoutDashboard size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-black tracking-tight text-foreground">{t("Dasbor Eksekutif Monitoring")}</h1>
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px] font-black uppercase px-2 py-0.5 rounded-md flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Real-Time .ino MQTT</span>
              </Badge>
            </div>
            <p className="text-xs font-semibold text-muted-foreground mt-0.5">
              {t("Pusat komando pemantauan iklim mikro, telemetri sensor IoT, dan status sektor pertanian Subang")}
            </p>
          </div>
        </div>

        {/* Controls: Node Selector & Date Filter */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Native Clean Select Node Dropdown */}
          <div className="relative flex items-center min-w-[240px] sm:min-w-[280px]">
            <Radio size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-600 pointer-events-none z-10 animate-pulse shrink-0" />
            <select
              value={selectedNodeId}
              onChange={(e) => setSelectedNodeId(e.target.value)}
              className="w-full h-11 pl-9 pr-8 bg-card border border-border/80 font-bold text-xs rounded-2xl text-foreground focus:ring-2 focus:ring-emerald-500/50 outline-none cursor-pointer appearance-none shadow-xs transition-all"
            >
              {nodes.map(n => (
                <option key={n.id} value={n.id.toString()} className="font-bold text-xs bg-card text-foreground">
                  {formatEYDDeviceName(n.name, n.device_code || n.id)}
                </option>
              ))}
            </select>
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* Date Picker */}
          <Popover>
            <PopoverTrigger className="inline-flex items-center justify-center h-11 px-4 rounded-2xl gap-2 font-bold text-xs bg-card text-foreground hover:bg-muted shadow-xs border border-border/80 focus-visible:outline-none transition-all cursor-pointer">
              <CalendarIcon size={15} className="text-muted-foreground" />
              {date ? format(date, "d MMM yyyy", { locale: id }) : <span>{t("Pilih tanggal")}</span>}
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 rounded-2xl border-border/80 shadow-2xl z-[2000]" align="end">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          {/* Time Range Selector */}
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value || '24h')}
            className="h-11 px-3.5 bg-card border border-border/80 font-bold text-xs rounded-2xl text-foreground outline-none cursor-pointer shadow-xs"
          >
            <option value="24h" className="font-bold text-xs bg-card text-foreground">{t("24 Jam Terakhir")}</option>
            <option value="7d" className="font-bold text-xs bg-card text-foreground">{t("7 Hari Terakhir")}</option>
            <option value="30d" className="font-bold text-xs bg-card text-foreground">{t("30 Hari Terakhir")}</option>
            <option value="1y" className="font-bold text-xs bg-card text-foreground">{t("1 Tahun Terakhir")}</option>
          </select>
        </div>
      </div>

      {/* ── Active Node Executive Highlight Banner ── */}
      {activeNode && (
        <div className="bg-gradient-to-r from-emerald-600/10 via-card to-blue-600/10 p-5 rounded-[28px] border border-border/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3.5 rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-600/30 shrink-0">
              <Cpu size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-foreground tracking-tight">{formatEYDDeviceName(activeNode.name, activeNode.device_code || activeNode.id)}</h2>
                <Badge variant="outline" className={cn(
                  "text-[10px] px-2.5 py-0.5 font-extrabold uppercase rounded-lg border flex items-center gap-1.5",
                  ((activeNode.status as string) === 'online' || (activeNode.status as string) === 'aktif') ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40" : ((activeNode.status as string) === 'warning' || (activeNode.status as string) === 'peringatan') ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40" : "bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/40"
                )}>
                  <span className={cn(
                    "w-2 h-2 rounded-full shrink-0",
                    ((activeNode.status as string) === 'online' || (activeNode.status as string) === 'aktif') ? "bg-emerald-500 animate-pulse" : ((activeNode.status as string) === 'warning' || (activeNode.status as string) === 'peringatan') ? "bg-amber-500 animate-pulse" : "bg-rose-500"
                  )} />
                  {((activeNode.status as string) === 'online' || (activeNode.status as string) === 'aktif') ? t('Aktif') : ((activeNode.status as string) === 'warning' || (activeNode.status as string) === 'peringatan') ? t('Peringatan') : t('Tidak Aktif')}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-muted-foreground mt-1">
                <span className="flex items-center gap-1 text-foreground font-bold">
                  <MapPin size={13} className="text-emerald-600" />
                  {activeNode.location}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 text-emerald-600 font-bold">
                  <Sprout size={13} />
                  {resolvedPlantName}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-bold">
                  <Cpu size={13} />
                  FW v{cleanFirmware}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-10 px-4 rounded-xl font-extrabold text-xs border-border/80 hover:bg-muted cursor-pointer gap-2"
              onClick={() => onNavigate?.('/map')}
            >
              <MapIcon size={14} className="text-blue-600" />
              <span>{t("Lihat Peta GIS")}</span>
            </Button>

            <Button
              size="sm"
              className="h-10 px-4 rounded-xl font-extrabold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer gap-2"
              onClick={() => onNavigate?.('/sensors')}
            >
              <Activity size={14} />
              <span>{t("Pusat Telemetri")}</span>
            </Button>
          </div>
        </div>
      )}

      {/* ── Executive Top Overview KPI Grid ── */}
      <motion.div
        className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-5"
        initial="hidden"
        animate="show"
        variants={{
          hidden: { opacity: 0 },
          show: { opacity: 1, transition: { staggerChildren: 0.1 } }
        }}
      >
        <motion.div variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } }}>
          <StatCard
            title={t("Perangkat Aktif")}
            value={onlineCount}
            total={nodes.length}
            icon="https://cdn-icons-png.flaticon.com/512/7903/7903716.png"
            color="text-emerald-600"
            isFlippable={true}
            flipContent={
              <div className="space-y-1 w-full text-center">
                <div className="text-[10px] font-black text-white uppercase tracking-widest border-b border-white/25 pb-1">{t("Status Perangkat")}</div>
                <p className="text-[9.5px] text-white/90 font-medium leading-relaxed">
                  {t("Jumlah node IoT yang terhubung dan aktif mengirimkan log MQTT ke server.")}
                </p>
              </div>
            }
          />
        </motion.div>

        <motion.div variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } }}>
          <StatCard
            title={t("Peringatan / Alert")}
            value={warningCount}
            total={nodes.length}
            icon="https://cdn-icons-png.flaticon.com/512/272/272340.png"
            color="text-amber-500"
            isFlippable={true}
            flipContent={
              <div className="space-y-1 w-full text-center">
                <div className="text-[10px] font-black text-white uppercase tracking-widest border-b border-white/25 pb-1">{t("Anomali Lingkungan")}</div>
                <p className="text-[9.5px] text-white/90 font-medium leading-relaxed">
                  {t("Node yang mendeteksi parameter di luar batas ideal atau memiliki baterai lemah.")}
                </p>
              </div>
            }
          />
        </motion.div>

        <motion.div variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } }}>
          <StatCard
            title={t("Tidak Aktif")}
            value={offlineCount}
            total={nodes.length}
            icon="https://cdn-icons-png.flaticon.com/512/3334/3334877.png"
            color="text-rose-500"
            isFlippable={true}
            flipContent={
              <div className="space-y-1 w-full text-center">
                <div className="text-[10px] font-black text-white uppercase tracking-widest border-b border-white/25 pb-1">{t("Offline / Putus")}</div>
                <p className="text-[9.5px] text-white/90 font-medium leading-relaxed">
                  {t("Perangkat yang saat ini tidak mengirimkan sinyal telemetri.")}
                </p>
              </div>
            }
          />
        </motion.div>

        <motion.div variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } }}>
          <div className="bg-card h-[140px] p-5 rounded-2xl shadow-xs border border-border/80 flex items-center justify-between hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 overflow-hidden relative group cursor-pointer" onClick={() => onNavigate?.('/map')}>
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/8 to-transparent opacity-50 pointer-events-none rounded-2xl" />
            <div className="flex flex-col gap-1 relative z-10">
              <span className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wider">{t("Total Area Lahan")}</span>
              <span className="text-3xl font-black tracking-tight text-blue-600 dark:text-blue-400">{totalAreaHa > 0 ? totalAreaHa.toFixed(1) : '0'} <span className="text-sm font-bold">Ha</span></span>
              <span className="text-[10px] font-semibold text-muted-foreground">{landPlots.length} Lahan · {gardens.length} Kebun</span>
            </div>
            <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 relative z-10 group-hover:scale-110 transition-transform">
              <Building2 size={22} />
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* ── Real-Time Sensor Telemetry Grid (.ino Payload) ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <Activity size={16} className="text-emerald-600" />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-foreground">Telemetri Sensor Real-Time</h2>
              <p className="text-[11px] font-semibold text-muted-foreground">{formatEYDDeviceName(activeNode?.name || 'Node', activeNode?.device_code || activeNode?.id || '')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[11px] font-bold text-muted-foreground">
              {latestReading ? formatTime(latestReading.timestamp || latestReading.created_at) + ' WIB' : 'Menunggu data...'}
            </span>
          </div>
        </div>

        <motion.div
          className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-5"
          initial="hidden"
          animate="show"
          variants={{
            hidden: { opacity: 0 },
            show: { opacity: 1, transition: { staggerChildren: 0.05 } }
          }}
        >
          {/* MANDATORY 1: CO₂ Carbon */}
          <motion.div variants={{ hidden: { opacity: 0, scale: 0.95 }, show: { opacity: 1, scale: 1 } }}>
            <SensorCard
              title="CO₂ Carbon"
              value={latestReading?.carbon_data?.co2_ppm ?? latestReading?.co2_ppm ?? (activeNode as any)?.co2_ppm ?? 0}
              unit="PPM"
              icon={CloudSun}
              readings={activeReadings.slice(0, 24).reverse().map(r => ({ value: r.carbon_data?.co2_ppm ?? r.co2_ppm ?? 0 }))}
            />
          </motion.div>

          {/* MANDATORY 2: CH₄ Methane */}
          <motion.div variants={{ hidden: { opacity: 0, scale: 0.95 }, show: { opacity: 1, scale: 1 } }}>
            <SensorCard
              title="CH₄ Metana"
              value={latestReading?.carbon_data?.ch4_ppm ?? latestReading?.ch4_ppm ?? (activeNode as any)?.ch4_ppm ?? 0}
              unit="PPM"
              icon={Leaf}
              readings={activeReadings.slice(0, 24).reverse().map(r => ({ value: r.carbon_data?.ch4_ppm ?? r.ch4_ppm ?? 0 }))}
            />
          </motion.div>

          {/* MANDATORY 3: NO₂ */}
          <motion.div variants={{ hidden: { opacity: 0, scale: 0.95 }, show: { opacity: 1, scale: 1 } }}>
            <SensorCard
              title="NO₂"
              value={latestReading?.carbon_data?.no2_ppb ?? latestReading?.no2_ppb ?? (activeNode as any)?.no2_ppb ?? 0}
              unit="PPB"
              icon={FlaskConical}
              readings={activeReadings.slice(0, 24).reverse().map(r => ({ value: r.carbon_data?.no2_ppb ?? r.no2_ppb ?? 0 }))}
            />
          </motion.div>

          {/* PARAMETER: Suhu Udara */}
          <motion.div variants={{ hidden: { opacity: 0, scale: 0.95 }, show: { opacity: 1, scale: 1 } }}>
            <SensorCard
              title="Suhu Udara"
              value={latestReading?.environment?.air_temperature_c ?? latestReading?.temp ?? 0}
              unit="°C"
              icon={Thermometer}
              readings={activeReadings.slice(0, 24).reverse().map(r => ({ value: r.environment?.air_temperature_c ?? r.temp ?? 0 }))}
            />
          </motion.div>

          {/* PARAMETER: Kelembapan */}
          <motion.div variants={{ hidden: { opacity: 0, scale: 0.95 }, show: { opacity: 1, scale: 1 } }}>
            <SensorCard
              title="Kelembapan"
              value={latestReading?.environment?.air_humidity_percent ?? latestReading?.humidity ?? 0}
              unit="% RH"
              icon={Droplets}
              readings={activeReadings.slice(0, 24).reverse().map(r => ({ value: r.environment?.air_humidity_percent ?? r.humidity ?? 0 }))}
            />
          </motion.div>

          {/* PARAMETER: Kecepatan Angin */}
          <motion.div variants={{ hidden: { opacity: 0, scale: 0.95 }, show: { opacity: 1, scale: 1 } }}>
            <SensorCard
              title="Kecepatan Angin"
              value={latestReading?.environment?.wind_speed_kmh ?? latestReading?.wind_speed ?? (activeNode as any)?.wind_speed ?? 0}
              unit="km/h"
              icon={Wind}
              readings={activeReadings.slice(0, 24).reverse().map(r => ({ value: r.environment?.wind_speed_kmh ?? r.wind_speed ?? 0 }))}
            />
          </motion.div>

          {/* PARAMETER: Arah Angin */}
          <motion.div variants={{ hidden: { opacity: 0, scale: 0.95 }, show: { opacity: 1, scale: 1 } }}>
            <SensorCard
              title="Arah Angin"
              value={latestReading?.environment?.wind_direction_deg ?? latestReading?.wind_direction ?? 180}
              unit="° Utara"
              icon={Compass}
              readings={activeReadings.slice(0, 24).reverse().map(r => ({ value: r.environment?.wind_direction_deg ?? 180 }))}
            />
          </motion.div>

          {/* PARAMETER: Altitude*/}
          <motion.div variants={{ hidden: { opacity: 0, scale: 0.95 }, show: { opacity: 1, scale: 1 } }}>
            <SensorCard
              title="Altitude"
              value={latestReading?.location?.altitude_m ?? activeNode?.altitude ?? 720}
              unit="MDPL"
              icon={MapPin}
              readings={activeReadings.slice(0, 24).reverse().map(r => ({ value: r.location?.altitude_m ?? 720 }))}
            />
          </motion.div>

          {/* PARAMETER: Baterai (% + Voltage) */}
          <motion.div variants={{ hidden: { opacity: 0, scale: 0.95 }, show: { opacity: 1, scale: 1 } }}>
            <SensorCard
              title="Baterai"
              value={latestReading?.power?.battery_percent ?? activeNode?.battery_percent ?? activeNode?.battery ?? 85}
              unit="%"
              subValue={`${latestReading?.power?.battery_voltage ? Number(latestReading.power.battery_voltage).toFixed(1) : (activeNode?.battery_voltage ? Number(activeNode.battery_voltage).toFixed(1) : '12.4')} VOLT`}
              icon={Battery}
              readings={activeReadings.slice(0, 24).reverse().map(r => ({ value: r.power?.battery_percent ?? 85 }))}
            />
          </motion.div>

          {/* PARAMETER: Sinyal RSSI */}
          <motion.div variants={{ hidden: { opacity: 0, scale: 0.95 }, show: { opacity: 1, scale: 1 } }}>
            <SensorCard
              title="Sinyal RSSI"
              value={latestReading?.communication?.rssi_dbm ?? activeNode?.rssi ?? -72}
              unit="dBm"
              icon={Signal}
              readings={activeReadings.slice(0, 24).reverse().map(r => ({ value: r.communication?.rssi_dbm ?? -72 }))}
            />
          </motion.div>
        </motion.div>
      </div>

      {/* ── Main Analytics Line Chart & Dynamic BMKG Weather Widget ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <Card className="lg:col-span-2 border border-border/80 shadow-sm rounded-[28px] overflow-hidden group bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-border/60">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg font-black tracking-tight">{t("Riwayat Analitik Telemetri")}</CardTitle>
                <Popover>
                  <PopoverTrigger className="p-1 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-emerald-600 transition-colors">
                    <Info size={14} />
                  </PopoverTrigger>
                  <PopoverContent className="w-64 text-xs z-50 shadow-xl rounded-2xl border-border/80 p-3" align="start">
                    <p className="font-bold mb-1 text-[13px] text-foreground">{t("Riwayat Analitik")}</p>
                    <p className="text-muted-foreground leading-relaxed">{t("Menampilkan tren parameter lingkungan berdasarkan rentang waktu yang dipilih. Data diagregasi secara otomatis untuk menganalisis mikroiklim di lahan.")}</p>
                  </PopoverContent>
                </Popover>
              </div>
              <CardDescription className="text-xs font-semibold text-muted-foreground">
                Node: {formatEYDDeviceName(activeNode?.name || 'Sensor', activeNode?.device_code || activeNode?.id || '')}
              </CardDescription>
            </div>

            {/* Parameter Switcher Select */}
            <select
              value={chartParam}
              onChange={(e) => setChartParam(e.target.value || 'co2_ppm')}
              className="h-10 px-3.5 bg-muted/40 border border-border/80 font-extrabold text-xs rounded-xl text-foreground outline-none cursor-pointer uppercase tracking-wider shadow-xs hover:bg-muted transition-all"
            >
              <option value="co2_ppm" className="bg-card text-foreground">{t('CO₂ Carbon (PPM)')}</option>
              <option value="ch4_ppm" className="bg-card text-foreground">{t('CH₄ Metana (PPM)')}</option>
              <option value="no2_ppb" className="bg-card text-foreground">{t('NO₂ (PPB)')}</option>
              <option value="air_temp" className="bg-card text-foreground">{t('Suhu Udara (°C)')}</option>
              <option value="air_humidity" className="bg-card text-foreground">{t('Kelembapan (% RH)')}</option>
              <option value="wind_speed" className="bg-card text-foreground">{t('Kecepatan Angin (km/h)')}</option>
              <option value="wind_direction" className="bg-card text-foreground">{t('Arah Angin (°)')}</option>
              <option value="battery_voltage" className="bg-card text-foreground">{t('Tegangan Baterai (Volt)')}</option>
              <option value="altitude" className="bg-card text-foreground">{t('Elevasi (MDPL)')}</option>
              <option value="battery_percent" className="bg-card text-foreground">{t('Baterai (%)')}</option>
              <option value="rssi" className="bg-card text-foreground">{t('Sinyal RSSI (dBm)')}</option>
              <option value="rainfall_mm" className="bg-card text-foreground">{t('Intensitas Curah Hujan (mm)')}</option>
            </select>
          </CardHeader>

          <CardContent className="h-[380px] pt-6 min-h-0 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 25, left: 10, bottom: 25 }}>
                <defs>
                  <linearGradient id="chartGradientCO2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="chartGradientTemp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="chartGradientHumid" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="chartGradientWind" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="chartGradientRain" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={true} horizontal={true} stroke="rgba(0,0,0,0.06)" />
                <XAxis
                  dataKey={timeRange === '30d' || timeRange === '1y' ? "displayLabel" : "timestamp"}
                  tickFormatter={(str) => {
                    if (timeRange === '30d' || timeRange === '1y') return str;
                    const d = new Date(str);
                    if (timeRange === '24h') return format(d, 'HH:mm');
                    if (timeRange === '7d') return format(d, 'd MMM', { locale: id });
                    return format(d, 'MMM yyyy', { locale: id });
                  }}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))', fontWeight: '700' }}
                  label={{ value: t("Waktu Pengamatan"), position: "insideBottom", offset: -18, fontSize: 11, fontWeight: "700", fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))', fontWeight: '700' }}
                  label={{
                    value: chartParam === 'co2_ppm' ? t("Konsentrasi CO₂ (PPM)") :
                      chartParam === 'ch4_ppm' ? t("Konsentrasi CH₄ Metana (PPM)") :
                        chartParam === 'no2_ppb' ? t("Konsentrasi NO₂ (PPB)") :
                          chartParam === 'air_temp' ? t("Suhu Udara (°C)") :
                            chartParam === 'air_humidity' ? t("Kelembapan (% RH)") :
                              chartParam === 'wind_speed' ? t("Kecepatan Angin (km/h)") :
                                chartParam === 'wind_direction' ? t("Arah Angin (°)") :
                                  chartParam === 'battery_voltage' ? t("Tegangan Baterai (Volt)") :
                                    chartParam === 'altitude' ? t("Altitude (MDPL)") :
                                      chartParam === 'battery_percent' ? t("Kapasitas Baterai (%)") :
                                        chartParam === 'rssi' ? t("Sinyal RSSI (dBm)") : t("Curah Hujan (mm)"),
                    angle: -90,
                    position: "insideLeft",
                    offset: -5,
                    fontSize: 11,
                    fontWeight: "700",
                    fill: "hsl(var(--muted-foreground))"
                  }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '16px',
                    border: '1px solid rgba(0,0,0,0.08)',
                    boxShadow: '0 20px 40px -15px rgba(0,0,0,0.15)',
                    padding: '12px',
                    backgroundColor: 'var(--card)',
                    color: 'var(--foreground)'
                  }}
                  labelStyle={{ fontWeight: '800', fontSize: '11px', color: '#10b981', marginBottom: '4px' }}
                  labelFormatter={(label) => {
                    if (timeRange === '30d' || timeRange === '1y') return label;
                    return format(new Date(label), timeRange === '24h' ? "d MMM, HH:mm" : "PPP", { locale: id });
                  }}
                />
                <Area
                  type="monotone"
                  dataKey={chartParam}
                  stroke={
                    chartParam === 'co2_ppm' ? '#10b981' :
                      chartParam === 'ch4_ppm' ? '#059669' :
                        chartParam === 'no2_ppb' ? '#8b5cf6' :
                          chartParam === 'air_temp' ? '#f59e0b' :
                            chartParam === 'air_humidity' ? '#3b82f6' :
                              chartParam === 'wind_speed' ? '#14b8a6' :
                                chartParam === 'wind_direction' ? '#06b6d4' :
                                  chartParam === 'battery_voltage' ? '#a855f7' :
                                    chartParam === 'altitude' ? '#6366f1' :
                                      chartParam === 'battery_percent' ? '#22c55e' :
                                        chartParam === 'rssi' ? '#0284c7' : '#6366f1'
                  }
                  strokeWidth={3}
                  fillOpacity={1}
                  fill={
                    chartParam === 'co2_ppm' ? 'url(#chartGradientCO2)' :
                      chartParam === 'air_temp' ? 'url(#chartGradientTemp)' :
                        chartParam === 'air_humidity' ? 'url(#chartGradientHumid)' :
                          chartParam === 'wind_speed' ? 'url(#chartGradientWind)' : 'url(#chartGradientRain)'
                  }
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Dynamic BMKG Weather Widget */}
        <Card className="border border-border/80 shadow-sm rounded-[28px] bg-slate-900 text-white relative overflow-hidden group hover:shadow-2xl transition-all duration-500 flex flex-col justify-between">
          <div className="absolute -right-8 -top-8 w-36 h-36 bg-emerald-500/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700 pointer-events-none"></div>

          <CardHeader className="pb-3 border-b border-white/10">
            <div className="flex items-center justify-between relative z-10">
              <CardTitle className="text-base font-black tracking-wider uppercase text-emerald-400 flex items-center gap-2">
                <CloudSun size={18} />
                <span>{t("Cuaca BMKG")} {activeNode?.location || ''}</span>
              </CardTitle>
              <Badge variant="outline" className="bg-white/10 border-white/20 text-white text-[9px] font-black uppercase px-2 py-0.5">
                Live API
              </Badge>
            </div>

            <div className="relative z-10 flex flex-col gap-1 mt-2">
              <span className="text-white/90 font-bold text-xs uppercase tracking-wider truncate"
                title={displayMode === 'lahan' ? (activeLandPlot?.address || activeNode?.location || t("Memuat lokasi...")) : (activeLandPlot?.plot_name || t("Memuat wilayah..."))}>
                {displayMode === 'lahan'
                  ? (activeLandPlot?.address || activeNode?.location || t("Memuat lokasi..."))
                  : (activeLandPlot?.plot_name || t("Memuat wilayah..."))}
              </span>

              {activeNode && (
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
                    <MapPin size={11} />
                    {activeNode.location}
                  </span>
                  <span className="text-white/40">•</span>
                  <span className="text-[10px] font-semibold text-white/70">{resolvedPlantName}</span>
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-5 relative z-10 pt-4">
            {weatherData ? (
              <>
                <div className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/10">
                  <div className="text-5xl font-black tracking-tighter text-white">{weatherData.current.temp.toFixed(1)}{'\u00B0'}C</div>
                  <div className="text-right">
                    <p className="font-black text-sm uppercase tracking-tight text-emerald-400">{translateWeather(weatherData.current.weather, i18n.language)}</p>
                    <p className="text-[10px] font-bold text-white/70 uppercase tracking-wider mt-1">{t("Angin")}: {weatherData.windSpeed} km/h</p>
                  </div>
                </div>

                {/* ── Live Real-Time Rainfall Intensity Mini Area Chart Widget ── */}
                <div className="bg-white/5 p-3.5 rounded-2xl border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-black text-cyan-400 uppercase tracking-wider">
                      <CloudRain size={15} />
                      <span>{t("Intensitas Curah Hujan")}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                      <span className="text-[11px] font-black text-white tracking-tight">
                        {latestReading?.environment?.rainfall_mm !== undefined
                          ? `${Number(latestReading.environment.rainfall_mm).toFixed(1)} mm/jam`
                          : `${(weatherData.current.weather?.toLowerCase().includes('hujan') ? 14.5 : 0.0).toFixed(1)} mm/jam`}
                      </span>
                    </div>
                  </div>

                  {/* Real-Time Rainfall Trend Sparkline */}
                  <div className="h-16 w-full pt-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={
                          activeReadings.length > 0
                            ? activeReadings.slice(0, 12).reverse().map((r: any, idx: number) => ({
                              idx,
                              rainfall: r.environment?.rainfall_mm ?? r.rainfall_mm ?? r.rain ?? (weatherData.current.weather?.toLowerCase().includes('hujan') ? (idx % 2 === 0 ? 12.5 : 4.2) : 0)
                            }))
                            : Array.from({ length: 8 }, (_, i) => ({
                              idx: i,
                              rainfall: weatherData.current.weather?.toLowerCase().includes('hujan') ? Number((6 + Math.sin(i * 1.5) * 8).toFixed(1)) : 0
                            }))
                        }
                        margin={{ top: 2, right: 0, left: 0, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="bmkgRainGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.6} />
                            <stop offset="100%" stopColor="#0284c7" stopOpacity={0.05} />
                          </linearGradient>
                        </defs>
                        <Area
                          type="monotone"
                          dataKey="rainfall"
                          stroke="#38bdf8"
                          strokeWidth={2.5}
                          fill="url(#bmkgRainGradient)"
                          isAnimationActive={true}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 4-Hour Forecast Items with Preserved Independent Dates */}
                <div className="grid grid-cols-4 gap-2 pt-1">
                  {weatherData.forecast.slice(0, 4).map((f: any, i: number) => {
                    const forecastMs = Date.now() + (i + 1) * 3 * 3600 * 1000;
                    const forecastDate = f.time ? new Date(f.time.includes(' ') ? f.time.replace(' ', 'T') : f.time) : new Date(forecastMs);
                    const validDate = isNaN(forecastDate.getTime()) ? new Date(forecastMs) : forecastDate;
                    const dayNames = [t('Minggu'), t('Senin'), t('Selasa'), t('Rabu'), t('Kamis'), t('Jumat'), t('Sabtu')];
                    const dayName = dayNames[validDate.getDay()];
                    const timeLabel = format(validDate, 'HH:mm');

                    return (
                      <div key={i} className="text-center bg-white/5 hover:bg-white/10 p-2 rounded-xl border border-white/5 transition-colors">
                        <p className="text-[8.5px] font-black text-emerald-400 uppercase tracking-wider">{dayName}</p>
                        <p className="text-[9px] font-bold text-white/90 uppercase">{timeLabel}</p>
                        <p className="font-black text-xs my-1 text-white">{f.temp.toFixed(1)}{'\u00B0'}</p>
                        <p className="text-[8px] font-semibold uppercase truncate text-white/80">{translateWeather(f.weather, i18n.language)}</p>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-2">
                  <Button
                    variant="secondary"
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider h-11 rounded-2xl shadow-md cursor-pointer gap-2 transition-all"
                    onClick={() => onNavigate?.('/bmkg')}
                  >
                    <CloudSun size={16} />
                    <span>{t("Detail Klimatologi BMKG")}</span>
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 space-y-3 opacity-60">
                <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">{t("Sinkronisasi BMKG...")}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
