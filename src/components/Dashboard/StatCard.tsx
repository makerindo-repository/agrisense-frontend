import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Card, CardContent } from '@/components/ui/card';
import { Info, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

export function StatCard({ title, value, total, unit, icon: Icon, color, isFlippable, flipContent }: any) {
  const [isFlipped, setIsFlipped] = useState(false);
  const { t } = useTranslation();

  return (
    <div
      className={cn("w-full h-full perspective-1000", isFlippable ? "group" : "")}
      style={{ perspective: '1000px' }}
    >
      <motion.div
        className="w-full h-full relative preserve-3d"
        style={{ transformStyle: 'preserve-3d' }}
        initial={false}
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.4, type: "tween", ease: "easeInOut" }}
      >
        {/* Front */}
        <Card
          className="border-none shadow-sm shadow-black/5 group-hover:shadow-md group-hover:-translate-y-1 transition-all duration-300 overflow-hidden relative h-full flex flex-col"
          style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
        >
          {isFlippable && (
            <button
              onClick={(e) => { e.stopPropagation(); setIsFlipped(true); }}
              className="absolute top-2 right-2 p-1.5 rounded-full bg-muted/50 hover:bg-muted text-muted-foreground hover:text-primary transition-colors z-20 opacity-0 group-hover:opacity-100 shadow-sm"
              title={t("Lihat Detail")}
            >
              <Info size={12} />
            </button>
          )}
          <CardContent className="p-6 relative z-10 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div className={cn("transition-all duration-300 group-hover:scale-110 flex items-center justify-center", color)}>
                {typeof Icon === 'string' ? (
                  <div 
                    className="w-7 h-7 bg-current drop-shadow-sm" 
                    style={{ 
                      WebkitMaskImage: `url(${Icon})`, 
                      maskImage: `url(${Icon})`, 
                      WebkitMaskSize: 'contain', 
                      maskSize: 'contain', 
                      WebkitMaskRepeat: 'no-repeat', 
                      maskRepeat: 'no-repeat', 
                      WebkitMaskPosition: 'center', 
                      maskPosition: 'center' 
                    }} 
                  />
                ) : (
                  <Icon size={28} strokeWidth={1.5} className="drop-shadow-sm" />
                )}
              </div>
              {total !== undefined && total !== null && (
                <div className="flex flex-col items-end">
                  <div className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">{t("Kapasitas")}</div>
                  <div className="text-xs font-bold text-muted-foreground px-1 py-1">
                    {value} / {total}
                  </div>
                </div>
              )}
            </div>
            <div className="mt-auto">
              <h3 className={cn("text-muted-foreground/80 font-semibold uppercase tracking-widest mb-1", (title.includes("Kesehatan") || title.includes("Carbon Flux") || title.includes("Prediksi")) ? "text-[10px]" : "text-xs")}>{title}</h3>
              <div className="flex items-baseline gap-1 mt-auto">
                <span className={cn("font-semibold tracking-tighter", (title.includes("Kesehatan") || title.includes("Carbon Flux") || title.includes("Prediksi")) ? "text-3xl" : "text-4xl")}>{value}</span>
                <span className="text-[9px] font-semibold text-muted-foreground/60 uppercase leading-tight">{unit || (total === undefined ? '% SOC' : '')}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Back */}
        {isFlippable && (
          <Card
            className="absolute inset-0 border-none shadow-sm shadow-black/5 overflow-hidden"
            style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            <button
              onClick={(e) => { e.stopPropagation(); setIsFlipped(false); }}
              className="absolute top-2 right-2 p-1.5 rounded-full bg-muted/50 hover:bg-muted text-muted-foreground hover:text-primary transition-colors z-20 shadow-sm"
              title={t("Tutup Detail")}
            >
              <X size={12} />
            </button>
            <CardContent className="p-4 h-full flex flex-col justify-center items-center text-center relative z-10">
              {flipContent}
            </CardContent>
          </Card>
        )}
      </motion.div>
    </div>
  );
}
