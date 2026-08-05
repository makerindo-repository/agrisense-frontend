import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Card, CardContent } from '@/components/ui/card';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

export function StatCard({ title, value, total, unit, icon: Icon, color, isFlippable, flipContent }: any) {
  const [isFlipped, setIsFlipped] = useState(false);
  const { t } = useTranslation();

  return (
    <div
      className={cn("w-full h-full perspective-1000", isFlippable ? "group cursor-pointer" : "")}
      style={{ perspective: '1000px' }}
      onClick={() => isFlippable && setIsFlipped(!isFlipped)}
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
            "absolute inset-0 border-none shadow-sm shadow-black/5 overflow-hidden flex flex-col bg-card transition-all duration-300",
            !isFlipped && "group-hover:shadow-md group-hover:-translate-y-1"
          )}
          style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
        >
          <CardContent className="p-5 relative z-10 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className={cn("transition-transform duration-300 group-hover:scale-110 flex items-center justify-center", color)}>
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
                  <Icon size={24} strokeWidth={1.5} className="drop-shadow-sm" />
                )}
              </div>
              {total !== undefined && total !== null && (
                <div className="flex flex-col items-end">
                  <div className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-0.5">{t("Kapasitas")}</div>
                  <div className="text-[11px] font-black text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full border border-border/50 shadow-sm">
                    {value} / {total}
                  </div>
                </div>
              )}
            </div>
            <div className="mt-auto">
              <h3 className={cn("text-muted-foreground/80 font-semibold uppercase tracking-widest mb-1 transition-colors group-hover:text-foreground", (title.includes("Kesehatan") || title.includes("Carbon Flux") || title.includes("Prediksi")) ? "text-[10px]" : "text-[11px]")}>{title}</h3>
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
            className="absolute inset-0 border-none shadow-md overflow-hidden bg-card"
            style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            <CardContent className="p-4 h-full flex flex-col justify-center items-center text-center relative z-10 border border-primary/10 rounded-xl">
              {flipContent}
              <div className="mt-3 text-[8px] font-bold text-muted-foreground/40 uppercase tracking-widest">
                {t("Klik untuk menutup")}
              </div>
            </CardContent>
          </Card>
        )}
      </motion.div>
    </div>
  );
}
