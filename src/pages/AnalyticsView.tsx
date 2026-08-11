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
  X,
  Gauge,
  TrendingUp,
  LineChart as LineChartIcon,
  CloudSun,
  Loader2,
  Radio,
  Plus
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, addDays, id } from '@/utils/formatters';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, ComposedChart } from 'recharts';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

import type { SensorReading, AnalyticsNode, DynamicMetrics, GroupedReading } from '../types';

import { 
  calculateCarbonFlux, resolveSocBaseline, resolveCMax, 
  calculateCpsHeadroom, EMPTY_DYNAMIC_METRICS 
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
  if (normalized.startsWith('openrouter:')) return 'OpenRouter';
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

export default function AnalyticsView({ selectedNode, setSelectedNode, readings, nodes, userRole }: AnalyticsViewProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState("7d");
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [trueAiInsight, setTrueAiInsight] = useState<AiInsight | null>(null);
  const [aiHistory, setAiHistory] = useState<AiHistoryItem[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [historyDate, setHistoryDate] = useState<Date | undefined>(undefined);

  // Fallback internal nodes state if parent prop `nodes` is initially empty
  const [internalNodes, setInternalNodes] = useState<AnalyticsNode[]>([]);
  const [isLoadingNodes, setIsLoadingNodes] = useState(false);

  useEffect(() => {
    if (!nodes || nodes.length === 0) {
      setIsLoadingNodes(true);
      api.get('/nodes')
        .then(res => {
          if (Array.isArray(res.data) && res.data.length > 0) {
            setInternalNodes(res.data);
            if (!selectedNode) {
              const firstCode = res.data[0].device_code || res.data[0].id;
              if (firstCode) setSelectedNode(String(firstCode));
            }
          }
        })
        .catch(err => console.error("AnalyticsView: fallback fetch nodes failed", err))
        .finally(() => setIsLoadingNodes(false));
    }
  }, [nodes, selectedNode, setSelectedNode]);

  const effectiveNodes = useMemo(() => {
    if (nodes && nodes.length > 0) return nodes;
    return internalNodes;
  }, [nodes, internalNodes]);

  const currentNode = useMemo(() => {
    if (!effectiveNodes || effectiveNodes.length === 0) return null;
    if (!selectedNode) return effectiveNodes[0];
    const found = effectiveNodes.find(n => 
      (n.id && n.id.toString() === selectedNode.toString()) || 
      (n.device_code && n.device_code.toString() === selectedNode.toString()) ||
      (n.db_id && n.db_id.toString() === selectedNode.toString()) ||
      (n.name && n.name.toString() === selectedNode.toString())
    );
    return found || effectiveNodes[0];
  }, [selectedNode, effectiveNodes]);

  // Sync selectedNode if needed
  useEffect(() => {
    if (currentNode && !selectedNode) {
      const code = currentNode.device_code || currentNode.id;
      if (code) setSelectedNode(String(code));
    }
  }, [currentNode, selectedNode, setSelectedNode]);

  // Filter readings for current node and time range
  const nodeReadings = useMemo(() => {
    if (!currentNode) return [];
    
    let filtered = readings.filter(r => 
      r.device_id === currentNode.device_code || 
      r.device_id?.toString() === currentNode.id?.toString() ||
      r.device_id?.toString() === currentNode.db_id?.toString()
    );

    const now = new Date();
    let threshold = new Date();
    
    if (timeRange === '24h') threshold = addDays(now, -1);
    else if (timeRange === '7d') threshold = addDays(now, -7);
    else if (timeRange === '30d') threshold = addDays(now, -30);
    else return filtered;

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

    if (timeRange === '30d') {
      const weeks: Record<string, { sumCps: number; sumNee: number; sumCo2: number; sumTemp: number; count: number }> = {};
      pointData.forEach(point => {
        const r = point.reading;
        const d = new Date(r.timestamp);
        const weekNum = Math.ceil((d.getDate()) / 7);
        const key = `Minggu ${weekNum} - ${format(d, 'MMM', { locale: id })}`;
        if (!weeks[key]) weeks[key] = { sumCps: 0, sumNee: 0, sumCo2: 0, sumTemp: 0, count: 0 };
        weeks[key].sumCps += point.cps;
        weeks[key].sumNee += point.nee;
        weeks[key].sumCo2 += point.co2;
        weeks[key].sumTemp += r.environment?.air_temperature_c ?? 26.5;
        weeks[key].count += 1;
      });
      return Object.entries(weeks).map(([key, val]) => ({
        timestamp: key,
        cps: Number((val.sumCps / val.count).toFixed(3)),
        nee: Number((val.sumNee / val.count).toFixed(4)),
        co2: Number((val.sumCo2 / val.count).toFixed(1)),
        temp: Number((val.sumTemp / val.count).toFixed(1)),
      }));
    }

    if (timeRange === '7d') {
      const days: Record<string, { sumCps: number; sumNee: number; sumCo2: number; sumTemp: number; count: number }> = {};
      pointData.forEach(point => {
        const r = point.reading;
        const d = new Date(r.timestamp);
        const key = format(d, 'dd MMM', { locale: id });
        if (!days[key]) days[key] = { sumCps: 0, sumNee: 0, sumCo2: 0, sumTemp: 0, count: 0 };
        days[key].sumCps += point.cps;
        days[key].sumNee += point.nee;
        days[key].sumCo2 += point.co2;
        days[key].sumTemp += r.environment?.air_temperature_c ?? 26.5;
        days[key].count += 1;
      });
      return Object.entries(days).map(([key, val]) => ({
        timestamp: key,
        cps: Number((val.sumCps / val.count).toFixed(3)),
        nee: Number((val.sumNee / val.count).toFixed(4)),
        co2: Number((val.sumCo2 / val.count).toFixed(1)),
        temp: Number((val.sumTemp / val.count).toFixed(1)),
      }));
    }
    
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
        temp: r.environment?.air_temperature_c ?? 26.5,
      };
    });
  }, [nodeReadings, timeRange, currentNode]);

  const dynamicMetrics = useMemo<DynamicMetrics>(() => {
    if (nodeReadings.length === 0) return EMPTY_DYNAMIC_METRICS;
    const latestReading = nodeReadings[0];
    
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
    
    const avg = (values: number[], fallback: number) => {
      const valid = values.filter(v => Number.isFinite(v));
      return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : fallback;
    };

    const co2 = avg(nodeReadings.map(r => r.carbon_data?.co2_ppm ?? r.co2_ppm ?? NaN), 400);
    const latestCo2 = latestReading.carbon_data?.co2_ppm ?? latestReading.co2_ppm ?? co2;
    const lux = 0;
    const temp = avg(nodeReadings.map(r => r.environment?.air_temperature_c ?? NaN), 25);
    const moisture = 0;

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

    const photoEff = Number(Math.min(100, Math.max(0, (lux / 2000) * 100)).toFixed(0));
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
    const isEn = i18n.language === 'en';
    const l = dynamicMetrics.latest;
    if (!l) return { 
      location: isEn ? "Waiting for data..." : "Menunggu data...", 
      recommendation: isEn ? "Waiting for data..." : "Menunggu data..." 
    };

    const alt = l.location?.altitude_m ?? 0;
    const press = l.environment?.air_pressure_hpa ?? 1013;

    let locInsight = isEn
      ? `Elevation ${alt}m ASL with pressure ${press} hPa. `
      : `Elevasi ${alt}m dpl dengan tekanan ${press} hPa. `;
      
    if (alt > 800) {
      locInsight += isEn 
        ? `Cool temperature slows down respiration processes and helps maintain organic carbon stability. `
        : `Suhu sejuk memperlambat sebagian proses respirasi dan dapat menjaga kestabilan karbon organik. `;
    } else if (alt < 100) {
      locInsight += isEn 
        ? `Lowland area needs monitoring as humidity and salinity can affect soil carbon emissions. `
        : `Lahan rendah perlu dipantau karena kelembapan dan salinitas dapat memengaruhi emisi karbon tanah. `;
    }
    
    locInsight += isEn 
      ? `Microclimate supports stable CO₂ exchange, making NEE interpretation and carbon sequestration potential more reliable. `
      : `Iklim mikro mendukung pertukaran CO₂ yang stabil, sehingga interpretasi NEE dan potensi sekuestrasi karbon lebih andal. `;

    const finalRec = isEn 
      ? `Microclimatic conditions support the carbon cycle. Carbon Potential Score is at ${dynamicMetrics.cci}; land tends to be ${dynamicMetrics.carbonState}. Maintain CO₂, humidity, and temperature monitoring to preserve carbon sequestration potential.`
      : `Kondisi mikroklimat mendukung siklus karbon. Carbon Potential Score berada pada ${dynamicMetrics.cci}; lahan cenderung ${dynamicMetrics.carbonState}. Pertahankan pemantauan CO₂, kelembapan, dan suhu untuk menjaga potensi sekuestrasi karbon.`;

    return { location: locInsight, recommendation: finalRec };
  }, [dynamicMetrics, currentNode, i18n.language]);

  const generateTrueAiInsight = async () => {
    if (!currentNode) return;
    setIsAiThinking(true);

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

  // Loading spinner state while fallback node query is in-flight
  if (isLoadingNodes && effectiveNodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center space-y-4">
        <Loader2 className="w-12 h-12 text-emerald-600 animate-spin" />
        <h2 className="text-xl font-bold">{t('Memuat Data Node & Analitik...')}</h2>
      </div>
    );
  }

  // If no nodes exist in database at all
  if (effectiveNodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center space-y-5 bg-card rounded-3xl border-2 border-dashed border-border/80 max-w-2xl mx-auto my-12 shadow-sm">
        <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-600 border border-amber-500/20 shadow-xs">
          <AlertTriangle size={32} />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-foreground">{t('Perangkat Belum Terdaftar')}</h2>
          <p className="text-xs font-semibold text-muted-foreground max-w-md mx-auto leading-relaxed">
            {t('Sistem tidak mendeteksi adanya Node IoT. Silakan masuk ke menu Manajemen Perangkat untuk mendaftarkan node Anda agar analitik dapat berjalan.')}
          </p>
        </div>
        <Button 
          onClick={() => navigate('/nodes')} 
          className="h-11 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md shadow-emerald-600/20 cursor-pointer gap-2"
        >
          <Plus size={16} />
          {t('Daftarkan Perangkat Baru')}
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 max-w-5xl mx-auto pb-24 select-none block">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border/60">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-xs shrink-0">
            <Leaf size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-foreground">
              {t('Karbon dan Tanaman')}
            </h1>
            <p className="text-xs font-semibold text-muted-foreground mt-0.5">
              {t('Korelasi data sensor dengan kondisi lingkungan spesifik lokasi')}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto shrink-0">
          {/* Node Selector */}
          <div className="w-full sm:w-[260px]">
            <Select value={String(currentNode?.device_code || currentNode?.id || selectedNode)} onValueChange={(v) => setSelectedNode(v || '')}>
              <SelectTrigger className="h-11 w-full rounded-2xl bg-card border-border/80 font-extrabold text-xs shadow-sm">
                <SelectValue placeholder={t('Pilih Node')} />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-border shadow-xl">
                {effectiveNodes.map(node => (
                  <SelectItem key={node.id} value={String(node.device_code || node.id)} className="text-xs font-bold uppercase cursor-pointer">
                    {node.name || node.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Time Range Selector */}
          <div className="w-full sm:w-[170px]">
            <Select value={timeRange} onValueChange={(v) => setTimeRange(v || '7d')}>
              <SelectTrigger className="h-11 w-full rounded-2xl bg-card border-border/80 font-extrabold text-xs shadow-sm">
                <SelectValue placeholder={t('Rentang Waktu')} />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-border shadow-xl">
                <SelectItem value="24h" className="text-xs font-bold cursor-pointer">{t('24 Jam Terakhir')}</SelectItem>
                <SelectItem value="7d" className="text-xs font-bold cursor-pointer">{t('7 Hari Terakhir')}</SelectItem>
                <SelectItem value="30d" className="text-xs font-bold cursor-pointer">{t('30 Hari Terakhir')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Hero Location Context Card */}
      <Card className="border-none shadow-xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white rounded-3xl overflow-hidden relative w-full">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 rounded-full bg-white/10 blur-2xl pointer-events-none"></div>
        <CardHeader className="bg-white/10 border-b border-white/15 p-6 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/15 border border-white/20">
              <MapIcon size={20} className="text-white" />
            </div>
            <div>
              <CardTitle className="text-xs font-black uppercase tracking-wider text-emerald-100">{t('Konteks Lokasi Node')}</CardTitle>
              <p className="text-sm font-bold text-white mt-0.5">{currentNode?.name || currentNode?.id || "AGNODE"}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/15">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-100 mb-1">{t('Lokasi Lahan')}</p>
              <p className="text-base font-bold text-white">{currentNode?.plot_name || "Lahan Utama"}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/15">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-100 mb-1">{t('Komoditi')}</p>
              <p className="text-base font-bold text-white">{currentNode?.plant_name || "Tanaman Pangan"}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/15">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-100 mb-1">{t('Ketinggian')}</p>
              <p className="text-base font-bold text-white">{dynamicMetrics.latest?.location?.altitude_m ?? 720} m dpl</p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white/15 backdrop-blur-md p-3.5 rounded-2xl border border-white/20 text-xs">
            <MapPin size={16} className="text-emerald-300 shrink-0" />
            <p className="font-medium text-white/90">
              {(() => {
                const addr = currentNode?.address || "Alamat lokasi belum terdaftar";
                return addr.split(',').filter(p => !['jawa', 'indonesia'].includes(p.trim().toLowerCase())).join(', ');
              })()}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Balanced 2x2 Analytical Chart Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
        {/* Chart 1: CO2 Concentration Trend */}
        <Card className="bg-card border-border/80 shadow-md rounded-3xl overflow-hidden w-full">
          <CardHeader className="bg-muted/30 border-b border-border/60 p-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="p-3 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 shrink-0 border border-teal-500/20 shadow-xs">
                  <CloudSun size={22} />
                </div>
                <div>
                  <CardTitle className="text-base font-black text-foreground">{t('Grafik Tren Emisi CO₂ dan Suhu Udara')}</CardTitle>
                  <CardDescription className="text-xs font-semibold text-muted-foreground mt-0.5">
                    {t('Fluktuasi emisi gas rumah kaca dan iklim mikro perkebunan')} — {currentNode?.name || 'Node'}
                  </CardDescription>
                </div>
              </div>

              <Popover>
                <PopoverTrigger className="p-2 rounded-2xl bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                  <Info size={16} />
                </PopoverTrigger>
                <PopoverContent className="w-72 text-xs p-4 rounded-2xl shadow-xl border-border" align="end">
                  <p className="font-bold mb-1 text-sm">{t('Grafik Tren Emisi CO₂ dan Suhu Udara')}</p>
                  <p className="text-muted-foreground text-xs leading-relaxed">{t('Menampilkan sinyal emisi CO₂ mentah dari sensor serta suhu udara secara real-time. Kenaikan tajam menunjukkan akumulasi emisi atau aktivitas respirasi ekosistem.')}</p>
                </PopoverContent>
              </Popover>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <ResponsiveContainer width="100%" height={250}>
              <ComposedChart data={cciTrendData} margin={{ top: 10, right: 10, left: -5, bottom: 10 }}>
                <defs>
                  <linearGradient id="colorCo2Trend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0f766e" stopOpacity={0.28}/>
                    <stop offset="95%" stopColor="#0f766e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="timestamp" tick={{ fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="co2" type="number" domain={['auto', 'auto']} tick={{ fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="temp" orientation="right" type="number" domain={['auto', 'auto']} tick={{ fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
                <Tooltip 
                  cursor={{ fill: 'rgba(15, 118, 110, 0.08)', radius: 8 }}
                  wrapperStyle={{ opacity: 1, zIndex: 1000 }}
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: '1px solid #cbd5e1', 
                    backgroundColor: '#ffffff', 
                    color: '#0f172a',
                    fontWeight: 700,
                    opacity: 1,
                    boxShadow: '0 20px 40px -15px rgba(0,0,0,0.3)',
                    padding: '10px 14px'
                  }} 
                  labelStyle={{ fontWeight: '800', fontSize: '12px', color: '#059669', marginBottom: '4px' }}
                  itemStyle={{ fontWeight: '800', fontSize: '12px', color: '#0f172a' }}
                />
                <Area yAxisId="co2" type="monotone" dataKey="co2" name="Emisi CO2 (ppm)" stroke="#0f766e" fillOpacity={1} fill="url(#colorCo2Trend)" strokeWidth={2.5} />
                <Line yAxisId="temp" type="monotone" dataKey="temp" name="Suhu Udara (°C)" stroke="#ef4444" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Chart 2: CPS Trend */}
        <Card className="bg-card border-border/80 shadow-md rounded-3xl overflow-hidden w-full">
          <CardHeader className="bg-muted/30 border-b border-border/60 p-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0 border border-emerald-500/20 shadow-xs">
                  <TrendingUp size={22} />
                </div>
                <div>
                  <CardTitle className="text-base font-black text-foreground">{t('Tren Potensi Karbon (CPS)')}</CardTitle>
                  <CardDescription className="text-xs font-semibold text-muted-foreground mt-0.5">
                    {t('Fluktuasi CPS')} {timeRange === '24h' ? t('24 jam') : timeRange === '7d' ? t('7 hari') : t('30 hari')} — {currentNode?.name || 'Node'}
                  </CardDescription>
                </div>
              </div>

              <Popover>
                <PopoverTrigger className="p-2 rounded-2xl bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                  <Info size={16} />
                </PopoverTrigger>
                <PopoverContent className="w-72 text-xs p-4 rounded-2xl shadow-xl border-border" align="end">
                  <p className="font-bold mb-1 text-sm">{t('Tren Potensi Karbon (CPS)')}</p>
                  <p className="text-muted-foreground text-xs leading-relaxed">{t('Menampilkan fluktuasi Carbon Potential Score sebagai indeks internal untuk membaca potensi lahan menyerap, menyimpan, atau melepas karbon.')}</p>
                </PopoverContent>
              </Popover>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={cciTrendData} margin={{ top: 10, right: 10, left: -5, bottom: 10 }}>
                <defs>
                  <linearGradient id="colorCci" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="timestamp" tick={{ fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} />
                <YAxis type="number" domain={['auto', 'auto']} tick={{ fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
                <Tooltip 
                  cursor={{ fill: 'rgba(16, 185, 129, 0.08)', radius: 8 }}
                  contentStyle={{ borderRadius: 16, border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--card))', fontWeight: 700 }} 
                />
                <Area type="monotone" dataKey="cps" name="CPS Index" stroke="#10b981" fillOpacity={1} fill="url(#colorCci)" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Chart 3: Carbon Flux NEE */}
        <Card className="bg-card border-border/80 shadow-md rounded-3xl overflow-hidden w-full">
          <CardHeader className="bg-muted/30 border-b border-border/60 p-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0 border border-indigo-500/20 shadow-xs">
                  <Activity size={22} />
                </div>
                <div>
                  <CardTitle className="text-base font-black text-foreground">{t('Laju Pertukaran Karbon (Carbon Flux / NEE)')}</CardTitle>
                  <CardDescription className="text-xs font-semibold text-muted-foreground mt-0.5">
                    {t('Fluktuasi pertukaran bersih karbon')} — {currentNode?.name || 'Node'}
                  </CardDescription>
                </div>
              </div>

              <Popover>
                <PopoverTrigger className="p-2 rounded-2xl bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                  <Info size={16} />
                </PopoverTrigger>
                <PopoverContent className="w-72 text-xs p-4 rounded-2xl shadow-xl border-border" align="end">
                  <p className="font-bold mb-1 text-sm">Carbon Flux (NEE)</p>
                  <p className="text-muted-foreground text-xs leading-relaxed">{t('Menampilkan tren pertukaran karbon bersih (Net Ecosystem Exchange). Nilai positif menunjukkan potensi penyerapan karbon.')}</p>
                </PopoverContent>
              </Popover>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={cciTrendData} margin={{ top: 10, right: 10, left: -5, bottom: 10 }}>
                <defs>
                  <linearGradient id="colorNee" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="timestamp" tick={{ fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} />
                <YAxis type="number" domain={['auto', 'auto']} tick={{ fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
                <Tooltip 
                  cursor={{ fill: 'rgba(99, 102, 241, 0.08)', radius: 8 }}
                  contentStyle={{ borderRadius: 16, border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--card))', fontWeight: 700 }} 
                />
                <Area type="monotone" dataKey="nee" name="Carbon Flux (NEE)" stroke="#6366f1" fillOpacity={1} fill="url(#colorNee)" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Chart 4: Environmental Stress Analysis */}
        <Card className="bg-card border-border/80 shadow-md rounded-3xl overflow-hidden w-full">
          <CardHeader className="bg-muted/30 border-b border-border/60 p-6 py-5">
            <div className="flex items-center gap-3.5">
              <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0 border border-amber-500/20 shadow-xs">
                <LineChartIcon size={22} />
              </div>
              <div>
                <CardTitle className="text-base font-black text-foreground">{t('Analisis Stres Lingkungan')}</CardTitle>
                <CardDescription className="text-xs font-semibold text-muted-foreground mt-0.5">
                  {t('Hubungan antara suhu udara, kelembapan, dan penguapan tanah')}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -5, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="displayLabel" tick={{ fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 16, border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--card))', fontWeight: 700 }} />
                <Line type="monotone" dataKey="environment.air_temperature_c" name="Suhu Udara (°C)" stroke="#ef4444" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="environment.air_humidity_percent" name="Kelembapan Udara (%)" stroke="#10b981" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Section: Balanced Split (2 Cols AI / 1 Col CPS Gauge) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
        {/* AgriSense True AI Section (Spans 2 Columns) */}
        <Card className="lg:col-span-2 bg-gradient-to-br from-emerald-500/5 via-teal-500/5 to-emerald-500/10 border border-emerald-500/20 shadow-md rounded-3xl overflow-hidden w-full">
          <CardHeader className="bg-muted/30 border-b border-border/60 p-6 py-5 flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-xs">
                <Sparkles size={22} className={isAiThinking ? "animate-pulse" : ""} />
              </div>
              <div>
                <CardTitle className="text-base font-black text-foreground">{t('AgriSense True AI')}</CardTitle>
                <CardDescription className="text-xs font-semibold text-muted-foreground mt-0.5">{t('Analisis kecerdasan buatan berbasis data sensor mikroklimat')}</CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => {
                  setIsHistoryOpen(true);
                  fetchAiHistory();
                }}
                className="h-9 px-3 rounded-xl text-xs font-bold bg-card border-border hover:bg-muted cursor-pointer"
              >
                <History className="mr-1.5 h-3.5 w-3.5 text-primary" /> {t('Riwayat')}
              </Button>
              <Button 
                size="sm" 
                onClick={generateTrueAiInsight} 
                disabled={isAiThinking}
                className="h-9 px-4 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm cursor-pointer"
              >
                {isAiThinking ? (
                  <><Activity className="mr-1.5 h-3.5 w-3.5 animate-spin" /> {t('AI Memproses...')}</>
                ) : `✨ ${t('Minta Analisis AI')}`}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {!trueAiInsight && !isAiThinking && (
              <div className="text-center py-8 space-y-3">
                <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto text-emerald-600 border border-emerald-500/20">
                  <Sparkles size={28} />
                </div>
                <p className="text-xs font-bold text-muted-foreground max-w-sm mx-auto">
                  Klik tombol <b>Minta Analisis AI</b> untuk memroses telemetri sensor dengan kecerdasan buatan AgriSense.
                </p>
              </div>
            )}

            {isAiThinking && (
              <div className="py-8 text-center space-y-3">
                <Activity size={32} className="mx-auto text-emerald-600 animate-spin" />
                <p className="text-xs font-bold text-muted-foreground animate-pulse">Mengolah pola karbon dan respirasi tanaman...</p>
              </div>
            )}

            {trueAiInsight && !isAiThinking && (
              <div className="space-y-4">
                <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-xs space-y-2">
                  <p className="font-extrabold text-xs text-primary flex items-center gap-1.5">
                    <Sparkles size={16} /> {t('Analisis AI')}
                  </p>
                  <p className="text-xs font-medium leading-relaxed text-foreground whitespace-pre-line">{trueAiInsight.analisis}</p>
                </div>

                <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 shadow-xs space-y-2">
                  <p className="font-extrabold text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                    <Leaf size={16} /> {t('Rekomendasi')}
                  </p>
                  <p className="text-xs font-medium leading-relaxed text-foreground whitespace-pre-line">{trueAiInsight.rekomendasi}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* CPS Gauge Card (Spans 1 Column) */}
        <Card className="lg:col-span-1 bg-card border-border/80 shadow-md rounded-3xl overflow-hidden w-full">
          <CardHeader className="bg-muted/30 border-b border-border/60 p-6 py-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0 border border-emerald-500/20">
                <Gauge size={20} />
              </div>
              <CardTitle className="text-sm font-black text-foreground">{t('Carbon Potential Score (CPS)')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-5 text-center">
            <div>
              <div className="text-4xl font-black text-emerald-600 dark:text-emerald-400">
                {(dynamicMetrics.cciRaw * 100).toFixed(1)}%
              </div>
              <p className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider mt-1">
                CPS Index = {dynamicMetrics.cci}
              </p>
              <div className="mt-2 inline-block">
                <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-extrabold text-xs px-3 py-0.5 rounded-full border-none">
                  {dynamicMetrics.cciStatus}
                </Badge>
              </div>
            </div>

            {/* CPS Breakdown */}
            <div className="space-y-3 pt-3 border-t border-border/60 text-left">
              {dynamicMetrics.cciBd.map((item, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-muted-foreground">{item.l}</span>
                    <span className="text-foreground">{item.r} {item.u}</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${Math.max(4, item.s * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI History Dialog */}
      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[85vh] rounded-[28px] border border-border/80 shadow-2xl p-6 sm:p-7 bg-card flex flex-col gap-0 overflow-hidden">
          <DialogHeader className="flex flex-row items-start gap-4 pb-5 mb-5 border-b border-border/60 space-y-0 text-left shrink-0">
            <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0 shadow-xs">
              <History size={22} />
            </div>
            <div className="flex flex-col gap-1 pr-6">
              <DialogTitle className="text-xl font-black tracking-tight text-foreground leading-snug">
                {t('Riwayat Analisis AI')}
              </DialogTitle>
              <DialogDescription className="text-xs font-semibold text-muted-foreground leading-relaxed">
                {t('Daftar analisis cerdas yang pernah dihasilkan untuk node ini.')}
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-3 py-1 pr-1">
            {isHistoryLoading ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-3">
                <Activity className="animate-spin text-emerald-600" size={32} />
                <p className="text-xs font-bold text-muted-foreground">{t('Mengambil riwayat...')}</p>
              </div>
            ) : aiHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-3 opacity-60">
                <Clock size={40} className="text-muted-foreground" />
                <p className="text-xs font-bold text-center">{t('Belum ada riwayat analisis untuk node ini.')}</p>
              </div>
            ) : (
              aiHistory.map((item) => (
                <div key={item.id} className="p-4 rounded-2xl bg-muted/20 border border-border/80 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge className="bg-emerald-500/10 text-emerald-600 font-extrabold text-[10px] uppercase border-none">
                      {item.time_range}
                    </Badge>
                    <span className="text-[11px] font-bold text-muted-foreground">
                      {format(new Date(item.created_at), "d MMMM yyyy, HH:mm", { locale: id })} WIB
                    </span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-foreground">{item.analysis_text}</p>
                    <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20">
                      {item.recommendation_json}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          <DialogFooter className="mt-6 pt-5 border-t border-border/60 flex flex-row items-center justify-end gap-3 shrink-0">
            <Button 
              variant="outline" 
              onClick={() => setIsHistoryOpen(false)} 
              className="h-11 px-6 rounded-2xl border-border/80 font-extrabold text-xs bg-muted/30 hover:bg-muted transition-all cursor-pointer"
            >
              {t('Tutup')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
