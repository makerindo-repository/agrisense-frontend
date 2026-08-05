import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  Map as MapIcon,
  AlertTriangle,
  Leaf,
  Activity,
  MapPin,
  Sparkles,
  History,
  Clock,
  ChevronRight,
  Info,
  Calendar as CalendarIcon,
  X
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, addDays, id } from '@/utils/formatters';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, ScatterChart, Scatter, ZAxis, Legend, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import api from '../lib/api';

import type { 
  SensorReading, AnalyticsNode, CarbonState, CciStatus, 
  CciBreakdownItem, CarbonFluxMetrics, DynamicMetrics, GroupedReading 
} from '../types';

import { EPSILON_TABLE, FAPAR_TABLE, normalizePlantKey } from '../constants/agriConstants';

import { 
  calculateCarbonFlux, resolveSocBaseline, resolveCMax, 
  calculateCpsHeadroom, EMPTY_FLUX, EMPTY_DYNAMIC_METRICS, DEFAULT_SOC_BASELINE_GC_M2 
} from '../utils/carbonCalculations';

interface AnalyticsViewProps {
  selectedNode: string;
  setSelectedNode: (id: string) => void;
  readings: SensorReading[];
  nodes: AnalyticsNode[];
  userRole?: string;
}

interface AiInsight {
  analisis: string;
  rekomendasi: string;
  data_warning?: string | null;
  time_range?: string;
  total_readings?: number;
  generated_at?: string;
  provider?: string;
}

interface AiHistoryItem {
  id: string | number;
  time_range: string;
  provider?: string | null;
  created_at: string;
  analysis_text: string;
  recommendation_json: string;
}

interface AiInsightError {
  response?: {
    data?: {
      analisis?: string;
      rekomendasi?: string;
      error?: string;
    };
    status?: string | number;
  };
  message?: string;
}

const formatInsightTimeRangeLabel = (timeRange?: string) => {
  if (timeRange === '24h') return '24 jam terakhir';
  if (timeRange === '7d') return '7 hari terakhir';
  if (timeRange === '30d') return '30 hari terakhir';
  return timeRange || 'Riwayat terakhir';
};

const formatInsightProviderLabel = (provider?: string) => {
  if (!provider) return null;

  const normalized = provider.toLowerCase();
  if (normalized === 'history') return 'Riwayat tersimpan';
  if (normalized === 'gemini') return 'Gemini';
  if (normalized === 'groq') return 'Groq';
  if (normalized === 'rule-based' || normalized === 'rule_based') return 'Sistem Pakar AgriSense';

  if (normalized.startsWith('openrouter:')) {
    return 'OpenRouter';
  }

  if (normalized === 'openrouter') return 'OpenRouter';

  return provider;
};

const mapHistoryItemToInsight = (item: AiHistoryItem): AiInsight => ({
  analisis: item.analysis_text,
  rekomendasi: item.recommendation_json,
  time_range: formatInsightTimeRangeLabel(item.time_range),
  generated_at: `${new Date(item.created_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`,
  provider: item.provider || 'history',
});

// Konstanta dan utilitas karbon telah dipindahkan ke src/utils

export default function AnalyticsView({ selectedNode, setSelectedNode, readings, nodes, userRole }: AnalyticsViewProps) {
  const [timeRange, setTimeRange] = useState("7d");
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [trueAiInsight, setTrueAiInsight] = useState<AiInsight | null>(null);
  const [aiHistory, setAiHistory] = useState<AiHistoryItem[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [historyDate, setHistoryDate] = useState<Date | undefined>(undefined);

  const currentNode = useMemo(() => {
    if (nodes.length === 0) return null;
    if (!selectedNode) return nodes[0]; // Only fallback to first node if NO selection exists
    return nodes.find(n => (n.id?.toString() === selectedNode?.toString() || n.device_code === selectedNode)) || null;
  }, [selectedNode, nodes]);

  // Filter readings for current node and time range
  const nodeReadings = useMemo(() => {
    if (!currentNode) return [];
    
    let filtered = readings.filter(r => 
      r.device_id === currentNode.device_code || 
      r.device_id?.toString() === currentNode.id?.toString()
    );

    // Apply time range filter
    const now = new Date();
    let threshold = new Date();
    
    if (timeRange === '24h') threshold = addDays(now, -1);
    else if (timeRange === '7d') threshold = addDays(now, -7);
    else if (timeRange === '30d') threshold = addDays(now, -30);
    else return filtered; // No filter for other values

    return filtered.filter(r => new Date(r.timestamp) >= threshold);
  }, [readings, currentNode, timeRange]);

  const correlationData = useMemo(() => {
    return nodeReadings.map(r => ({
      ch4: r.carbon_data?.ch4_ppm ?? 0,
      co2: r.carbon_data?.co2_ppm ?? r.co2_ppm ?? 0,
      humidity: r.environment?.air_humidity_percent ?? 0,
      temp: r.environment?.air_temperature_c ?? 0,
      timestamp: r.timestamp
    }));
  }, [nodeReadings]);

  // Derived dynamic metrics
  const cciTrendData = useMemo(() => {
    const sorted = [...nodeReadings].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    const socBaseline = resolveSocBaseline(currentNode);
    const cMax = resolveCMax(currentNode, socBaseline);
    const rangeNpp = sorted.reduce((sum, r) => sum + calculateCarbonFlux(r, currentNode?.plant_name).npp, 0);
    const knownCumulativeNpp = Number(currentNode?.cumulative_npp ?? NaN);
    let runningNpp = Number.isFinite(knownCumulativeNpp) && knownCumulativeNpp > 0
      ? Math.max(0, knownCumulativeNpp - rangeNpp)
      : 0;

    const pointData = sorted.map(r => {
      const fx = calculateCarbonFlux(r, currentNode?.plant_name);
      runningNpp += fx.npp;
      const cciVal = r.carbon_data?.cci_value ?? r.cci_value;
      let parsedCci = 0;
      if (typeof cciVal === 'number') parsedCci = cciVal;
      else if (typeof cciVal === 'string') parsedCci = parseFloat(cciVal);
      else {
        const co2Val = r.carbon_data?.co2_ppm ?? r.co2_ppm ?? 0;
        parsedCci = co2Val > 0 ? co2Val / 400 : 0;
      }
      return {
        reading: r,
        cci: Number.isFinite(parsedCci) ? parsedCci : 0,
        cps: calculateCpsHeadroom(socBaseline, runningNpp, cMax),
        nee: fx.nee,
        co2: r.carbon_data?.co2_ppm ?? r.co2_ppm ?? 0,
      };
    });

    // For 30d, aggregate per week
    if (timeRange === '30d') {
      const weeks: Record<string, { sumCps: number; sumNee: number; sumCo2: number; count: number }> = {};
      pointData.forEach(point => {
        const r = point.reading;
        const d = new Date(r.timestamp);
        const weekNum = Math.ceil((d.getDate()) / 7);
        const key = `Minggu ${weekNum} - ${format(d, 'MMM', { locale: id })}`;
        if (!weeks[key]) weeks[key] = { sumCps: 0, sumNee: 0, sumCo2: 0, count: 0 };
        weeks[key].sumCps += point.cps;
        weeks[key].sumNee += point.nee;
        weeks[key].sumCo2 += point.co2;
        weeks[key].count += 1;
      });
      return Object.entries(weeks).map(([key, val]) => ({
        timestamp: key,
        cps: Number((val.sumCps / val.count).toFixed(3)),
        nee: Number((val.sumNee / val.count).toFixed(4)),
        co2: Number((val.sumCo2 / val.count).toFixed(1)),
      }));
    }

    // For 7d, aggregate per day
    if (timeRange === '7d') {
      const days: Record<string, { sumCps: number; sumNee: number; sumCo2: number; count: number }> = {};
      pointData.forEach(point => {
        const r = point.reading;
        const d = new Date(r.timestamp);
        const key = format(d, 'dd MMM', { locale: id });
        if (!days[key]) days[key] = { sumCps: 0, sumNee: 0, sumCo2: 0, count: 0 };
        days[key].sumCps += point.cps;
        days[key].sumNee += point.nee;
        days[key].sumCo2 += point.co2;
        days[key].count += 1;
      });
      return Object.entries(days).map(([key, val]) => ({
        timestamp: key,
        cps: Number((val.sumCps / val.count).toFixed(3)),
        nee: Number((val.sumNee / val.count).toFixed(4)),
        co2: Number((val.sumCo2 / val.count).toFixed(1)),
      }));
    }
    
    // For 24h or default, map each point
    return pointData.map(point => {
      const r = point.reading;
      const d = new Date(r.timestamp);
      let label = r.time ? (r.time.split(' ')[1]?.substring(0, 5) || r.time) : format(d, "HH:mm");
      return {
        timestamp: label,
        cci: Number(point.cci.toFixed(3)),
        cps: Number(point.cps.toFixed(3)),
        nee: Number(point.nee.toFixed(4)),
        co2: point.co2,
      };
    });
  }, [nodeReadings, timeRange, currentNode]);

  const dynamicMetrics = useMemo<DynamicMetrics>(() => {
    if (nodeReadings.length === 0) return EMPTY_DYNAMIC_METRICS;
    
    // The API returns data in DESCENDING order (newest first)
    const latestReading = nodeReadings[0];
    
    // 1. Calculate Real R2 (Coefficient of Determination)
    let r2Value = 0;
    if (correlationData.length > 1) {
      const n = correlationData.length;
      let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
      correlationData.forEach(p => {
        sumX += p.ch4;
        sumY += p.co2;
        sumXY += p.ch4 * p.co2;
        sumX2 += p.ch4 * p.ch4;
      });
      const denominator = (n * sumX2 - sumX * sumX);
      if (denominator !== 0) {
        const slope = (n * sumXY - sumX * sumY) / denominator;
        const intercept = (sumY - slope * sumX) / n;
        
        const meanY = sumY / n;
        let ssTot = 0;
        let ssRes = 0;
        correlationData.forEach(p => {
          ssTot += Math.pow(p.co2 - meanY, 2);
          const predictedY = slope * p.ch4 + intercept;
          ssRes += Math.pow(p.co2 - predictedY, 2);
        });
        r2Value = ssTot !== 0 ? Math.max(0, 1 - (ssRes / ssTot)) : 0;
      }
    }
    
    // 2. CPS Headroom, selaras dokumen LaTeX:
    // CPS = 1 - (C_current / C_max), C_current = SOC_baseline + C_biomass,acc.
    const avg = (values: number[], fallback: number) => {
      const valid = values.filter(v => Number.isFinite(v));
      return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : fallback;
    };

    const co2 = avg(nodeReadings.map(r => r.carbon_data?.co2_ppm ?? r.co2_ppm ?? NaN), 400);
    const latestCo2 = latestReading.carbon_data?.co2_ppm ?? latestReading.co2_ppm ?? co2;
    const lux = 0; // sensor removed from hardware
    const temp = avg(nodeReadings.map(r => r.environment?.air_temperature_c ?? NaN), 25);
    const moisture = 0; // sensor removed from hardware

    const socBaseline = resolveSocBaseline(currentNode);
    const cMax = resolveCMax(currentNode, socBaseline);
    const estimatedRangeNpp = nodeReadings.reduce((sum, reading) => {
      return sum + calculateCarbonFlux(reading, currentNode?.plant_name).npp;
    }, 0);
    const cumulativeNpp = Number.isFinite(Number(currentNode?.cumulative_npp)) && Number(currentNode?.cumulative_npp) > 0
      ? Number(currentNode?.cumulative_npp)
      : estimatedRangeNpp;
    const cCurrent = socBaseline + cumulativeNpp;
    const cciRaw = calculateCpsHeadroom(socBaseline, cumulativeNpp, cMax);
    const cciValue = cciRaw.toFixed(3);
    const cciStatus = cciRaw > 0.75 ? "OPTIMAL" : cciRaw > 0.50 ? "BAIK" : cciRaw > 0.25 ? "CUKUP" : "RENDAH";

    // 3. Carbon Flux Breakdown (Mirror CarbonFluxService.php — LUE Monteith 1972)
    const fx = calculateCarbonFlux({
      timestamp: latestReading.timestamp,
      environment: { light_lux: lux, air_temperature_c: temp },
      soil_7in1: { soil_moisture_percent: moisture },
      carbon_data: { co2_ppm: co2 },
    }, currentNode?.plant_name);
    const nee = fx.nee;

    const avgCo2 = correlationData.length > 0
      ? correlationData.reduce((sum, point) => sum + point.co2, 0) / correlationData.length
      : co2;
    const co2Status = co2 < 380
      ? "CO2 Rendah"
      : co2 > 900
        ? "CO2 Anomali"
        : co2 > 700
          ? "CO2 Tinggi"
          : co2 > 500
            ? "CO2 Elevasi"
            : "CO2 Normal";
    const carbonState = nee > 0.03 && co2 <= 800
      ? "Carbon Sink"
      : (co2 > 800 || (lux < 5000 && co2 > 600))
        ? "Carbon Source"
        : "Stabil";

    // 4. Photosynthesis Efficiency
    const photoEff = Number(Math.min(100, Math.max(0, (lux / 2000) * 100)).toFixed(0));

    // 5. Soil Capacity
    const soilCap = Number(Math.min(100, moisture).toFixed(0));

    return { 
      r2: r2Value.toFixed(2), 
      cci: cciValue, 
      cciStatus,
      cciRaw,
      carbonState,
      co2Status,
      avgCo2: Number(avgCo2.toFixed(1)),
      currentCo2: Number(latestCo2.toFixed(1)),
      cciBd: [
        { l: "SOC Baseline", s: Math.min(1, socBaseline / cMax), w: 0, r: Number(socBaseline.toFixed(1)), u: "gC/m2", formula: "SoilGrids/fallback" },
        { l: "Akumulasi NPP", s: Math.min(1, cumulativeNpp / cMax), w: 0, r: Number(cumulativeNpp.toFixed(4)), u: "gC/m2", formula: "C_biomass,acc" },
        { l: "C Current", s: Math.min(1, cCurrent / cMax), w: 0, r: Number(cCurrent.toFixed(1)), u: "gC/m2", formula: "SOC + biomassa" },
        { l: "C Max", s: 1, w: 0, r: Number(cMax.toFixed(1)), u: "gC/m2", formula: "SOC x 2.0" },
      ],
      fx,
      photosynthesis: photoEff, 
      soilCapacity: soilCap,
      socBaseline,
      cumulativeNpp,
      cCurrent,
      cMax,
      latest: latestReading
    };
  }, [nodeReadings, correlationData, currentNode]);

  const chartData = useMemo(() => {
    const raw = [...nodeReadings].reverse();

    if (raw.length === 0) return [];

    const groupMap: Record<string, GroupedReading> = {};

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
          air_temperature_c: 0, air_humidity_percent: 0, count: 0
        };
      }
      groupMap[key].air_temperature_c += r.environment?.air_temperature_c || 0;
      groupMap[key].air_humidity_percent += r.environment?.air_humidity_percent || 0;
      groupMap[key].count += 1;
    });

    return Object.values(groupMap).map((g) => ({
      timestamp: g.timestamp,
      displayLabel: g.displayLabel,
      environment: {
        air_temperature_c: Number((g.air_temperature_c / g.count).toFixed(1)),
        air_humidity_percent: Number((g.air_humidity_percent / g.count).toFixed(1))
      }
    }));
  }, [nodeReadings, timeRange]);

  const agronomyData = useMemo(() => {
    return { trend: [], radar: [] };
  }, [nodeReadings, timeRange]);

  const fetchAiHistory = useCallback(async (options?: { syncLatest?: boolean; silent?: boolean }) => {
    if (!currentNode) {
      setAiHistory([]);
      if (options?.syncLatest) {
        setTrueAiInsight(null);
      }
      return [];
    }

    if (!options?.silent) {
      setIsHistoryLoading(true);
    }

    try {
      const res = await api.get(`/ai-insight/history?node_id=${currentNode?.id}`);
      const histories = res.data.success ? (res.data.data as AiHistoryItem[]) : [];
      setAiHistory(histories);

      if (options?.syncLatest) {
        setTrueAiInsight(histories.length > 0 ? mapHistoryItemToInsight(histories[0]) : null);
      }

      return histories;
    } catch (err) {
      console.error("Failed to fetch AI history", err);
      if (options?.syncLatest) {
        setTrueAiInsight(null);
      }
      return [];
    } finally {
      if (!options?.silent) {
        setIsHistoryLoading(false);
      }
    }
  }, [currentNode]);

  useEffect(() => {
    void fetchAiHistory({ syncLatest: true, silent: true });
  }, [fetchAiHistory]);

  const heuristicInsights = useMemo(() => {
    const l = dynamicMetrics.latest;
    if (!l) return { location: "Menunggu data...", recommendation: "Menunggu data..." };

    const alt = l.location?.altitude_m ?? 0;
    const press = l.environment?.air_pressure_hpa ?? 1013;
    const ph = 7; // sensor removed from hardware
    const n = 0; // sensor removed from hardware
    const temp = l.environment?.air_temperature_c ?? 25;
    const moist = 0; // sensor removed from hardware
    const light = 0; // sensor removed from hardware
    const co2 = l.carbon_data?.co2_ppm ?? 400;

    // Advanced Locational Insights
    let locInsight = `Elevasi ${alt}m dpl dengan tekanan ${press} hPa. `;
    if (alt > 800) locInsight += `Suhu sejuk memperlambat sebagian proses respirasi dan dapat menjaga kestabilan karbon organik. `;
    else if (alt < 100) locInsight += `Lahan rendah perlu dipantau karena kelembapan dan salinitas dapat memengaruhi emisi karbon tanah. `;
    
    locInsight += `Iklim mikro mendukung pertukaran CO2 yang stabil, sehingga interpretasi NEE dan potensi sekuestrasi karbon lebih andal. `;

    // Carbon-cycle recommendations
    const recs: string[] = [];

    let finalRec = "";
    if (recs.length === 0) {
      finalRec = `Kondisi mikroklimat mendukung siklus karbon. Carbon Potential Score berada pada ${dynamicMetrics.cci}; lahan cenderung ${dynamicMetrics.carbonState}. Pertahankan pemantauan CO2, kelembapan, dan suhu untuk menjaga potensi sekuestrasi karbon.`;
    } else {
      finalRec = recs.join(" ");
    }

    return { location: locInsight, recommendation: finalRec };
  }, [dynamicMetrics, currentNode]);

  const generateTrueAiInsight = async () => {
    if (!currentNode) return;
    setIsAiThinking(true);
    
    // Viewer tetap memakai endpoint backend dengan mode rule-based
    // agar hasilnya konsisten dan masuk ke riwayat analisis.

    try {
      const res = await api.post('/ai-insight/generate', {
        node_id: currentNode.id?.toString(),
        time_range: timeRange,
        force_rule_based: userRole === 'viewer'
      });
      if (res.data && res.data.analisis) {
        setTrueAiInsight(res.data);
        await fetchAiHistory();
      }
    } catch (err: unknown) {
      console.error("Gagal mendapatkan AI Insight", err);
      const apiError = err as AiInsightError;
      const errorData = apiError.response?.data;
      setTrueAiInsight({
        analisis: errorData?.analisis || (userRole === 'viewer'
          ? `${heuristicInsights.location} Berdasarkan evaluasi sistem rule-based lokal, kondisi lahan berada dalam batasan operasional yang telah ditetapkan.`
          : 'Gagal menghubungi layanan AI. Pastikan koneksi internet stabil dan konfigurasi server sudah benar.'),
        rekomendasi: errorData?.rekomendasi || (userRole === 'viewer'
          ? heuristicInsights.recommendation
          : 'Coba ulangi beberapa saat lagi. Jika masalah berlanjut, hubungi administrator sistem.'),
        data_warning: errorData?.error || `⚠️ Error ${apiError.response?.status || 'Network'}: ${apiError.message || 'Koneksi ke server AI gagal.'}`,
        time_range: timeRange === '24h' ? '24 jam terakhir' : timeRange === '7d' ? '7 hari terakhir' : '30 hari terakhir',
        generated_at: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) + (userRole === 'viewer' ? ' WIB (Local Fallback)' : ' WIB')
      });
    } finally {
      setIsAiThinking(false);
    }
  };

  const regressionLine = useMemo(() => {
    if (correlationData.length < 2) return [];
    
    const n = correlationData.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    correlationData.forEach(p => {
      sumX += p.ch4;
      sumY += p.co2;
      sumXY += p.ch4 * p.co2;
      sumX2 += p.ch4 * p.ch4;
    });
    
    const denominator = (n * sumX2 - sumX * sumX);
    if (denominator === 0) return [];
    
    const slope = (n * sumXY - sumX * sumY) / denominator;
    const intercept = (sumY - slope * sumX) / n;
    
    const minX = Math.min(...correlationData.map(p => p.ch4));
    const maxX = Math.max(...correlationData.map(p => p.ch4));
    
    return [
      { ch4: minX, co2: slope * minX + intercept },
      { ch4: maxX, co2: slope * maxX + intercept }
    ];
  }, [correlationData]);

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center space-y-4 bg-card rounded-3xl border-2 border-dashed border-border/50">
        <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center text-amber-500">
          <AlertTriangle size={32} />
        </div>
        <div>
          <h2 className="text-xl font-bold">Perangkat Belum Terdaftar</h2>
          <p className="text-muted-foreground max-w-md mx-auto">Sistem tidak mendeteksi adanya Node IoT. Silakan masuk ke menu <b>Manajemen Perangkat</b> untuk mendaftarkan node Anda agar analitik dapat berjalan.</p>
        </div>
      </div>
    );
  }


  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Karbon & Tanaman</h1>
          <p className="text-muted-foreground">Korelasi data sensor dengan kondisi lingkungan spesifik lokasi</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={String(currentNode?.device_code || selectedNode)} onValueChange={(v) => setSelectedNode(v || '')}>
            <SelectTrigger className="w-[260px] border-none shadow-sm bg-card font-semibold text-xs rounded-md h-10">
              <SelectValue placeholder="Pilih Node" />
            </SelectTrigger>
            <SelectContent className="rounded-md border-none shadow-2xl min-w-[280px]">
              {nodes.map(node => (
                <SelectItem key={node.id} value={String(node.device_code || node.id)} className="font-semibold text-xs uppercase">{node.name || node.id}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v || '24h')}>
            <SelectTrigger className="w-[160px] border-none shadow-sm bg-card font-semibold text-xs rounded-md h-10">
              <SelectValue placeholder="Rentang Waktu" />
            </SelectTrigger>
            <SelectContent className="rounded-md border-none shadow-2xl">
              <SelectItem value="24h" className="font-semibold text-xs">24 Jam Terakhir</SelectItem>
              <SelectItem value="7d" className="font-semibold text-xs">7 Hari Terakhir</SelectItem>
              <SelectItem value="30d" className="font-semibold text-xs">30 Hari Terakhir</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>



          <div className="flex flex-col lg:flex-row gap-4 items-start">
            {/* KOLOM KIRI (75%) */}
            <div className="w-full lg:w-[75%] flex flex-col gap-6">
              {/* Baris 1: Konteks & Korelasi */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 items-stretch">
        <Card className="lg:col-span-1 border-none shadow-xl shadow-emerald-900/10 bg-gradient-to-br from-emerald-600 to-teal-700 text-white overflow-hidden relative flex flex-col h-full">
          <div className="absolute -top-6 -right-6 opacity-10 rotate-12">
            <MapIcon size={160} />
          </div>
          <CardHeader className="pb-2 p-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-widest opacity-70">Konteks Lokasi Node</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-between p-4 pt-0">
            <div className="space-y-4">
              <div>
                <div className="mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider opacity-60 mb-1">Perangkat (Node)</p>
                  <p className="text-sm font-bold text-emerald-200">{currentNode?.name || currentNode?.id || "AGNODE"}</p>
                </div>
                
                <div className="mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider opacity-60 mb-1">Lokasi Lahan</p>
                  <p className="text-sm font-bold tracking-tight leading-tight mb-1">{currentNode?.plot_name || "Lahan Utama"}</p>
                </div>

                <div className="mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider opacity-60 mb-1">Komoditi / Tanaman</p>
                  <p className="text-sm font-bold tracking-tight leading-tight mb-1">{currentNode?.plant_name || "Tidak ada data tanaman"}</p>
                </div>

                <div className="flex items-start gap-1.5 opacity-90 bg-white/10 p-2 rounded-lg border border-white/5">
                  <MapPin size={12} className="mt-0.5 text-emerald-300 shrink-0" />
                  <div className="flex flex-col gap-1">
                    <p className="text-[10px] font-medium leading-relaxed italic" title={currentNode?.address || "Alamat belum terdaftar di sistem"}>
                      {(() => {
                        const addr = currentNode?.address || "Alamat belum terdaftar di sistem";
                        const parts = addr.split(',').map((s: string) => s.trim());
                        const cleaned = parts.filter((p: string) => {
                          const lower = p.toLowerCase();
                          if (lower === 'jawa' || lower === 'indonesia') return false;
                          if (/^\d{5}$/.test(p)) return false;
                          return true;
                        });
                        return cleaned.join(', ');
                      })()}
                    </p>
                    {currentNode?.kondisi_sekitar && (
                      <p className="text-[9px] font-semibold text-emerald-200">
                        Kondisi: {currentNode.kondisi_sekitar.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())} ({currentNode.radius_konteks_m || 60}m)
                      </p>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 gap-4 pt-4 border-t border-white/10">
                <div className="space-y-1">
                  <p className="text-[10px] opacity-60 uppercase font-bold tracking-wider">Ketinggian</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm font-black">{dynamicMetrics.latest?.location?.altitude_m ?? 720}</span>
                    <span className="text-[9px] font-medium opacity-70 whitespace-nowrap">m dpl</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>


      </div>

      <Card className="border-none shadow-sm shadow-black/5">
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle>Tren Konsentrasi CO2</CardTitle>
                <Popover>
                  <PopoverTrigger className="p-1 rounded-full bg-muted/50 hover:bg-muted text-muted-foreground hover:text-primary transition-colors">
                      <Info size={14} />
                  </PopoverTrigger>
                  <PopoverContent className="w-64 text-xs z-50 shadow-xl" align="start">
                    <p className="font-semibold mb-1 text-[13px]">Tren Konsentrasi CO2</p>
                    <p className="text-muted-foreground">Menampilkan sinyal karbon mentah dari sensor. Kenaikan tajam dapat menunjukkan akumulasi CO2, respirasi dominan, atau anomali pembacaan yang perlu diverifikasi.</p>
                  </PopoverContent>
                </Popover>
              </div>
              <CardDescription>
                Fluktuasi CO2 {timeRange === '24h' ? 'per jam (24 jam terakhir)' : timeRange === '7d' ? 'per hari (7 hari terakhir)' : 'per minggu (30 hari terakhir)'} - {currentNode?.name || 'Node'}
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[250px] min-h-[250px] min-w-0 pt-0 relative">
              {nodeReadings.length === 0 && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-[1px]">
                  <p className="text-xs text-muted-foreground font-medium bg-background px-3 py-1.5 rounded-full shadow-sm border">Belum ada data di rentang waktu ini</p>
                </div>
              )}
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cciTrendData} margin={{ top: 10, right: 10, left: -5, bottom: 25 }}>
                  <defs>
                    <linearGradient id="colorCo2Trend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0f766e" stopOpacity={0.28}/>
                      <stop offset="95%" stopColor="#0f766e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                  <XAxis
                    dataKey="timestamp"
                    tick={{fontSize: 10}}
                    axisLine={false}
                    tickLine={false}
                    label={{ value: timeRange === '24h' ? 'Waktu' : timeRange === '7d' ? 'Hari' : 'Minggu', position: 'insideBottom', offset: -15, fontSize: 11, fontWeight: '600', fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis
                    type="number"
                    domain={['auto', 'auto']}
                    tick={{fontSize: 10}}
                    axisLine={false}
                    tickLine={false}
                    label={{ value: 'CO2 (ppm)', angle: -90, position: 'insideLeft', offset: 15, fontSize: 11, fontWeight: '600', fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                    labelStyle={{ fontWeight: 'bold', color: 'hsl(var(--foreground))', marginBottom: '4px' }}
                  />
                  <Area type="monotone" dataKey="co2" name="CO2 (ppm)" stroke="#0f766e" fillOpacity={1} fill="url(#colorCo2Trend)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

      {/* Baris 2: Tren Serapan Karbon */}
      <Card className="border-none shadow-sm shadow-black/5">
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle>Tren Potensi Karbon (CPS)</CardTitle>
                <Popover>
                  <PopoverTrigger className="p-1 rounded-full bg-muted/50 hover:bg-muted text-muted-foreground hover:text-primary transition-colors">
                      <Info size={14} />
                  </PopoverTrigger>
                  <PopoverContent className="w-64 text-xs z-50 shadow-xl" align="start">
                    <p className="font-semibold mb-1 text-[13px]">Tren Potensi Karbon (CPS)</p>
                    <p className="text-muted-foreground">Menampilkan fluktuasi Carbon Potential Score sebagai indeks internal untuk membaca potensi lahan menyerap, menyimpan, atau melepas karbon.</p>
                  </PopoverContent>
                </Popover>
              </div>
              <CardDescription>
                Fluktuasi {timeRange === '24h' ? 'per jam (24 jam terakhir)' : timeRange === '7d' ? 'per hari (7 hari terakhir)' : 'per minggu (30 hari terakhir)'} — {currentNode?.name || 'Node'}
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[250px] min-h-[250px] min-w-0 pt-0 relative">
              {nodeReadings.length === 0 && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-[1px]">
                  <p className="text-xs text-muted-foreground font-medium bg-background px-3 py-1.5 rounded-full shadow-sm border">Belum ada data di rentang waktu ini</p>
                </div>
              )}
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cciTrendData} margin={{ top: 10, right: 10, left: -5, bottom: 25 }}>
                  <defs>
                    <linearGradient id="colorCci" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                  <XAxis 
                    dataKey="timestamp" 
                    tick={{fontSize: 10}} 
                    axisLine={false} 
                    tickLine={false}
                    label={{ value: timeRange === '24h' ? 'Waktu' : timeRange === '7d' ? 'Hari' : 'Minggu', position: 'insideBottom', offset: -15, fontSize: 11, fontWeight: '600', fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis 
                    type="number" 
                    
                    domain={['auto', 'auto']} 
                    tick={{fontSize: 10}} 
                    axisLine={false} 
                    tickLine={false}
                    label={{ value: 'CPS Index', angle: -90, position: 'insideLeft', offset: 15, fontSize: 11, fontWeight: '600', fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                    labelStyle={{ fontWeight: 'bold', color: 'hsl(var(--foreground))', marginBottom: '4px' }}
                  />
                  <Area type="monotone" dataKey="cps" name="CPS" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorCci)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm shadow-black/5">
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle>Laju Pertukaran Karbon (Carbon Flux / NEE)</CardTitle>
                <Popover>
                  <PopoverTrigger className="p-1 rounded-full bg-muted/50 hover:bg-muted text-muted-foreground hover:text-primary transition-colors">
                      <Info size={14} />
                  </PopoverTrigger>
                  <PopoverContent className="w-64 text-xs z-50 shadow-xl" align="start">
                    <p className="font-semibold mb-1 text-[13px]">Carbon Flux (NEE)</p>
                    <p className="text-muted-foreground">Menampilkan tren pertukaran karbon bersih. Nilai positif pada dashboard ini dibaca sebagai potensi lahan/ekosistem menyerap karbon, sedangkan penurunan tajam perlu dipantau sebagai risiko carbon source.</p>
                  </PopoverContent>
                </Popover>
              </div>
              <CardDescription>
                Fluktuasi {timeRange === '24h' ? 'per jam (24 jam terakhir)' : timeRange === '7d' ? 'per hari (7 hari terakhir)' : 'per minggu (30 hari terakhir)'} — {currentNode?.name || 'Node'}
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[250px] min-h-[250px] min-w-0 pt-0 relative">
              {nodeReadings.length === 0 && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-[1px]">
                  <p className="text-xs text-muted-foreground font-medium bg-background px-3 py-1.5 rounded-full shadow-sm border">Belum ada data di rentang waktu ini</p>
                </div>
              )}
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cciTrendData} margin={{ top: 10, right: 10, left: -5, bottom: 25 }}>
                  <defs>
                    <linearGradient id="colorNee" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                  <XAxis 
                    dataKey="timestamp" 
                    tick={{fontSize: 10}} 
                    axisLine={false} 
                    tickLine={false}
                    label={{ value: timeRange === '24h' ? 'Waktu' : timeRange === '7d' ? 'Hari' : 'Minggu', position: 'insideBottom', offset: -15, fontSize: 11, fontWeight: '600', fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis 
                    type="number" 
                    domain={['auto', 'auto']} 
                    tick={{fontSize: 10}} 
                    axisLine={false} 
                    tickLine={false}
                    label={{ value: 'NEE (gC/m2/jam)', angle: -90, position: 'insideLeft', offset: 15, fontSize: 11, fontWeight: '600', fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                    labelStyle={{ fontWeight: 'bold', color: 'hsl(var(--foreground))', marginBottom: '4px' }}
                  />
                  <Area type="monotone" dataKey="nee" name="Carbon Flux (NEE)" stroke="#10b981" fillOpacity={1} fill="url(#colorNee)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm shadow-black/5">
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle>Analisis Stres Lingkungan</CardTitle>
                <Popover>
                  <PopoverTrigger className="p-1 rounded-full bg-muted/50 hover:bg-muted text-muted-foreground hover:text-primary transition-colors">
                      <Info size={14} />
                  </PopoverTrigger>
                  <PopoverContent className="w-64 text-xs z-50 shadow-xl" align="start">
                    <p className="font-semibold mb-1 text-[13px]">Analisis Stres Lingkungan</p>
                    <p className="text-muted-foreground">Membandingkan suhu udara, kelembapan udara, dan kelembapan tanah sebagai faktor yang memengaruhi respirasi, akumulasi CO2, dan stabilitas karbon lahan.</p>
                  </PopoverContent>
                </Popover>
              </div>
              <CardDescription>Hubungan antara suhu udara, kelembapan, dan penguapan tanah</CardDescription>
            </CardHeader>
            <CardContent className="h-[250px] min-h-[250px] min-w-0 relative">
              {nodeReadings.length === 0 && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-[1px]">
                  <p className="text-xs text-muted-foreground font-medium bg-background px-3 py-1.5 rounded-full shadow-sm border">Belum ada data di rentang waktu ini</p>
                </div>
              )}
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
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
                    label={{ value: timeRange === '24h' ? 'Waktu' : timeRange === '7d' ? 'Hari' : 'Minggu', position: 'insideBottom', offset: -10, fontSize: 11, fontWeight: '600', fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    labelStyle={{ fontWeight: 'bold', color: 'hsl(var(--foreground))', marginBottom: '4px' }}
                    labelFormatter={(label) => {
                      if (timeRange === '30d' || timeRange === '1y') return label;
                      return format(new Date(label), timeRange === '24h' ? "d MMM, HH:mm" : "PPP", { locale: id });
                    }}
                  />
                  <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: '15px' }} />
                  <Line type="monotone" dataKey="environment.air_temperature_c" name="Suhu Udara" stroke="#ef4444" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="soil_7in1.soil_moisture_percent" name="Lembap Tanah" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="environment.air_humidity_percent" name="Lembap Udara" stroke="#10b981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm shadow-black/5 bg-primary/5 border border-primary/10 overflow-hidden">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2 font-bold text-primary">
                <div className="p-1.5 rounded-md bg-primary/10">
                  <Sparkles size={14} className={isAiThinking ? "animate-pulse text-amber-500" : ""} />
                </div>
                AgriSense True AI
              </CardTitle>
              <div className="flex items-center gap-2">
                {userRole !== 'viewer' && (
                  <>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => {
                        setIsHistoryOpen(true);
                        fetchAiHistory();
                      }}
                      className="h-8 text-xs bg-white hover:bg-muted border-border/50"
                    >
                      <History className="mr-1 h-3 w-3" /> Riwayat
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={generateTrueAiInsight} 
                      disabled={isAiThinking}
                      className="h-8 text-xs bg-white hover:bg-primary/10 border-primary/20 shadow-sm"
                    >
                      {isAiThinking ? (
                        <><Activity className="mr-1 h-3 w-3 animate-spin" /> AI Memproses...</>
                      ) : "✨ Minta Analisis AI"}
                    </Button>
                  </>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              {/* State: Belum pernah request AI */}
              {!trueAiInsight && !isAiThinking && (
                <div className="text-center py-8 space-y-3">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                    <Sparkles size={24} className="text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground max-w-[250px] mx-auto">Tekan tombol di atas untuk mendapatkan analisis cerdas berbasis data sensor {timeRange === '24h' ? '24 jam' : timeRange === '7d' ? '7 hari' : '30 hari'} terakhir.</p>
                </div>
              )}

              {/* State: Loading */}
              {isAiThinking && (
                <div className="space-y-4">
                  <div className="text-center py-2">
                    <p className="text-xs text-muted-foreground animate-pulse">AI sedang menganalisis data sensor...</p>
                  </div>
                  <div className="p-4 rounded-lg bg-white shadow-sm border border-primary/5">
                    <div className="animate-pulse space-y-2">
                      <div className="h-3 bg-muted rounded w-3/4"></div>
                      <div className="h-3 bg-muted rounded w-full"></div>
                      <div className="h-3 bg-muted rounded w-1/2"></div>
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-emerald-50 shadow-sm border border-emerald-100">
                    <div className="animate-pulse space-y-2">
                      <div className="h-3 bg-emerald-200/50 rounded w-full"></div>
                      <div className="h-3 bg-emerald-200/50 rounded w-5/6"></div>
                      <div className="h-3 bg-emerald-200/50 rounded w-4/6"></div>
                    </div>
                  </div>
                </div>
              )}

              {/* State: AI Response */}
              {trueAiInsight && !isAiThinking && (
                <div className="space-y-4">
                  {/* Data Warning Badge */}
                  {trueAiInsight.data_warning && (
                    <div className="p-3 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-700 flex items-start gap-2">
                      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                      <span>{trueAiInsight.data_warning}</span>
                    </div>
                  )}

                  {/* Analisis */}
                  <div className="relative p-4 rounded-lg bg-white shadow-sm border border-primary/5 text-sm leading-relaxed">
                    <p className="font-bold text-primary mb-2 flex items-center gap-1 text-sm">
                      <Sparkles size={14} /> Analisis AI
                    </p>
                    <p className="text-sm leading-relaxed whitespace-pre-line">{trueAiInsight.analisis}</p>
                  </div>

                  {/* Rekomendasi */}
                  <div className="relative p-4 rounded-lg bg-emerald-50 shadow-sm border border-emerald-100 text-sm leading-relaxed">
                    <p className="font-bold text-emerald-700 mb-2 flex items-center gap-1 text-sm">
                      <Leaf size={14} /> Rekomendasi
                    </p>
                    <p className="text-sm leading-relaxed whitespace-pre-line">{trueAiInsight.rekomendasi}</p>
                  </div>

                  {/* Meta info */}
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1 border-t pt-2 border-border/50">
                    <span className="flex items-center gap-2">
                      <span>📊 {trueAiInsight.time_range}</span>
                      {trueAiInsight.provider && (
                         <span className="bg-primary/10 px-1.5 py-0.5 rounded text-primary font-bold">
                           Sumber: {formatInsightProviderLabel(trueAiInsight.provider)}
                         </span>
                      )}
                    </span>
                    <span>🕒 {trueAiInsight.generated_at}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

            {/* KOLOM KANAN (25%) */}
            <div className="w-full lg:w-[25%] flex flex-col gap-6">
              {/* CPS Card */}
              <Card className="border-none shadow-sm shadow-black/5 h-fit flex flex-col justify-between">
                <CardHeader className="pb-1">
                  <div className="flex items-center justify-between">
                    <CardTitle>Carbon Potential Score (CPS)</CardTitle>
                    <Popover>
                      <PopoverTrigger className="p-1 rounded-full bg-muted/50 hover:bg-muted text-muted-foreground hover:text-primary transition-colors">
                          <Info size={14} />
                      </PopoverTrigger>
                      <PopoverContent className="w-64 text-xs z-50 shadow-xl" align="end">
                        <p className="font-semibold mb-1 text-[13px]">Apa itu Carbon Potential Score (CPS)?</p>
                        <p className="text-muted-foreground mb-2">Skor potensi serapan karbon lahan, makin tinggi makin baik.</p>
                        <p className="font-bold text-emerald-600">CPS = {(dynamicMetrics.cciRaw * 100).toFixed(1)}%</p>
                      </PopoverContent>
                    </Popover>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 pb-3">
                  <div className="text-center py-2">
                    <div className="text-4xl font-black text-emerald-500 mb-1">{(dynamicMetrics.cciRaw * 100).toFixed(1)}%</div>
                    <div className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-2">Carbon Potential Score = {dynamicMetrics.cci}</div>
                    <Badge className={dynamicMetrics.cciRaw > 0.75 ? "bg-emerald-500/20 text-emerald-600" : dynamicMetrics.cciRaw > 0.50 ? "bg-blue-500/20 text-blue-600" : dynamicMetrics.cciRaw > 0.25 ? "bg-yellow-500/20 text-yellow-600" : "bg-red-500/20 text-red-600"}>{dynamicMetrics.cciStatus}</Badge>
                  </div>

                  {/* CCI Breakdown */}
                  <div className="space-y-1.5 pt-2 border-t">
                    {dynamicMetrics.cciBd.map((item, i) => (
                      <div key={i} className="space-y-1">
                        <div className="flex justify-between items-center text-[11px] mb-0.5">
                          <div className="flex items-center gap-1.5 mr-1.5">
                            <span className="text-muted-foreground leading-tight">{item.l}</span>
                            <span className="font-mono text-[9px] text-muted-foreground/60 bg-muted/50 px-1 py-0.5 rounded whitespace-nowrap shrink-0">{item.formula ?? `${(item.s*100).toFixed(0)}% x ${item.w}%`}</span>
                          </div>
                          <strong className="text-foreground font-black text-[11px] whitespace-nowrap shrink-0">{item.r} <span className="text-[9px] text-muted-foreground font-medium">{item.u}</span></strong>
                        </div>
                        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full transition-all duration-700" style={{ width: `${Math.max(2, item.s*100)}%` }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Carbon Flux Card — Serapan Karbon */}
              <Card className="border-none shadow-sm shadow-black/5">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>Status Carbon Balance</CardTitle>
                      <CardDescription className="text-[10px]">Source/Sink dan deteksi anomali CO2</CardDescription>
                    </div>
                    <Badge className={dynamicMetrics.carbonState === 'Carbon Sink' ? "bg-emerald-500/20 text-emerald-600" : dynamicMetrics.carbonState === 'Carbon Source' ? "bg-red-500/20 text-red-600" : "bg-blue-500/20 text-blue-600"}>
                      {dynamicMetrics.carbonState}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-lg bg-muted/50">
                      <span className="text-[10px] text-muted-foreground block">CO2 Saat Ini</span>
                      <span className="font-bold text-sm">{dynamicMetrics.currentCo2.toFixed(1)} ppm</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-muted/50">
                      <span className="text-[10px] text-muted-foreground block">Rata-rata CO2</span>
                      <span className="font-bold text-sm">{dynamicMetrics.avgCo2.toFixed(1)} ppm</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-muted/50">
                      <span className="text-[10px] text-muted-foreground block">Carbon Flux</span>
                      <span className="font-bold text-sm">{dynamicMetrics.fx.nee.toFixed(4)}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-muted/50">
                      <span className="text-[10px] text-muted-foreground block">CPS</span>
                      <span className="font-bold text-sm">{(dynamicMetrics.cciRaw * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="p-3 rounded-md bg-primary/5 border border-primary/10">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-primary">Deteksi CO2</span>
                      <Badge className={dynamicMetrics.co2Status === 'CO2 Anomali' ? "bg-red-500/20 text-red-600 border-none" : dynamicMetrics.co2Status === 'CO2 Tinggi' || dynamicMetrics.co2Status === 'CO2 Elevasi' ? "bg-amber-500/20 text-amber-600 border-none" : dynamicMetrics.co2Status === 'CO2 Rendah' ? "bg-blue-500/20 text-blue-600 border-none" : "bg-emerald-500/20 text-emerald-600 border-none"}>
                        {dynamicMetrics.co2Status}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-relaxed mt-2">
                      Status ini membaca CO2 sebagai sinyal karbon lokal. Nilai di atas 500 ppm dianggap elevasi dan perlu dibaca bersama cahaya, NEE, ventilasi, posisi sensor, serta aktivitas respirasi lahan.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm shadow-black/5">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>Carbon Flux — Serapan Karbon (NEE)</CardTitle>
                  <CardDescription className="text-[10px]">Model LUE Monteith (1972)</CardDescription>
                </div>
                <Popover>
                  <PopoverTrigger className="p-1 rounded-full bg-muted/50 hover:bg-muted text-muted-foreground hover:text-primary transition-colors">
                      <Info size={14} />
                  </PopoverTrigger>
                  <PopoverContent className="w-[320px] text-xs z-50 shadow-xl" align="end">
                    <p className="font-semibold mb-1 text-[13px]">Net Ecosystem Exchange (NEE)</p>
                    <div className="text-[10px] text-muted-foreground space-y-2 mb-3">
                      <p>Pertukaran karbon bersih antara lahan dan atmosfer.</p>
                    </div>
                    <div className="space-y-0.5 pt-1.5 border-t border-border/50">
                      <p className="font-bold text-[10px] text-emerald-600">Positif (+): lahan menyerap karbon.</p>
                      <p className="font-bold text-[10px] text-red-500">Negatif (-): lahan melepas karbon.</p>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center py-3 flex flex-col items-center">
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-4xl font-black text-primary">{dynamicMetrics.fx.nee.toFixed(4)}</span>
                  <span className="text-sm font-semibold text-foreground">gC/m² per jam</span>
                </div>
                <div className="text-sm font-semibold text-foreground leading-tight">
                  ≈ {Math.abs(dynamicMetrics.fx.co2Seq).toFixed(4)} gCO₂/m² {dynamicMetrics.fx.nee >= 0 ? 'diserap' : 'dilepas'} oleh ekosistem
                </div>
              </div>


            </CardContent>
          </Card>

              </div>
            </div>

        <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col p-0 border-none shadow-2xl">
            <DialogHeader className="p-6 pb-2">
              <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <History size={20} />
                </div>
                Riwayat Analisis AI
              </DialogTitle>
              <DialogDescription>
                Daftar analisis cerdas yang pernah dihasilkan untuk node ini.
              </DialogDescription>
              <div className="flex items-center gap-2 pt-3">
                <Popover>
                  <PopoverTrigger className="w-full inline-flex items-center justify-start text-left bg-card border border-border/50 h-10 rounded-xl shadow-sm font-medium text-xs hover:bg-muted/50 transition-colors px-4">
                    <img src="https://cdn-icons-png.flaticon.com/512/833/833593.png" alt="calendar" className="w-4 h-4 object-contain opacity-75 mr-2" />
                    {historyDate ? format(historyDate, "d MMM yyyy", { locale: id }) : <span className="text-muted-foreground">Semua Tanggal</span>}
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-[60]" align="start">
                    <Calendar
                      mode="single"
                      selected={historyDate}
                      onSelect={setHistoryDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                {historyDate && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 px-2 text-xs text-muted-foreground hover:text-destructive"
                    onClick={() => setHistoryDate(undefined)}
                  >
                    <X size={14} className="mr-1" />
                    Reset
                  </Button>
                )}
              </div>
            </DialogHeader>
            
            <div className="flex-1 overflow-y-auto p-6 pt-2 space-y-4">
              {isHistoryLoading ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <Activity className="animate-spin text-primary" size={32} />
                  <p className="text-sm text-muted-foreground">Mengambil riwayat...</p>
                </div>
              ) : (() => {
                const filteredHistory = historyDate
                  ? aiHistory.filter((item) => {
                      const itemDate = new Date(item.created_at);
                      return (
                        itemDate.getFullYear() === historyDate.getFullYear() &&
                        itemDate.getMonth() === historyDate.getMonth() &&
                        itemDate.getDate() === historyDate.getDate()
                      );
                    })
                  : aiHistory;
                return filteredHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-3 opacity-60">
                  <Clock size={40} className="text-muted-foreground" />
                  <p className="text-sm">{historyDate ? `Tidak ada riwayat pada ${format(historyDate, 'd MMMM yyyy', { locale: id })}.` : 'Belum ada riwayat analisis untuk node ini.'}</p>
                </div>
              ) : (
                filteredHistory.map((item) => (
                  <div key={item.id} className="group relative p-5 rounded-2xl bg-muted/30 border border-border/50 hover:border-primary/20 hover:bg-primary/[0.02] transition-all duration-300">
                    <button 
                      onClick={() => setExpandedHistoryId(expandedHistoryId === String(item.id) ? null : String(item.id))}
                      className="w-full flex justify-between items-center text-left focus:outline-none"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="bg-white text-[10px] font-bold px-2 py-0 h-5 border-border/50">
                          {item.time_range === '24h' ? '24 JAM' : item.time_range === '7d' ? '7 HARI' : '30 HARI'}
                        </Badge>
                        <span className="text-sm font-bold text-foreground">
                          Analisis tanggal {format(new Date(item.created_at), "d MMMM yyyy", { locale: id })} jam {format(new Date(item.created_at), "HH:mm", { locale: id })} WIB
                        </span>
                      </div>
                      <div className="p-1.5 rounded-full bg-primary/10 text-primary">
                        <ChevronRight size={16} className={cn("transition-transform duration-300", expandedHistoryId === item.id ? "rotate-90" : "")} />
                      </div>
                    </button>
                    
                    {expandedHistoryId === item.id && (
                      <div className="mt-4 pt-4 border-t border-border/50 space-y-3 animate-in slide-in-from-top-2 fade-in duration-300">
                        <div>
                          <p className="text-[10px] font-black text-primary/70 uppercase tracking-widest mb-1">Analisis</p>
                          <p className="text-xs leading-relaxed text-foreground/80 whitespace-pre-line">{item.analysis_text}</p>
                        </div>
                        
                        <div>
                          <p className="text-[10px] font-black text-emerald-600/70 uppercase tracking-widest mb-1">Rekomendasi</p>
                          <div className="text-[11px] leading-relaxed text-foreground/70 whitespace-pre-line bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100/50">
                            {item.recommendation_json}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              );
              })()}
            </div>
            
            <DialogFooter className="p-4 bg-muted/20 border-t">
              <Button variant="ghost" size="sm" onClick={() => setIsHistoryOpen(false)}>
                Tutup
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

    </div>
);
}
