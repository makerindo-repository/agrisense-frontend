import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { Card, CardContent } from '@/components/ui/card';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

export function SensorCard({ title, value, unit, icon: Icon, readings, description }: any) {
  const [isFlipped, setIsFlipped] = useState(false);
  const { t } = useTranslation();

  // Color theme per sensor parameter
  const theme = useMemo(() => {
    const tl = (title || '').toLowerCase();
    if (tl.includes('suhu') || tl.includes('temp')) return { stroke: '#f59e0b', fill: '#f59e0b', icon: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', flipBg: 'from-amber-500 to-orange-500' };
    if (tl.includes('lembap') || tl.includes('humid')) return { stroke: '#3b82f6', fill: '#3b82f6', icon: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20', flipBg: 'from-blue-500 to-indigo-500' };
    if (tl.includes('angin') || tl.includes('wind')) return { stroke: '#14b8a6', fill: '#14b8a6', icon: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20', flipBg: 'from-teal-500 to-cyan-600' };
    if (tl.includes('baterai') || tl.includes('battery')) return { stroke: '#10b981', fill: '#10b981', icon: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', flipBg: 'from-emerald-500 to-green-600' };
    if (tl.includes('tegangan') || tl.includes('adc') || tl.includes('volt')) return { stroke: '#8b5cf6', fill: '#8b5cf6', icon: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20', flipBg: 'from-purple-500 to-violet-600' };
    if (tl.includes('rssi') || tl.includes('sinyal')) return { stroke: '#06b6d4', fill: '#06b6d4', icon: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20', flipBg: 'from-cyan-500 to-sky-600' };
    if (tl.includes('elevasi') || tl.includes('altit')) return { stroke: '#6366f1', fill: '#6366f1', icon: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20', flipBg: 'from-indigo-500 to-blue-600' };
    if (tl.includes('co') || tl.includes('carbon')) return { stroke: '#10b981', fill: '#10b981', icon: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', flipBg: 'from-emerald-600 to-teal-600' };
    return { stroke: '#10b981', fill: '#10b981', icon: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', flipBg: 'from-emerald-600 to-teal-600' };
  }, [title]);

  // Generate sparkline — real data if available, synthetic wave if not
  const sparklineData = useMemo(() => {
    if (Array.isArray(readings) && readings.length >= 3) {
      return readings.map((r: any, idx: number) => ({
        idx,
        value: typeof r === 'number' ? r : (typeof r.value === 'number' ? r.value : parseFloat(r.value) || 0)
      }));
    }
    // Generate smooth wave around current value
    const base = typeof value === 'number' ? value : parseFloat(value) || 0;
    if (base === 0) return [{ idx: 0, value: 0 }]; // No fake data for zero
    const spread = Math.abs(base * 0.06);
    return Array.from({ length: 14 }, (_, i) => ({
      idx: i,
      value: Math.max(0, Number((base + Math.sin((i / 14) * Math.PI * 2.5) * spread + Math.cos(i * 1.7) * spread * 0.3).toFixed(2)))
    }));
  }, [readings, value]);

  const hasSparkline = sparklineData.length > 1;
  const gradientId = useMemo(() => `spark-${Math.random().toString(36).substr(2, 8)}`, []);

  // Format display value
  const displayValue = useMemo(() => {
    if (typeof value === 'string') return value;
    if (typeof value === 'number') {
      if (Number.isInteger(value) || Math.abs(value) >= 100) return value.toString();
      return value.toFixed(1);
    }
    return '—';
  }, [value]);

  const isNoData = value === 0 || value === '—' || value === null || value === undefined;

  return (
    <div
      className="w-full h-[130px] select-none group cursor-pointer"
      style={{ perspective: '1000px' }}
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <motion.div
        className="w-full h-full relative"
        style={{ transformStyle: 'preserve-3d' }}
        initial={false}
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.6, type: "spring", stiffness: 200, damping: 22 }}
      >
        {/* ── Front ── */}
        <Card 
          className={cn(
            "absolute inset-0 border border-border/80 shadow-xs bg-card rounded-2xl flex flex-col transition-all duration-300 overflow-hidden",
            !isFlipped && "group-hover:shadow-lg group-hover:-translate-y-0.5"
          )}
          style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(0deg) translateZ(1px)' }}
        >
          {/* Background Sparkline */}
          {hasSparkline && (
            <div className="absolute inset-x-0 bottom-0 h-14 w-full opacity-30 group-hover:opacity-70 transition-all duration-500 pointer-events-none rounded-b-2xl overflow-hidden">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparklineData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={theme.fill} stopOpacity={0.5} />
                      <stop offset="100%" stopColor={theme.fill} stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <Area 
                    type="monotone" dataKey="value" 
                    stroke={theme.stroke} fill={`url(#${gradientId})`}
                    strokeWidth={2} isAnimationActive={true} animationDuration={600}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          <CardContent className="p-4 flex flex-col justify-between h-full relative z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={cn("p-1.5 rounded-lg border shadow-xs transition-colors", theme.icon)}>
                  <Icon size={14} strokeWidth={2.5} />
                </div>
                <h3 className="font-extrabold text-[10px] text-foreground uppercase tracking-wider whitespace-nowrap">{title}</h3>
              </div>
              {!isNoData && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />}
            </div>

            <div className="flex items-baseline gap-1.5 mt-auto">
              <span className={cn("text-2xl font-black tracking-tight", isNoData ? "text-muted-foreground/40" : "text-foreground")}>
                {isNoData ? '—' : displayValue}
              </span>
              <span className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-wider">{unit}</span>
            </div>
          </CardContent>
        </Card>

        {/* ── Back — Gradient Info Card ── */}
        <Card
          className="absolute inset-0 shadow-xl rounded-2xl overflow-hidden border-0"
          style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg) translateZ(1px)' }}
        >
          <div className={cn("absolute inset-0 bg-gradient-to-br", theme.flipBg)} />
          <div className="absolute -right-5 -top-5 w-20 h-20 bg-white/10 rounded-full blur-xl pointer-events-none" />
          <div className="absolute -left-3 -bottom-3 w-12 h-12 bg-white/10 rounded-full blur-lg pointer-events-none" />

          <CardContent className="p-4 h-full flex flex-col justify-between items-center text-center relative z-10">
            <div className="flex-1 flex flex-col justify-center gap-1.5">
              <h4 className="text-[11px] font-black text-white uppercase tracking-widest">{title}</h4>
              <div className="w-6 h-0.5 bg-white/40 mx-auto rounded-full" />
              <p className="text-[10px] font-semibold text-white/85 leading-relaxed max-w-[160px]">
                {description || `Monitoring real-time parameter ${title} dari sensor IoT.`}
              </p>
            </div>
            <div className="text-[7px] font-black text-white/50 uppercase tracking-widest bg-white/15 px-2.5 py-0.5 rounded-full backdrop-blur-sm">
              {t("Klik untuk kembali")}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
