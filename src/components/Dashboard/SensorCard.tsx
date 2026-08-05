import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Card, CardContent } from '@/components/ui/card';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

export function SensorCard({ title, value, unit, icon: Icon, readings, description }: any) {
  const [isFlipped, setIsFlipped] = useState(false);
  const { t } = useTranslation();
  const hasData = readings && readings.length > 0 && readings.some((r: any) => r.value !== 0);

  return (
    <div
      className="w-full h-[120px] perspective-1000 group cursor-pointer"
      style={{ perspective: '1000px' }}
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <motion.div
        className="w-full h-full relative preserve-3d"
        style={{ transformStyle: 'preserve-3d' }}
        initial={false}
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.5, type: "spring", stiffness: 260, damping: 20 }}
      >
        {/* Front */}
        <Card 
          className={cn(
            "absolute inset-0 border-none shadow-sm shadow-black/5 bg-card flex flex-col transition-all duration-300",
            !isFlipped && "hover:shadow-md hover:-translate-y-1"
          )}
          style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(0deg) translateZ(1px)' }}
        >
          {/* Background Chart */}
          <div className="absolute bottom-0 left-0 right-0 h-12 w-full opacity-40 group-hover:opacity-100 transition-opacity pointer-events-none rounded-b-xl overflow-hidden">
            {hasData && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={readings}>
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="hsl(var(--primary))" 
                    fill="hsl(var(--primary))" 
                    fillOpacity={0.15} 
                    strokeWidth={1.5} 
                    isAnimationActive={false} 
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          <CardContent className="p-4 flex flex-col h-full">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-md bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <Icon size={14} strokeWidth={2.5} />
              </div>
              <h3 className="font-bold text-[10px] text-muted-foreground uppercase tracking-widest">{title}</h3>
            </div>
            <div className="flex items-baseline gap-1 mt-auto">
              <span className="text-2xl font-black tracking-tighter text-foreground">
                {typeof value === 'number' ? value.toFixed(1).replace('.0', '') : value}
              </span>
              <span className="text-[9px] font-bold text-muted-foreground/70 uppercase tracking-widest">{unit}</span>
            </div>
          </CardContent>
        </Card>

        {/* Back */}
        <Card
          className="absolute inset-0 border-none shadow-md bg-card"
          style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg) translateZ(1px)' }}
        >
          <CardContent className="p-4 h-full flex flex-col justify-center items-center text-center relative z-10 border border-primary/10 rounded-xl">
            <h4 className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">{title}</h4>
            <p className="text-[9px] text-muted-foreground leading-tight line-clamp-3">
              {description || `Pemantauan real-time untuk parameter ${title}.`}
            </p>
            <div className="mt-auto pt-2 text-[8px] font-bold text-muted-foreground/40 uppercase tracking-widest">
              {t("Klik untuk menutup")}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
