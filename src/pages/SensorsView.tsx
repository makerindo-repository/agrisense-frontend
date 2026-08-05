import React, { useState, useMemo, useEffect } from 'react';
import {
  LayoutDashboard, Radio, Database, CloudSun, Map as MapIcon, BarChart3, 
  FileText, Settings, Users, Bell, Search, Menu, X, Droplets, Thermometer, 
  Wind, Battery, Signal, AlertTriangle, Leaf, LogIn, LogOut, Calendar as CalendarIcon, 
  FlaskConical, Zap, Activity, Filter, Plus, Save, MoreVertical, Edit, Trash2, 
  Download, CheckCircle2, Eye, EyeOff, Trees, Layers, Sprout, MapPin, SearchIcon, Share2, Map as MapIconS
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { formatDateTime, formatFilePrefix, format, id } from '@/utils/formatters';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, ScatterChart, Scatter, ZAxis, Legend } from 'recharts';
import { IoTNode, User, UserRole } from '../lib/mockData';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

// Map related overrides
import { MapContainer, TileLayer, Marker, Popup, useMap, Polygon, Tooltip as LeafletTooltip } from 'react-leaflet';
import L from 'leaflet';
import LeafletDrawMap, { PolygonDrawResult } from '../components/LeafletDrawMap';

import { useTranslation } from 'react-i18next';

// App specific imports

const sensorTableCellClass = "text-[13px] text-foreground text-center whitespace-nowrap";
const sensorTableValueClass = "text-[13px] text-foreground text-center";

export default function SensorsView({ readings, nodes = [] }: { readings: any[]; nodes?: any[] }) {
  const { t } = useTranslation();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [timeRange, setTimeRange] = useState("24h");
  const [nodeFilter, setNodeFilter] = useState("all");
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const uniqueNodes = useMemo(() => {
    const nodes = new Set<string>();
    readings.forEach(r => {
      const id = r.device_id || r.deviceId;
      if (id) nodes.add(id);
    });
    return Array.from(nodes);
  }, [readings]);

  const sortedReadings = useMemo(() => {
    let filtered = readings;
    if (nodeFilter !== "all") {
      filtered = filtered.filter(r => (r.device_id || r.deviceId) === nodeFilter);
    }
    if (date) {
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();
      
      const selectedDate = new Date(date);
      if (isToday) {
        // Jika hari ini, gunakan waktu saat ini sebagai batas akhir
        selectedDate.setTime(now.getTime());
      } else {
        // Jika hari lain, gunakan akhir hari tersebut (23:59:59)
        selectedDate.setHours(23, 59, 59, 999);
      }
      
      let startDate = new Date(selectedDate);
      if (timeRange === '24h') {
        // 24 jam kebelakang (bukan sekadar -1 hari kalender)
        startDate.setTime(selectedDate.getTime() - 24 * 60 * 60 * 1000);
      } else if (timeRange === '7d') {
        startDate.setDate(startDate.getDate() - 7);
      } else if (timeRange === '30d') {
        startDate.setDate(startDate.getDate() - 30);
      }
      
      filtered = filtered.filter(r => {
        const ts = new Date(r.timestamp || r.created_at || 0);
        return ts >= startDate && ts <= selectedDate;
      });
    }
    return [...filtered].sort((a, b) => 
      new Date(b.timestamp || b.created_at || 0).getTime() - new Date(a.timestamp || a.created_at || 0).getTime()
    );
  }, [readings, nodeFilter, date, timeRange]);

  const totalPages = Math.max(1, Math.ceil(sortedReadings.length / itemsPerPage));
  const paginatedReadings = sortedReadings.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => { setCurrentPage(1); }, [nodeFilter, date, timeRange]);

  // Helper to normalize data structure
  const normalizeReading = (r: any) => {
    return {
      timestamp: r.timestamp || r.created_at || new Date().toISOString(),
      device_id: r.device_id || r.deviceId || "N/A",
      location: r.location || { 
        latitude: r.device?.latitude ?? 0, 
        longitude: r.device?.longitude ?? 0, 
        altitude_m: r.device?.altitude ?? 0 
      },
      co2: r.carbon_data?.co2_ppm ?? r.co2_ppm ?? r.co2 ?? 0,
      tvoc: r.carbon_data?.tvoc_ppb ?? r.tvoc_ppb ?? r.tvoc ?? 0,
      ch4: r.carbon_data?.ch4_ppm ?? r.ch4_ppm ?? r.ch4 ?? 0,
      no2: r.carbon_data?.no2_ppb ?? r.no2_ppb ?? r.no2 ?? 0,
      n2o: r.carbon_data?.n2o_ppb ?? r.n2o_ppb ?? r.n2o ?? 0,
      temp: r.environment?.air_temperature_c ?? r.air_temperature_sensor ?? r.temp ?? 0,
      humidity: r.environment?.air_humidity_percent ?? r.air_humidity_sensor ?? r.humidity ?? 0,
      pressure: r.environment?.air_pressure_hpa ?? r.air_pressure_hpa ?? r.pressure ?? 0,
      wind: r.environment?.wind_speed_kmh ?? r.wind_speed_kmh ?? r.wind ?? 0,
      light: r.environment?.light_lux ?? r.light_lux ?? r.light ?? 0,
      soilMoisture: r.soil_7in1?.soil_moisture_percent ?? r.soil_moisture_percent ?? r.soilMoisture ?? 0,
      soilTemp: r.soil_7in1?.soil_temperature_c ?? r.soil_temperature_c ?? r.soilTemp ?? 0,
      soilPH: r.soil_7in1?.soil_ph ?? r.soil_ph ?? r.soilPH ?? 0,
      nitrogen: r.soil_7in1?.soil_n_mg_kg ?? r.soil_n_mg_kg ?? r.nitrogen ?? 0,
      phosphorus: r.soil_7in1?.soil_p_mg_kg ?? r.soil_p_mg_kg ?? r.phosphorus ?? 0,
      potassium: r.soil_7in1?.soil_k_mg_kg ?? r.soil_k_mg_kg ?? r.potassium ?? 0,
      battery: r.power?.battery_percent ?? r.battery_percent ?? r.battery ?? 0,
      // ip field removed per user request
    };
  };

  const nodeNameLookup = useMemo(() => {
    const lookup: Record<string, string> = {};
    nodes.forEach((n: any) => {
      if (n.id) lookup[n.id] = n.name || n.id;
    });
    return lookup;
  }, [nodes]);

  const handleExportCSV = () => {
    if (sortedReadings.length === 0) {
      toast.error("Tidak ada data untuk diekspor!");
      return;
    }

    // Build plant lookup from nodes: device_code → plant_name
    const plantLookup: Record<string, string> = {};
    nodes.forEach((n: any) => {
      const key = n.id; // In NodeController, 'id' maps to 'device_code'
      if (key) plantLookup[key] = n.plant_name || 'N/A';
    });

    const exportData = sortedReadings.map(raw => {
      const r = normalizeReading(raw);
      return {
        "Waktu": formatDateTime(r.timestamp),
        "Nama Perangkat": nodeNameLookup[r.device_id] || r.device_id,
        "Jenis Tanaman": plantLookup[r.device_id] || 'N/A',
        "Latitude": r.location.latitude,
        "Longitude": r.location.longitude,
        "Ketinggian (m)": r.location.altitude_m,
        "CO2 (ppm)": r.co2,
        "CH4 (ppm)": r.ch4,
        "NO2 (ppb)": r.no2,
        "Suhu Udara (°C)": r.temp,
        "Kelembapan Udara (%)": r.humidity,
        "Kecepatan Angin (km/h)": r.wind,
        "Baterai Perangkat (%)": r.battery,
        // "IP Address": r.ip  # removed per user request
      };
    });

    try {
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Data Sensor");
      
      const titlePrefix = nodeFilter === "all" ? "Semua_Node" : nodeFilter;
      const datePrefix = formatFilePrefix();
      
      XLSX.writeFile(workbook, `Export_Sensor_${titlePrefix}_${datePrefix}.csv`, { bookType: 'csv' });
      toast.success(`Berhasil! File Export_Sensor_${titlePrefix}_${datePrefix}.csv telah diunduh.`);
    } catch (error) {
      console.error(error);
      toast.error("Gagal melakukan proses Export file CSV.");
    }
  };

  return (
    <div className="space-y-6 px-4 md:px-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Data Sensor</h1>
        <div className="flex flex-nowrap items-center gap-3 overflow-x-auto pb-1 -mb-1 scrollbar-hide">
          <Popover>
            <PopoverTrigger className="inline-flex items-center h-10 px-3 rounded-md gap-2 font-semibold text-xs bg-card text-slate-700 hover:bg-slate-50 border border-border/50 focus-visible:outline-none transition-all">
              <img src="https://cdn-icons-png.flaticon.com/512/833/833593.png" alt="calendar" className="w-3.5 h-3.5 object-contain opacity-75 mr-1.5" />
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
          <Select value={nodeFilter} onValueChange={(v) => setNodeFilter(v || 'all')}>
            <SelectTrigger className="w-[260px] border border-border/50 bg-card font-semibold text-xs rounded-md h-10">
              <SelectValue placeholder={t("Pilih Node")} />
            </SelectTrigger>
            <SelectContent className="rounded-md border-none shadow-2xl min-w-[280px]">
              <SelectItem value="all" className="font-semibold text-xs uppercase">{t("Semua Node")}</SelectItem>
              {uniqueNodes.map(nodeId => (
                <SelectItem key={nodeId} value={nodeId} className="font-semibold text-xs uppercase">{nodeId}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v || '1h')}>
            <SelectTrigger className="w-[160px] border border-border/50 bg-card font-semibold text-xs rounded-md h-10">
              <SelectValue placeholder={t("Rentang Waktu")} />
            </SelectTrigger>
            <SelectContent className="rounded-md border-none shadow-2xl">
              <SelectItem value="24h" className="font-semibold text-xs">{t("24 Jam Terakhir")}</SelectItem>
              <SelectItem value="7d" className="font-semibold text-xs">{t("7 Hari Terakhir")}</SelectItem>
              <SelectItem value="30d" className="font-semibold text-xs">{t("30 Hari Terakhir")}</SelectItem>
            </SelectContent>
          </Select>
          <div className="h-8 w-px bg-border mx-1 hidden md:block" />
          <Button variant="default" onClick={handleExportCSV} className="gap-2">
            Export to CSV
          </Button>
        </div>
      </div>

      <Card className="border-none shadow-sm shadow-black/5 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border/50 hover:bg-transparent">
                <TableHead className="w-[180px] font-bold text-[10px] uppercase tracking-wider">Waktu</TableHead>
                <TableHead className="font-bold text-[10px] uppercase tracking-wider">Nama Perangkat</TableHead>
                <TableHead className="font-bold text-[10px] uppercase tracking-wider">CO2 (ppm)</TableHead>
                <TableHead className="font-bold text-[10px] uppercase tracking-wider text-center">CH4 (ppm)</TableHead>
                <TableHead className="font-bold text-[10px] uppercase tracking-wider text-center">NO2 (ppb)</TableHead>
                <TableHead className="font-bold text-[10px] uppercase tracking-wider text-center">Suhu (°C)</TableHead>
                <TableHead className="font-bold text-[10px] uppercase tracking-wider text-center">Lembap (%)</TableHead>
                <TableHead className="font-bold text-[10px] uppercase tracking-wider text-center">Angin (km/h)</TableHead>
                <TableHead className="font-bold text-[10px] uppercase tracking-wider text-center">GPS (Lat, Lon, Alt)</TableHead>
                <TableHead className="font-bold text-[10px] uppercase tracking-wider">Baterai</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedReadings.map((raw, i) => {
                const reading = normalizeReading(raw);
                return (
                  <TableRow key={i} className="hover:bg-muted/20 transition-colors border-b border-border/50">
                    <TableCell className="text-xs font-bold text-foreground whitespace-nowrap">
                      {formatDateTime(reading.timestamp)}
                    </TableCell>
                    <TableCell className="text-xs font-bold text-primary whitespace-nowrap">{nodeNameLookup[reading.device_id] || reading.device_id}</TableCell>
                    <TableCell className={sensorTableCellClass}>{reading.co2.toFixed(1)}</TableCell>
                    <TableCell className={sensorTableValueClass}>{reading.ch4.toFixed(1)}</TableCell>
                    <TableCell className={sensorTableValueClass}>{reading.no2.toFixed(1)}</TableCell>
                    <TableCell className={sensorTableValueClass}>{reading.temp.toFixed(1)}°</TableCell>
                    <TableCell className={sensorTableValueClass}>{reading.humidity.toFixed(1)}%</TableCell>
                    <TableCell className={sensorTableValueClass}>{reading.wind.toFixed(1)}</TableCell>
                    <TableCell className="text-[13px] leading-snug whitespace-nowrap text-center text-foreground">
                      <div>{reading.location.latitude.toFixed(6)}</div>
                      <div>{reading.location.longitude.toFixed(6)}</div>
                      <div>{reading.location.altitude_m}m asl</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-2 bg-muted rounded-full overflow-hidden border border-border/50">
                          <div 
                            className={cn("h-full transition-all duration-500", reading.battery > 20 ? "bg-emerald-500" : "bg-destructive")}
                            style={{ width: `${reading.battery}%` }}
                          />
                        </div>
                        <span className={cn("text-[13px]", reading.battery > 20 ? "text-emerald-600" : "text-destructive")}>{reading.battery}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        {/* Pagination - Always visible */}
        <div className="flex flex-col md:flex-row items-center justify-between px-6 py-4 border-t border-border/50 gap-4">
            <div className="flex items-center gap-4">
              <p className="text-xs text-muted-foreground font-medium">
                Menampilkan {sortedReadings.length > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0}-{Math.min(currentPage * itemsPerPage, sortedReadings.length)} dari {sortedReadings.length} data
              </p>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Baris:</span>
                <Select value={itemsPerPage.toString()} onValueChange={(v) => { setItemsPerPage(parseInt(v || '10')); setCurrentPage(1); }}>
                  <SelectTrigger className="h-8 w-[70px] text-xs border-none bg-muted/50 font-semibold rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-2xl">
                    <SelectItem value="10" className="text-xs font-semibold">10</SelectItem>
                    <SelectItem value="15" className="text-xs font-semibold">15</SelectItem>
                    <SelectItem value="25" className="text-xs font-semibold">25</SelectItem>
                    <SelectItem value="50" className="text-xs font-semibold">50</SelectItem>
                    <SelectItem value="100" className="text-xs font-semibold">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Button 
                variant="outline" 
                size="sm" 
                disabled={currentPage === 1} 
                onClick={() => setCurrentPage(p => p - 1)} 
                className="h-8 px-3 text-xs font-semibold rounded-lg hover:bg-primary hover:text-primary-foreground transition-all"
              >
                Sebelumnya
              </Button>
              
              <div className="flex items-center mx-2 gap-1">
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
                        "h-8 w-8 text-xs font-semibold rounded-lg p-0 transition-all",
                        currentPage === page ? "shadow-lg shadow-primary/20" : ""
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
                className="h-8 px-3 text-xs font-semibold rounded-lg hover:bg-primary hover:text-primary-foreground transition-all"
              >
                Berikutnya
              </Button>
            </div>
          </div>
        </Card>
      </div>
  );
}
