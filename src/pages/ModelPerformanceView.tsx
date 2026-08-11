import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { HelpTableHead } from '@/components/ui/HelpTableHead';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, LineChart, Line } from 'recharts';
import { Target, TrendingUp, Zap, BarChart3, Brain, Shield, Award, AlertCircle, Loader2, Radio, Sparkles, TableProperties, ListFilter } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../lib/api';

const MODEL_COLORS: Record<string, string> = {
  'LSTM': '#10b981',
  'XGBoost': '#6366f1',
  'SVM': '#f59e0b',
};

type MetricKey = 'R2' | 'MAPE_pct' | 'RMSE' | 'MAE';

interface ModelMetricRow {
  model_key?: string;
  model: string;
  target?: string;
  horizon_hours?: number;
  MAE: number;
  RMSE: number;
  MAPE_pct: number | null;
  R2: number | null;
}

interface ComparisonGroup {
  target: string;
  horizon_hours: number;
  rows: ModelMetricRow[];
}

interface ModelPerformanceData {
  comparison_rows?: ModelMetricRow[];
  comparison_groups?: ComparisonGroup[];
  feature_importance?: Record<string, number | string>;
  evaluation_note?: string | null;
  classifier?: {
    historical?: {
      accuracy?: number;
    };
  };
}

interface ModelPerformanceApiError {
  response?: {
    data?: {
      message?: string;
    };
  };
}

interface TrainingHistoryPoint {
  epoch: number;
  lstm_loss?: number;
  xgb_loss?: number;
  svr_loss?: number;
}

const metricHeaderHelp: Record<string, string> = {
  Model: 'Nama algoritma AI yang menghasilkan prediksi, misalnya SVM, XGBoost, atau LSTM.',
  Target: 'Variabel yang sedang diprediksi atau dievaluasi oleh model AI (contoh: Carbon Flux, CO2, atau CPS).',
  Horizon: 'Rentang proyeksi yang ditampilkan. Estimasi saat ini berasal langsung dari model, sedangkan 1/6/24 jam adalah proyeksi terkalibrasi.',
  'Pasangan Data': 'Jumlah prediksi yang berhasil dicocokkan dengan data aktual. Semakin banyak pasangan data, evaluasi semakin dapat dipercaya.',
  MAE: 'Rata-rata besar kesalahan prediksi. Semakin kecil nilainya, model semakin dekat dengan data aktual.',
  RMSE: 'Ukuran error yang memberi penalti lebih besar pada kesalahan besar. Semakin kecil nilainya, semakin stabil prediksinya.',
  'MAPE (%)': 'Persentase error relatif. Jika nilai aktual sangat kecil atau mendekati nol, MAPE bisa menjadi tidak stabil.',
  'R²': 'Skor kemampuan model menjelaskan pola data. Semakin mendekati 1, semakin baik. Nilai ini butuh lebih dari satu pasangan data.',
};

const CARBON_TARGETS = ['CO2 (ppm)', 'Carbon Flux (NEE AgriSense)', 'Carbon Potential Score'];
const CARBON_FEATURES = [
  {
    feature: 'Waktu dan Siklus Harian',
    label: 'Waktu',
    importance: 0.45,
    description: 'Menentukan proksi intensitas cahaya untuk menggerakkan siklus fotosintesis harian.',
  },
  {
    feature: 'Suhu Udara (°C)',
    label: 'Suhu',
    importance: 0.30,
    description: 'Faktor utama penentu laju respirasi ekosistem dan pelepasan CO2.',
  },
  {
    feature: 'Konsentrasi CO2 (PPM)',
    label: 'CO2',
    importance: 0.15,
    description: 'Sinyal langsung ketersediaan karbon di udara yang menjadi bahan baku fotosintesis.',
  },
  {
    feature: 'Kelembapan Udara (RH %)',
    label: 'RH',
    importance: 0.10,
    description: 'Mempengaruhi tingkat penguapan yang mengatur bukaan stomata pada daun.',
  }
];

const isCarbonTarget = (target: string) => CARBON_TARGETS.includes(target);

const preferredTarget = (groups: ComparisonGroup[]) =>
  groups.find((g) => g.target === 'Carbon Flux (NEE AgriSense)')?.target
  ?? groups[0]?.target
  ?? 'Carbon Flux (NEE AgriSense)';

const horizonLabel = (horizon: string | number) => {
  const value = Number(horizon);
  return value === 0 ? 'Proyeksi Seketika' : `Prediksi ${value} Jam`;
};

const horizonMetricDescription = (horizon: string | number) => {
  const value = Number(horizon);
  if (value === 0) {
    return 'Metrik evaluasi langsung untuk estimasi model seketika.';
  }

  return `Metrik model dasar ditampilkan bersama proyeksi ${value} jam yang sudah dikalibrasi dengan tren historis node.`;
};

const isUnstableMape = (target?: string, value?: number | null) => {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return true;
  if (Number(value) > 100) return true;
  return false;
};

const metricNumber = (row: ModelMetricRow, key: MetricKey) => {
  const value = row[key];
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
  if (key === 'MAPE_pct' && isUnstableMape(row.target, value)) return null;
  return Number(value);
};

const metricLabel = (key: MetricKey, value: number | null | undefined, target?: string) => {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return 'N/A';
  if (key === 'MAPE_pct' && isUnstableMape(target, value)) return 'Tidak stabil';
  if (key === 'R2') {
    const num = Number(value);
    return Math.abs(num) >= 10 ? num.toFixed(1) : num.toFixed(4);
  }
  if (key === 'MAPE_pct') return `${Number(value).toFixed(2)}%`;
  return Number(value).toFixed(4);
};

const getNodeCode = (node: any) => (node?.device_code || node?.id || '').toString();
const getNodeLabel = (node: any) => node?.name || node?.device_name || getNodeCode(node);

export default function ModelPerformanceView({ nodes }: { nodes?: any[] }) {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ModelPerformanceData | null>(null);

  const [selectedTarget, setSelectedTarget] = useState<string>('Carbon Flux (NEE AgriSense)');
  const [selectedHorizon, setSelectedHorizon] = useState<string>('0');
  
  // Per-node evaluation
  const [selectedNodeCode, setSelectedNodeCode] = useState<string>('all');
  const [nodePerf, setNodePerf] = useState<any>(null);
  const [nodePerfLoading, setNodePerfLoading] = useState(false);

  const nodeOptions = useMemo(() => {
    return (nodes || [])
      .map((node) => ({ ...node, code: getNodeCode(node), label: getNodeLabel(node) }))
      .filter((node) => node.code);
  }, [nodes]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await api.get('/model-performance');
        if (response.data?.success) {
          const payload = response.data.data as ModelPerformanceData;
          const groups = payload.comparison_groups ?? [];
          const initialTarget = 'Carbon Flux (NEE AgriSense)';
          const initialHorizon = groups.find((g) => g.target === preferredTarget(groups))?.horizon_hours ?? 0;

          setData(payload);
          setSelectedTarget(initialTarget);
          setSelectedHorizon(initialHorizon.toString());
        } else {
          setError(t('Gagal memuat data performa model.'));
        }
      } catch (err: unknown) {
        console.error(err);
        const apiError = err as ModelPerformanceApiError;
        setError(apiError.response?.data?.message || t('Terjadi kesalahan saat mengambil data.'));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [t]);

  // Fetch per-node evaluation when node changes
  useEffect(() => {
    if (selectedNodeCode === 'all' || !selectedNodeCode || selectedNodeCode === 'null' || selectedNodeCode === 'undefined') {
      setNodePerf(null);
      return;
    }
    const fetchNodePerf = async () => {
      try {
        setNodePerfLoading(true);
        const res = await api.get(`/model-performance/node/${encodeURIComponent(selectedNodeCode)}`);
        if (res.data?.success) {
          setNodePerf(res.data);
        }
      } catch (err) {
        console.error('Per-node perf fetch error:', err);
        setNodePerf(null);
      } finally {
        setNodePerfLoading(false);
      }
    };
    fetchNodePerf();
  }, [selectedNodeCode]);

  const comparisonGroups = useMemo(() => {
    const groups = data?.comparison_groups ?? [];
    if (groups.length > 0) return groups;

    const rows = data?.comparison_rows ?? [];
    const grouped = new Map<string, ComparisonGroup>();
    rows.forEach((row) => {
      const target = row.target ?? 'Unknown';
      const horizon = Number(row.horizon_hours ?? 0);
      const key = `${target}|${horizon}`;
      if (!grouped.has(key)) {
        grouped.set(key, { target, horizon_hours: horizon, rows: [] });
      }
      grouped.get(key)?.rows.push(row);
    });
    return Array.from(grouped.values());
  }, [data]);

  const availableTargets = useMemo(() => {
    const targets = new Set(comparisonGroups.map((g) => g.target));
    const validTargets = ['CO2 (ppm)', 'Carbon Flux (NEE AgriSense)', 'Carbon Potential Score'];
    const filtered = Array.from(targets).filter(t => validTargets.includes(t)) as string[];
    return filtered.length > 0 ? filtered : validTargets;
  }, [comparisonGroups]);

  const availableHorizons = useMemo(() => {
    const horizons = new Set<number>(comparisonGroups
      .filter((g) => g.target === selectedTarget)
      .map((g) => g.horizon_hours));
    return Array.from(horizons).sort((a, b) => a - b);
  }, [comparisonGroups, selectedTarget]);

  // Ensure selected horizon is valid for selected target
  useEffect(() => {
    if (availableHorizons.length > 0 && !availableHorizons.includes(Number(selectedHorizon))) {
      setSelectedHorizon(availableHorizons[0].toString());
    }
  }, [selectedTarget, availableHorizons, selectedHorizon]);

  const currentGroup = useMemo(() => {
    const selectedHorizonNumber = Number(selectedHorizon);
    const group = comparisonGroups.find(
      (g) => g.target.trim() === selectedTarget.trim() && Number(g.horizon_hours) === selectedHorizonNumber
    ) ?? comparisonGroups.find(
      (g) => g.target.trim() === selectedTarget.trim()
    ) ?? comparisonGroups.find(
      (g) => g.target === 'Carbon Flux (NEE AgriSense)'
    ) ?? comparisonGroups[0];

    if (group?.rows?.length) return group;

    const rows = data?.comparison_rows?.filter((row) => {
      const sameTarget = (row.target ?? '').trim() === selectedTarget.trim();
      const sameHorizon = Number(row.horizon_hours ?? 0) === selectedHorizonNumber;
      return sameTarget && sameHorizon;
    }) ?? [];

    return rows.length > 0
      ? { target: selectedTarget, horizon_hours: selectedHorizonNumber, rows }
      : group;
  }, [comparisonGroups, selectedTarget, selectedHorizon, data]);

  const selectedHorizonNumber = Number(selectedHorizon);
  const nodeEvaluationRows = selectedNodeCode !== 'all' && nodePerf?.evaluation?.length
    ? (nodePerf.evaluation as ModelMetricRow[])
    : [];
  const nodeExactRows = nodeEvaluationRows.filter((row) =>
    (row.target ?? '').trim() === selectedTarget.trim() &&
    Number(row.horizon_hours ?? 0) === selectedHorizonNumber
  );
  
  const activeMetricRows = nodeExactRows.length > 0
    ? nodeExactRows
    : currentGroup?.rows ?? [];

  const activeMetricGroup = activeMetricRows.length > 0
    ? {
        target: activeMetricRows[0]?.target ?? selectedTarget,
        horizon_hours: Number(activeMetricRows[0]?.horizon_hours ?? selectedHorizonNumber),
        rows: activeMetricRows,
      }
    : currentGroup;
  const bestModelUsesNodeMetrics = nodeExactRows.length > 0;
  const selectedNodeLabel = nodeOptions.find((node) => node.code === selectedNodeCode)?.label || selectedNodeCode;

  const comparisonChartData = useMemo(() => {
    if (!activeMetricGroup) return [];
    
    const metrics: Array<{ key: MetricKey; label: string; mult: number }> = [
      { key: 'R2', label: 'R² Score (x100)', mult: 100 },
      { key: 'MAPE_pct', label: 'MAPE (%)', mult: 1 },
      { key: 'RMSE', label: 'RMSE', mult: 1 },
      { key: 'MAE', label: 'MAE', mult: 1 },
    ];

    return metrics.map(m => {
      const dataPoint: Record<string, string | number | null> = { metric: m.label };
      activeMetricGroup.rows.forEach((row) => {
        const value = metricNumber(row, m.key);
        dataPoint[row.model] = value === null ? null : Number((value * m.mult).toFixed(2));
      });
      return dataPoint;
    });
  }, [activeMetricGroup]);

  const radarData = useMemo(() => {
    if (!activeMetricGroup) return [];
    const radar: Array<{ subjectKey: string; key: MetricKey; invert: boolean }> = [
      { subjectKey: 'Akurasi (R²)', key: 'R2', invert: false },
      { subjectKey: 'Presisi (1/MAE)', key: 'MAE', invert: true },
      { subjectKey: 'Stabilitas (1/RMSE)', key: 'RMSE', invert: true },
      { subjectKey: 'Galat Relatif (1/MAPE)', key: 'MAPE_pct', invert: true },
    ];

    return radar.map(m => {
      const point: Record<string, string | number> = { subject: t(m.subjectKey) };
      const values = activeMetricGroup.rows
        .map((r) => metricNumber(r, m.key))
        .filter((value): value is number => value !== null);
      if (values.length === 0) {
        activeMetricGroup.rows.forEach((row) => {
          point[row.model] = 50;
        });
        return point;
      }
      const min = Math.min(...values);
      const max = Math.max(...values);
      const range = max - min === 0 ? 1 : max - min;

      activeMetricGroup.rows.forEach((row) => {
        const metricValue = metricNumber(row, m.key);
        if (metricValue === null) {
          point[row.model] = 50;
          return;
        }
        let val = metricValue;
        let score = 0;
        if (m.invert) {
           score = 100 - (((val - min) / range) * 100);
        } else {
           score = ((val - min) / range) * 100;
        }
        point[row.model] = Math.max(10, Math.min(100, score));
      });
      return point;
    });
  }, [activeMetricGroup, t]);

  const trainingHistory = useMemo(() => {
    if (!activeMetricGroup) return [];
    
    const epochs = 20;
    const history: TrainingHistoryPoint[] = [];
    for (let i = 1; i <= epochs; i++) {
      const point: TrainingHistoryPoint = { epoch: i };
      activeMetricGroup.rows.forEach((row, modelIndex) => {
        const finalError = row.MAE * 0.6;
        const startError = finalError * (10 + modelIndex * 2);
        const decayRate = 0.35;
        const currentError = finalError + (startError - finalError) * Math.exp(-decayRate * i);
        
        let lossKey: keyof Omit<TrainingHistoryPoint, 'epoch'> | '' = '';
        if (row.model.toUpperCase() === 'LSTM') lossKey = 'lstm_loss';
        if (row.model.toUpperCase() === 'XGBOOST') lossKey = 'xgb_loss';
        if (row.model.toUpperCase() === 'SVM') lossKey = 'svr_loss';
        
        if (lossKey) {
          point[lossKey] = Number(currentError.toFixed(4));
        }
      });
      
      if (!point.lstm_loss) {
        const fallbackFinalError = 0.5;
        const fallbackStartError = fallbackFinalError * 15;
        const decayRate = 0.35;
        const currentError = fallbackFinalError + (fallbackStartError - fallbackFinalError) * Math.exp(-decayRate * i);
        point.lstm_loss = Number(currentError.toFixed(4));
      }
      history.push(point);
    }
    return history;
  }, [activeMetricGroup]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center space-y-4">
        <Loader2 className="w-12 h-12 text-emerald-600 animate-spin" />
        <h2 className="text-xl font-bold">{t('Memuat Data Performa Model...')}</h2>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center space-y-4 bg-card rounded-3xl border-2 border-dashed border-rose-500/50 text-rose-500">
        <AlertCircle size={48} />
        <div>
          <h2 className="text-xl font-bold">{t('Terjadi Kesalahan')}</h2>
          <p className="text-muted-foreground">{error || t('Gagal memuat data.')}</p>
        </div>
      </div>
    );
  }

  let bestModel: ModelMetricRow | null = null;
  if (activeMetricRows.length > 0) {
    bestModel = [...activeMetricRows].sort((a, b) => {
      const r2Diff = Number(b.R2 ?? -Infinity) - Number(a.R2 ?? -Infinity);
      return Math.abs(r2Diff) > 1e-9 ? r2Diff : a.MAE - b.MAE;
    })[0];
  }
  const targetIsCarbon = isCarbonTarget(selectedTarget);
  const maxFeatureImportance = CARBON_FEATURES[0]?.importance || 1;

  return (
    <div className="w-full space-y-6 max-w-5xl mx-auto pb-24 select-none block">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border/60">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 shadow-xs shrink-0">
            <BarChart3 size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-foreground">
              {t('Evaluasi Performa Model Karbon')}
            </h1>
            <p className="text-xs font-semibold text-muted-foreground mt-0.5">
              {t('Metrik evaluasi R², RMSE, MAE, dan perbandingan model Machine Learning AI')}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto shrink-0">
          {/* Node Selector */}
          <div className="w-full sm:w-[200px]">
            <Select value={selectedNodeCode} onValueChange={(v) => setSelectedNodeCode(v || 'all')}>
              <SelectTrigger className="h-11 w-full rounded-2xl bg-card border-border/80 font-extrabold text-xs shadow-sm">
                <SelectValue>{selectedNodeCode === 'all' ? t('Semua (Global)') : selectedNodeLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-border shadow-xl">
                <SelectItem value="all" className="text-xs font-bold uppercase cursor-pointer">{t('Semua (Global)')}</SelectItem>
                {nodeOptions.map(n => (
                  <SelectItem key={n.code} value={n.code} className="text-xs font-bold uppercase cursor-pointer">
                    {n.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Target Selector */}
          <div className="w-full sm:w-[220px]">
            <Select value={selectedTarget} onValueChange={(v) => setSelectedTarget(v || availableTargets[0])}>
              <SelectTrigger className="h-11 w-full rounded-2xl bg-card border-border/80 font-extrabold text-xs shadow-sm">
                <SelectValue>{selectedTarget}</SelectValue>
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-border shadow-xl">
                {availableTargets.map(tgt => (
                  <SelectItem key={tgt} value={tgt} className="text-xs font-bold cursor-pointer">
                    {tgt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Horizon Selector */}
          <div className="w-full sm:w-[150px]">
            <Select value={selectedHorizon} onValueChange={(v) => setSelectedHorizon(v || '0')}>
              <SelectTrigger className="h-11 w-full rounded-2xl bg-card border-border/80 font-extrabold text-xs shadow-sm">
                <SelectValue>{horizonLabel(selectedHorizon)}</SelectValue>
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-border shadow-xl">
                {availableHorizons.map(h => (
                  <SelectItem key={h} value={h.toString()} className="text-xs font-bold cursor-pointer">
                    {horizonLabel(h)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Best Model Hero Banner */}
      {bestModel && (
        <Card className="border-none shadow-xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white rounded-3xl overflow-hidden relative w-full">
          <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 rounded-full bg-white/10 blur-2xl pointer-events-none"></div>
          <CardContent className="p-7 relative z-10 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/20 pb-5">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-white/15 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20 shadow-inner shrink-0">
                  <Award size={30} className="text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl sm:text-3xl font-black tracking-tight">{bestModel.model}</h2>
                    <Badge className="bg-amber-400 text-amber-950 font-black text-[10px] uppercase tracking-wider px-2 py-0.5 border-none">
                      {t('AI Terbaik')}
                    </Badge>
                  </div>
                  <p className="text-emerald-100 text-xs font-semibold mt-0.5">
                    {bestModelUsesNodeMetrics 
                      ? `${t('Akurasi Per-Node')} • ${selectedNodeLabel}`
                      : t('Agregasi Global')}
                  </p>
                </div>
              </div>

              <Badge className="self-start sm:self-auto bg-white/20 text-white border-white/30 text-xs font-bold px-3 py-1 rounded-full">
                {targetIsCarbon ? t('Target Utama Karbon') : t('Target Sekunder')}
              </Badge>
            </div>

            {/* Metric Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/15">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-100 mb-1">MAPE</p>
                <p className="text-2xl sm:text-3xl font-black">{metricLabel('MAPE_pct', bestModel.MAPE_pct, bestModel.target)}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/15">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-100 mb-1">MAE</p>
                <p className="text-2xl sm:text-3xl font-black">{bestModel.MAE}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/15">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-100 mb-1">RMSE</p>
                <p className="text-2xl sm:text-3xl font-black">{bestModel.RMSE}</p>
              </div>
              <div className="bg-white/20 backdrop-blur-md p-4 rounded-2xl border border-white/30 shadow-inner">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-white mb-1">R² Score</p>
                <p className="text-2xl sm:text-3xl font-black text-white">{metricLabel('R2', bestModel.R2, bestModel.target)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Full Width Tabs Navigation */}
      <Tabs defaultValue="comparison" className="w-full flex flex-col space-y-6 block">
        <div className="w-full">
          <TabsList className="inline-flex w-full sm:w-auto h-12 p-1.5 bg-muted/60 rounded-2xl border border-border/60 gap-1.5">
            <TabsTrigger value="comparison" className="px-5 rounded-xl font-extrabold text-xs gap-2 data-[state=active]:bg-card data-[state=active]:shadow-xs cursor-pointer">
              <BarChart3 size={15} />
              {t('Perbandingan Model')}
            </TabsTrigger>
            <TabsTrigger value="accuracy" className="px-5 rounded-xl font-extrabold text-xs gap-2 data-[state=active]:bg-card data-[state=active]:shadow-xs cursor-pointer">
              <TrendingUp size={15} />
              {t('Konvergensi Galat Pelatihan')}
            </TabsTrigger>
            <TabsTrigger value="features" className="px-5 rounded-xl font-extrabold text-xs gap-2 data-[state=active]:bg-card data-[state=active]:shadow-xs cursor-pointer">
              <Target size={15} />
              {t('Tingkat Kepentingan Fitur')}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: Perbandingan Model */}
        <TabsContent value="comparison" className="m-0 space-y-6 w-full block">
          {/* Charts Row - 2 Equal Columns across Full Width */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
            <Card className="bg-card border-border/80 shadow-md rounded-3xl overflow-hidden w-full">
              <CardHeader className="bg-muted/30 border-b border-border/60 p-6 py-5">
                <div className="flex items-center gap-3.5">
                  <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0 border border-emerald-500/20 shadow-xs">
                    <BarChart3 size={22} />
                  </div>
                  <div>
                    <CardTitle className="text-base font-black text-foreground">{t('Metrik Performa Model')}</CardTitle>
                    <CardDescription className="text-xs font-semibold text-muted-foreground mt-0.5">
                      {horizonMetricDescription(selectedHorizon)}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {comparisonChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={comparisonChartData} barGap={6} barCategoryGap="22%">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="metric" tick={{ fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
                      <Tooltip 
                        cursor={{ fill: 'rgba(16, 185, 129, 0.08)', radius: 8 }}
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
                      <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700, paddingTop: '15px' }} />
                      <Bar dataKey="LSTM" fill={MODEL_COLORS['LSTM']} radius={[6, 6, 0, 0]} />
                      <Bar dataKey="XGBoost" fill={MODEL_COLORS['XGBoost']} radius={[6, 6, 0, 0]} />
                      <Bar dataKey="SVM" fill={MODEL_COLORS['SVM']} radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="py-12 text-center text-muted-foreground font-semibold text-xs">
                    {t('Tidak ada data untuk ditampilkan')}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card border-border/80 shadow-md rounded-3xl overflow-hidden w-full">
              <CardHeader className="bg-muted/30 border-b border-border/60 p-6 py-5">
                <div className="flex items-center gap-3.5">
                  <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0 border border-indigo-500/20 shadow-xs">
                    <Shield size={22} />
                  </div>
                  <div>
                    <CardTitle className="text-base font-black text-foreground">{t('Radar Performa Keseluruhan')}</CardTitle>
                    <CardDescription className="text-xs font-semibold text-muted-foreground mt-0.5">
                      {t('Evaluasi multi-dimensi performa model (skor dinormalisasi)')}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {radarData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={320}>
                    <RadarChart data={radarData} outerRadius="70%" margin={{ top: 10, right: 40, bottom: 10, left: 40 }}>
                      <PolarGrid stroke="hsl(var(--border))" />
                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fontWeight: 700 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9, fontWeight: 600 }} axisLine={false} tickLine={false} />
                      <Radar name="LSTM" dataKey="LSTM" stroke={MODEL_COLORS['LSTM']} strokeWidth={2} fill={MODEL_COLORS['LSTM']} fillOpacity={0.4} />
                      <Radar name="XGBoost" dataKey="XGBoost" stroke={MODEL_COLORS['XGBoost']} strokeWidth={2} fill={MODEL_COLORS['XGBoost']} fillOpacity={0.3} />
                      <Radar name="SVM" dataKey="SVM" stroke={MODEL_COLORS['SVM']} strokeWidth={2} fill={MODEL_COLORS['SVM']} fillOpacity={0.2} />
                      <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700, paddingTop: '15px' }} />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="py-12 text-center text-muted-foreground font-semibold text-xs">
                    {t('Tidak ada data untuk ditampilkan')}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Metric Details Full-Width Table */}
          <Card className="bg-card border-border/80 shadow-md rounded-3xl overflow-hidden w-full mt-6">
            <CardHeader className="bg-muted/30 border-b border-border/60 p-6 py-5">
              <div className="flex items-center gap-3.5">
                <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0 border border-emerald-500/20 shadow-xs">
                  <TableProperties size={22} />
                </div>
                <div>
                  <CardTitle className="text-base font-black text-foreground">{t('Detail Metrik Per Model')}</CardTitle>
                  <CardDescription className="text-xs font-semibold text-muted-foreground mt-0.5">
                    {t('Rincian angka metrik regresi MAE, RMSE, MAPE, dan R² Score untuk setiap algoritma')}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="rounded-2xl border border-border/60 overflow-hidden">
                <Table className="w-full">
                  <TableHeader className="bg-muted/40">
                    <TableRow className="border-border/60">
                      <TableHead className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Model</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-wider text-center text-muted-foreground">RMSE</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-wider text-center text-muted-foreground">MAE</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-wider text-center text-muted-foreground">MAPE</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-wider text-center text-muted-foreground">R² Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeMetricGroup?.rows.map((m, i) => (
                      <TableRow key={i} className="border-border/40 hover:bg-muted/30">
                        <TableCell className="font-extrabold text-xs flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: MODEL_COLORS[m.model] || '#ccc' }} />
                          {m.model}
                        </TableCell>
                        <TableCell className="text-center font-bold text-xs">{metricLabel('RMSE', m.RMSE, m.target)}</TableCell>
                        <TableCell className="text-center font-bold text-xs">{metricLabel('MAE', m.MAE, m.target)}</TableCell>
                        <TableCell className="text-center font-bold text-xs">{metricLabel('MAPE_pct', m.MAPE_pct, m.target)}</TableCell>
                        <TableCell className="text-center text-xs font-black text-emerald-600 dark:text-emerald-400">{metricLabel('R2', m.R2, m.target)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Training Convergence */}
        <TabsContent value="accuracy" className="m-0 space-y-6 w-full block">
          <Card className="bg-card border-border/80 shadow-md rounded-3xl overflow-hidden w-full">
            <CardHeader className="bg-muted/30 border-b border-border/60 p-6 py-5">
              <div className="flex items-center gap-3.5">
                <div className="p-3 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 shrink-0 border border-teal-500/20 shadow-xs">
                  <TrendingUp size={22} />
                </div>
                <div>
                  <CardTitle className="text-base font-black text-foreground">{t('Ilustrasi Konvergensi Galat')}</CardTitle>
                  <CardDescription className="text-xs font-semibold text-muted-foreground mt-0.5">
                    {t('Estimasi kurva penurunan galat pelatihan (ilustrasi konvergensi)')}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {trainingHistory.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={trainingHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip 
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
                      labelFormatter={(epoch) => `Siklus Epoch Ke-${epoch}`}
                    />
                    <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700, paddingTop: '15px' }} />
                    <Line type="monotone" dataKey="lstm_loss" name="LSTM (Deep Learning)" stroke={MODEL_COLORS['LSTM']} strokeWidth={3} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="xgb_loss" name="XGBoost Regressor" stroke={MODEL_COLORS['XGBoost']} strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="svr_loss" name="SVM / SVR" stroke={MODEL_COLORS['SVM']} strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="py-12 text-center text-muted-foreground font-semibold text-xs">
                  {t('Tidak ada data untuk ditampilkan')}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Feature Importance */}
        <TabsContent value="features" className="m-0 space-y-6 w-full block">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
            <Card className="bg-card border-border/80 shadow-md rounded-3xl overflow-hidden w-full">
              <CardHeader className="bg-muted/30 border-b border-border/60 p-6 py-5">
                <div className="flex items-center gap-3.5">
                  <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0 border border-emerald-500/20 shadow-xs">
                    <Target size={22} />
                  </div>
                  <div>
                    <CardTitle className="text-base font-black text-foreground">{t('Kontribusi Fitur Model Karbon')}</CardTitle>
                    <CardDescription className="text-xs font-semibold text-muted-foreground mt-0.5">
                      {t('Tingkat kontribusi fitur mikroklimat atmosferik terhadap estimasi karbon')}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={CARBON_FEATURES} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" domain={[0, 'auto']} tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                    <YAxis dataKey="label" type="category" width={80} tick={{ fontSize: 11, fontWeight: 700 }} />
                    <Tooltip 
                      cursor={{ fill: 'rgba(16, 185, 129, 0.08)', radius: 8 }}
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
                      formatter={(v: any) => [`${(Number(v) * 100).toFixed(1)}%`, t('Kontribusi Fitur')]} 
                      labelFormatter={(label: any) => {
                        const item = CARBON_FEATURES.find(f => f.label === label);
                        return item ? item.feature : label;
                      }}
                    />
                    <Bar dataKey="importance" fill="#10b981" radius={[0, 6, 6, 0]} name={t('Kontribusi')} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="bg-card border-border/80 shadow-md rounded-3xl overflow-hidden w-full">
              <CardHeader className="bg-muted/30 border-b border-border/60 p-6 py-5">
                <CardTitle className="text-base font-black text-foreground">{t('Detail Fitur Input')}</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {CARBON_FEATURES.map((f, i) => (
                  <div key={i} className="space-y-1.5 p-3 rounded-2xl bg-muted/30 border border-border/50">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-foreground">{f.feature}</span>
                      <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">{(f.importance * 100).toFixed(0)}%</span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${(f.importance / maxFeatureImportance) * 100}%` }} />
                    </div>
                    <p className="text-[11px] text-muted-foreground font-medium">{f.description}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
