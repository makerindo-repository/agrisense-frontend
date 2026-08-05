import React, { useState, useMemo, useEffect } from 'react';
import {
  LayoutDashboard, Radio, Database, CloudSun, Map as MapIcon, BarChart3,
  FileText, Settings, Users, Bell, Search, Menu, X, Droplets, Thermometer,
  Wind, Battery, Signal, AlertTriangle, Leaf, LogIn, LogOut, Calendar as CalendarIcon,
  FlaskConical, Zap, Activity, Filter, Plus, Save, MoreVertical, Edit, Trash2,
  Download, CheckCircle2, Eye, EyeOff, Trees, Layers, Sprout, MapPin, SearchIcon, Share2, Map as MapIconS, Info, Brain
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { EPSILON_TABLE, FAPAR_TABLE, normalizePlantKey, weatherTranslation, translateWeather } from '../constants/agriConstants';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, id } from '@/utils/formatters';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, ScatterChart, Scatter, ZAxis, Legend } from 'recharts';
import { mockNodes, mockReadings, mockBMKG, IoTNode, mockUsers, User, UserRole, mockActivityLogs } from '../lib/mockData';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import api from '../lib/api';

// Map related overrides
import { MapContainer, TileLayer, Marker, Popup, useMap, Polygon, Tooltip as LeafletTooltip } from 'react-leaflet';
import L from 'leaflet';
import LeafletDrawMap, { PolygonDrawResult } from '../components/LeafletDrawMap';

// App specific imports
import { mockLahanArea } from '../lib/mockData';

import { StatCard } from '../components/Dashboard/StatCard';
import { SensorCard } from '../components/Dashboard/SensorCard';
import { NutrientCard } from '../components/Dashboard/NutrientCard';




// Peta terjemahan deskripsi cuaca dari Bahasa Inggris ke Indonesia
// Konstanta dan kamus cuaca telah dipindahkan ke src/constants/agriConstants.ts

import { useTranslation } from 'react-i18next';

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
  const [plantings, setPlantings] = useState<any[]>([]);
  const [displayMode, setDisplayMode] = useState<'lahan' | 'wilayah'>('lahan');
  const [forecastData, setForecastData] = useState<any[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setDisplayMode(prev => prev === 'wilayah' ? 'lahan' : 'wilayah');
    }, 10000); // Diperlambat menjadi 10 detik agar lebih mudah dibaca
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (propNodes && propNodes.length > 0) {
      setNodes(propNodes);
      if (!selectedNodeId) setSelectedNodeId(propNodes[0].id);
    }
  }, [propNodes]);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // Fetch All Readings
        const readingRes = await api.get('/readings?limit=1500');
        setRealReadings(readingRes.data);

        // Fetch Land Plots only if likely to have access (admin/operator)
        // Note: Even if they don't, we catch it separately
        try {
          const landRes = await api.get('/land-plots');
          const lData = landRes.data?.data || landRes.data;
          if (Array.isArray(lData)) setLandPlots(lData);
        } catch (landErr) {
          console.warn("User does not have access to land-plots or endpoint failed.");
          setLandPlots([]);
        }

        try {
          const plantRes = await api.get('/plantings');
          const pData = plantRes.data?.data || plantRes.data;
          if (Array.isArray(pData)) setPlantings(pData);
        } catch (plantErr) {
          console.warn("Failed fetching plantings.", plantErr);
          setPlantings([]);
        }
      } catch (err) {
        console.error("Dashboard failed to fetch readings:", err);
      }
    };
    fetchInitialData();
  }, []);

  // Filter readings and data based on selected Node
  const activeNode = useMemo(() => {
    return nodes.find(n => n.id.toString() === selectedNodeId);
  }, [nodes, selectedNodeId]);

  const activeLandPlot = useMemo(() => {
    if (!(activeNode as any)?.lahanId) return null;
    return landPlots.find(l => l.id.toString() === (activeNode as any).lahanId.toString());
  }, [activeNode, landPlots]);

  const activePlanting = useMemo(() => {
    if (!activeNode) return null;
    return plantings.find(p => p.device_id?.toString() === activeNode.id.toString());
  }, [activeNode, plantings]);

  const activeReadings = useMemo(() => {
    let filtered = realReadings.filter(r => r.device_id.toString() === selectedNodeId);
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
  }, [realReadings, selectedNodeId, date, timeRange]);

  const latestReading = useMemo(() => {
    return activeReadings.length > 0 ? activeReadings[0] : null;
  }, [activeReadings]);

  const activeNodeCCI = stats?.latest_cci ? (stats.latest_cci * 100).toFixed(1) : "0.0";
  const activeNodeNEE = latestReading?.carbon_data?.carbon_flux !== undefined ? Number(latestReading.carbon_data.carbon_flux).toFixed(4) : "0.0000";

  useEffect(() => {
    const fetchWeather = async () => {
      if (!activeNode) return;
      let url = "/bmkg"; // Using relative path with api instance
      const lat = (activeNode as any).latitude || activeNode.coords?.[0];
      const lng = (activeNode as any).longitude || activeNode.coords?.[1];

      const queryParams = lat && lng ? `?lat=${lat}&lng=${lng}` : "";

      try {
        const res = await api.get(url + queryParams);
        if (res.data.status === "success") setWeatherData(res.data);
      } catch (err) { }
    };
    fetchWeather();
  }, [activeNode]);

  // Fetch forecast predictions for active node
  useEffect(() => {
    if (!activeNode) return;
    const deviceCode = (activeNode as any).device_code || activeNode.id;
    const fetchForecast = async () => {
      try {
        const res = await api.get('/forecasts', {
          params: {
            device_id: deviceCode,
            target: 'Carbon Flux (NEE AgriSense)',
            limit: 50,
          },
        });
        if (res.data?.success && res.data.data) {
          setForecastData(res.data.data);
        } else {
          setForecastData([]);
        }
      } catch {
        setForecastData([]);
      }
    };
    fetchForecast();
  }, [activeNode]);

  const chartData = useMemo(() => {
    const raw = activeReadings
      .map(r => ({
        timestamp: r.timestamp,
        co2_ppm: r.carbon_data?.co2_ppm || 0,
        air_temp: r.environment?.air_temperature_c || 0,
        soil_moisture: r.soil_7in1?.soil_moisture_percent || 0,
        nitrogen: r.soil_7in1?.soil_n_mg_kg || 0
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
          co2_ppm: 0, air_temp: 0, soil_moisture: 0, nitrogen: 0, count: 0
        };
      }
      groupMap[key].co2_ppm += r.co2_ppm;
      groupMap[key].air_temp += r.air_temp;
      groupMap[key].soil_moisture += r.soil_moisture;
      groupMap[key].nitrogen += r.nitrogen;
      groupMap[key].count += 1;
    });

    return Object.values(groupMap).map((g: any) => ({
      timestamp: g.timestamp,
      displayLabel: g.displayLabel,
      co2_ppm: Number((g.co2_ppm / g.count).toFixed(1)),
      air_temp: Number((g.air_temp / g.count).toFixed(1)),
      soil_moisture: Number((g.soil_moisture / g.count).toFixed(1)),
      nitrogen: Number((g.nitrogen / g.count).toFixed(1)),
    }));
  }, [activeReadings, timeRange]);

  const latestSoil = latestReading?.soil_7in1;
  const latestEnv = latestReading?.environment;

  return (
    <div className="space-y-8">
      {/* Header Dashboard with Node Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">{t("Analisis Dasbor")}</h1>
          <div className="h-10 w-[1px] bg-border/50 hidden md:block" />
          <div className="bg-card px-3 h-10 rounded-md shadow-sm border border-border/50 flex items-center gap-2">
            <Radio size={14} className="text-primary animate-pulse" />
            <Select value={selectedNodeId} onValueChange={(v) => setSelectedNodeId(v || '')}>
              <SelectTrigger className="w-[260px] border-none bg-transparent font-semibold text-xs uppercase tracking-wider !h-full focus:ring-0 focus:ring-offset-0">
                <SelectValue>
                  {nodes.find(n => n.id.toString() === selectedNodeId)?.name || t("Pilih Perangkat")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="rounded-md border-none shadow-lg min-w-[280px]">
                {nodes.map(n => (
                  <SelectItem key={n.id} value={n.id.toString()} className="font-semibold py-2 text-xs uppercase cursor-pointer">
                    {n.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Popover>
            <PopoverTrigger className="inline-flex items-center justify-center h-10 px-4 rounded-md gap-2 font-semibold text-xs bg-card text-foreground hover:bg-muted shadow-sm border border-border/50 focus-visible:outline-none transition-all">
              <img src="https://cdn-icons-png.flaticon.com/512/833/833593.png" alt="calendar" className="w-3.5 h-3.5 object-contain opacity-75" />
              {date ? format(date, "d MMM yyyy", { locale: id }) : <span>{t("Pilih tanggal")}</span>}
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v || '24h')}>
            <SelectTrigger className="w-[140px] border border-border/50 shadow-sm bg-card font-semibold text-xs rounded-md !h-10 focus:ring-0 focus:ring-offset-0">
              <SelectValue placeholder={t("Rentang")} />
            </SelectTrigger>
            <SelectContent className="rounded-md border-none shadow-lg">
              <SelectItem value="24h" className="font-semibold text-xs">{t("24 Jam Terakhir")}</SelectItem>
              <SelectItem value="7d" className="font-semibold text-xs">{t("7 Hari Terakhir")}</SelectItem>
              <SelectItem value="30d" className="font-semibold text-xs">{t("30 Hari Terakhir")}</SelectItem>
              <SelectItem value="1y" className="font-semibold text-xs">{t("1 Tahun Terakhir")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats Grid */}
      <motion.div 
        className="grid grid-cols-1 sm:grid-cols-3 gap-6"
        initial="hidden"
        animate="show"
        variants={{
          hidden: { opacity: 0 },
          show: {
            opacity: 1,
            transition: { staggerChildren: 0.15 }
          }
        }}
      >
        <motion.div variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 20 } } }}>
          <StatCard
            title={t("Aktif")}
            value={stats.online}
            total={stats.total}
            icon="https://cdn-icons-png.flaticon.com/512/7903/7903716.png"
            color="text-primary"
            isFlippable={true}
            flipContent={
              <div className="space-y-1.5 w-full text-center">
                <div className="text-[11px] font-bold text-primary uppercase tracking-widest mb-1 border-b border-primary/20 pb-1">{t("Status Perangkat")}</div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {t("Jumlah node yang saat ini aktif pada sistem.")}
                </p>
              </div>
            }
          />
        </motion.div>
        
        <motion.div variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 20 } } }}>
          <StatCard
            title={t("Peringatan")}
            value={stats.warning}
            total={stats.total}
            icon="https://cdn-icons-png.flaticon.com/512/272/272340.png"
            color="text-yellow-500"
            isFlippable={true}
            flipContent={
              <div className="space-y-1.5 w-full text-center">
                <div className="text-[11px] font-bold text-yellow-600 uppercase tracking-widest mb-1 border-b border-yellow-600/20 pb-1">{t("Anomali Lingkungan")}</div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {t("Jumlah node yang mendeteksi parameter lingkungan berada di luar ambang batas aman.")}
                </p>
              </div>
            }
          />
        </motion.div>

        <motion.div variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 20 } } }}>
          <StatCard
            title={t("Tidak Aktif")}
            value={stats.offline}
            total={stats.total}
            icon="https://cdn-icons-png.flaticon.com/512/3334/3334877.png"
            color="text-destructive"
            isFlippable={true}
            flipContent={
              <div className="space-y-1.5 w-full text-center">
                <div className="text-[11px] font-bold text-red-600 uppercase tracking-widest mb-1 border-b border-red-600/20 pb-1">{t("Kehilangan Koneksi")}</div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {t("Perangkat yang gagal terhubung ke sistem.")}
                </p>
              </div>
            }
          />
        </motion.div>
      </motion.div>

      {/* Real-time Sensor Data Grid */}
      <motion.div 
        className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-4 mb-8"
        initial="hidden"
        animate="show"
        variants={{
          hidden: { opacity: 0 },
          show: {
            opacity: 1,
            transition: { staggerChildren: 0.1, delayChildren: 0.2 }
          }
        }}
      >
        <motion.div variants={{ hidden: { opacity: 0, scale: 0.9 }, show: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 300, damping: 24 } } }}>
          <SensorCard title="CO2" value={latestReading?.carbon_data?.co2_ppm ?? 0} unit="ppm" icon={CloudSun} readings={activeReadings.slice(0, 24).reverse().map(r => ({value: r.carbon_data?.co2_ppm || 0}))} />
        </motion.div>
        <motion.div variants={{ hidden: { opacity: 0, scale: 0.9 }, show: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 300, damping: 24 } } }}>
          <SensorCard title="CH4" value={latestReading?.carbon_data?.ch4_ppm ?? 0} unit="ppm" icon={CloudSun} readings={activeReadings.slice(0, 24).reverse().map(r => ({value: r.carbon_data?.ch4_ppm || 0}))} />
        </motion.div>
        <motion.div variants={{ hidden: { opacity: 0, scale: 0.9 }, show: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 300, damping: 24 } } }}>
          <SensorCard title="NO2" value={latestReading?.carbon_data?.no2_ppb ?? 0} unit="ppb" icon={CloudSun} readings={activeReadings.slice(0, 24).reverse().map(r => ({value: r.carbon_data?.no2_ppb || 0}))} />
        </motion.div>
        <motion.div variants={{ hidden: { opacity: 0, scale: 0.9 }, show: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 300, damping: 24 } } }}>
          <SensorCard title="Suhu" value={latestReading?.environment?.air_temperature_c ?? 0} unit="°C" icon={Thermometer} readings={activeReadings.slice(0, 24).reverse().map(r => ({value: r.environment?.air_temperature_c || 0}))} />
        </motion.div>
        <motion.div variants={{ hidden: { opacity: 0, scale: 0.9 }, show: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 300, damping: 24 } } }}>
          <SensorCard title="Lembap" value={latestReading?.environment?.air_humidity_percent ?? 0} unit="%" icon={Droplets} readings={activeReadings.slice(0, 24).reverse().map(r => ({value: r.environment?.air_humidity_percent || 0}))} />
        </motion.div>
        <motion.div variants={{ hidden: { opacity: 0, scale: 0.9 }, show: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 300, damping: 24 } } }}>
          <SensorCard title="Angin" value={latestReading?.environment?.wind_speed_kmh ?? 0} unit="km/h" icon={Wind} readings={activeReadings.slice(0, 24).reverse().map(r => ({value: r.environment?.wind_speed_kmh || 0}))} />
        </motion.div>
        <motion.div variants={{ hidden: { opacity: 0, scale: 0.9 }, show: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 300, damping: 24 } } }}>
          <SensorCard title="Baterai" value={latestReading?.power?.battery_percent ?? 0} unit="%" icon={Battery} readings={activeReadings.slice(0, 24).reverse().map(r => ({value: r.power?.battery_percent || 0}))} />
        </motion.div>
        <motion.div variants={{ hidden: { opacity: 0, scale: 0.9 }, show: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 300, damping: 24 } } }}>
          <SensorCard title="Elevasi" value={latestReading?.location?.altitude_m ?? 0} unit="m" icon={MapPin} readings={activeReadings.slice(0, 24).reverse().map(r => ({value: r.location?.altitude_m || 0}))} />
        </motion.div>
      </motion.div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart */}
        <Card className="lg:col-span-2 border-none shadow-sm shadow-black/5 overflow-hidden group">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">{t("Riwayat Analitik")}</CardTitle>
                <Popover>
                  <PopoverTrigger className="p-1 rounded-full bg-muted/50 hover:bg-muted text-muted-foreground hover:text-primary transition-colors">
                      <Info size={14} />
                  </PopoverTrigger>
                  <PopoverContent className="w-64 text-xs z-50 shadow-sm" align="start">
                    <p className="font-semibold mb-1 text-[13px]">{t("Riwayat Analitik")}</p>
                    <p className="text-muted-foreground">Menampilkan tren parameter lingkungan berdasarkan rentang waktu. Data diagregasi secara otomatis (per jam/hari/minggu) untuk mempermudah pembacaan pola perubahan iklim mikro di lahan.</p>
                  </PopoverContent>
                </Popover>
              </div>
              <CardDescription className="text-xs">{t("Statistik Perangkat")}: {activeNode?.name || "Sensor"}</CardDescription>
            </div>
            <Select value={chartParam} onValueChange={(v) => setChartParam(v || 'co2_ppm')}>
              <SelectTrigger className="w-[180px] border-none bg-muted/50 font-semibold text-xs rounded-xl h-10 uppercase tracking-wider">
                <SelectValue>
                  {chartParam === 'co2_ppm' ? t('Kadar CO2') :
                      chartParam === 'air_temp' ? t('Suhu Udara') : t('Kadar CO2')}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="rounded-xl border-none shadow-2xl">
                <SelectItem value="co2_ppm" className="font-semibold text-xs">{t('Kadar CO2').toUpperCase()}</SelectItem>
                <SelectItem value="air_temp" className="font-semibold text-xs">{t('Suhu Udara').toUpperCase()}</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="h-[380px] pt-4 min-h-0 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={true} horizontal={true} stroke="rgba(0,0,0,0.08)" />
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
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))', fontWeight: '600' }}
                  label={{ value: t("Waktu Pengamatan"), position: "insideBottom", offset: -20, fontSize: 11, fontWeight: "600", fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))', fontWeight: '600' }}
                  label={{
                    value: chartParam === 'co2_ppm' ? t("Konsentrasi (PPM)") :
                      t("Suhu Udara (°C)"),
                    angle: -90,
                    position: "insideLeft",
                    offset: -10,
                    fontSize: 11,
                    fontWeight: "600",
                    fill: "hsl(var(--muted-foreground))"
                  }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '16px',
                    border: 'none',
                    boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)',
                    padding: '12px'
                  }}
                  labelStyle={{ fontWeight: 'bold', fontSize: '10px', color: '#10b981', marginBottom: '4px' }}
                  labelFormatter={(label) => {
                    if (timeRange === '30d' || timeRange === '1y') return label;
                    return format(new Date(label), timeRange === '24h' ? "d MMM, HH:mm" : "PPP", { locale: id });
                  }}
                />
                <Line
                  type="monotone"
                  dataKey={chartParam}
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{ r: 4, fill: "#10b981", strokeWidth: 2, stroke: "white" }}
                  activeDot={{ r: 7, fill: "#059669", strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Dynamic BMKG Widget */}
        <Card className="border-none shadow-sm shadow-black/5 bg-slate-500/80 text-white relative overflow-hidden group hover:shadow-2xl hover:shadow-slate-400/15 transition-all duration-500">
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/5 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700"></div>
          <CardHeader>
            <div className="flex items-center justify-between relative z-10">
              <CardTitle className="text-lg font-semibold tracking-tight">{t("CUACA SEKITAR")}</CardTitle>
              <div className="p-2 rounded-xl bg-white/10">
                <CloudSun size={20} />
              </div>
            </div>
            <div className="relative z-10 flex flex-col gap-1 mt-1 min-h-[30px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={displayMode}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.3 }}
                >
                  <CardDescription className="text-white/90 font-semibold text-[10px] uppercase tracking-widest truncate max-w-[200px]"
                    title={displayMode === 'lahan' ? (activeLandPlot?.address || t("Mencari Lokasi...")) : (activeLandPlot?.plot_name || t("Mencari Wilayah..."))}>
                    {displayMode === 'lahan'
                      ? (activeLandPlot?.address || t("Mencari Lokasi..."))
                      : (activeLandPlot?.plot_name || t("Mencari Wilayah..."))}
                  </CardDescription>
                </motion.div>
              </AnimatePresence>
              {activeNode && (
                <div className="flex flex-col gap-1.5 mt-1">
                  <div className="flex items-center gap-1 text-[9px] font-semibold opacity-70 uppercase tracking-tighter">
                    <MapPin size={10} />
                    <span>{activeNode.name}</span>
                  </div>
                  {(activePlanting?.nama_tanaman || activeNode.plant_name) && (
                    <Badge variant="outline" className="bg-white/20 border-none text-white font-bold text-[8px] px-1.5 py-0 w-fit">
                      {activePlanting?.nama_tanaman || activeNode.plant_name}
                      {activePlanting?.status_fase ? ` - ${activePlanting.status_fase}` : ''}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6 relative z-10">
            {weatherData ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="text-6xl font-semibold tracking-tighter">{weatherData.current.temp.toFixed(1)}{'\u00B0'}</div>
                  <div className="text-right">
                    <p className="font-semibold text-sm uppercase tracking-tight">{translateWeather(weatherData.current.weather, i18n.language)}</p>
                    <p className="text-[10px] font-semibold opacity-70 uppercase tracking-widest mt-1">{t("Angin")}: {weatherData.windSpeed} km/{i18n.language === 'en' ? 'h' : 'j'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 pt-6 border-t border-white/10">
                  {weatherData.forecast.slice(0, 4).map((f: any, i: number) => {
                    // Hitung waktu prakiraan dan tentukan nama hari
                    const forecastDate = new Date();
                    forecastDate.setHours(forecastDate.getHours() + ((i + 1) * 3));
                    const dayNames = [t('Minggu'), t('Senin'), t('Selasa'), t('Rabu'), t('Kamis'), t('Jumat'), t('Sabtu')];
                    const dayName = dayNames[forecastDate.getDay()];
                    const timeLabel = f.time?.split(' ')?.[1] || f.time || forecastDate.getHours() + ':00';

                    return (
                      <div key={i} className="text-center group/item hover:bg-white/5 p-1.5 rounded-lg transition-colors">
                        <p className="text-[7px] font-bold opacity-50 uppercase tracking-wider">{dayName}</p>
                        <p className="text-[9px] font-semibold opacity-70 uppercase">{timeLabel}</p>
                        <p className="font-bold text-xs my-1">{f.temp.toFixed(1)}{'\u00B0'}</p>
                        <p className="text-[7px] font-semibold uppercase truncate opacity-80">{translateWeather(f.weather, i18n.language)}</p>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-4 flex flex-col gap-3">
                  <div className="p-3 bg-white/10 rounded-xl space-y-1">
                    <div className="flex justify-between items-center text-[9px] font-semibold uppercase opacity-70">
                      <span>{t("Kelembapan")}</span>
                      <span>{t("Laju Angin")}</span>
                    </div>
                    <div className="flex justify-between font-bold text-xs">
                      <span>{weatherData.current.humidity}%</span>
                      <span>{weatherData.windSpeed} km/{i18n.language === 'en' ? 'h' : 'j'}</span>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    className="w-full bg-white/90 text-slate-700 font-semibold text-[10px] uppercase tracking-[0.2em] h-10 hover:bg-white transition-all"
                    onClick={() => onNavigate?.('/bmkg')}
                  >
                    {t("Detail Klimatologi")}
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 space-y-3 opacity-50">
                <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <p className="text-[10px] font-bold uppercase tracking-widest">{t("Sinkronisasi Data BMKG...")}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}



