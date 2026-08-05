import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Card, CardContent } from '@/components/ui/card';
import { Info, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

export function NutrientCard({ label, value, unit, icon: Icon, color, isFlippable, flipContent }: any) {
  const [isFlipped, setIsFlipped] = useState(false);
  const { t } = useTranslation();

  return (
    <div className={cn("w-full perspective-1000", isFlippable ? "group" : "")} style={{ perspective: '1000px' }}>
      <motion.div
        className="w-full relative preserve-3d"
        style={{ transformStyle: 'preserve-3d' }}
        initial={false}
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.4, type: "tween", ease: "easeInOut" }}
      >
        {/* Front */}
        <Card
          className="border-none shadow-sm group-hover:shadow-sm group-hover:-translate-y-1 transition-all duration-300 bg-card/50 backdrop-blur-sm overflow-hidden relative"
          style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
        >
          {isFlippable && (
            <button
              onClick={(e) => { e.stopPropagation(); setIsFlipped(true); }}
              className="absolute top-1.5 right-1.5 p-1 rounded-full bg-muted/50 hover:bg-muted text-muted-foreground hover:text-primary transition-colors z-20 opacity-0 group-hover:opacity-100 shadow-sm"
              title={t("Lihat Detail")}
            >
              <Info size={10} />
            </button>
          )}
          <CardContent className="p-3.5 flex flex-col items-center text-center relative z-10">
            <div className={cn("mb-2 group-hover:scale-110 transition-all duration-300 flex items-center justify-center", color)}>
              {typeof Icon === 'string' ? (
                <img src={Icon} alt={label} className="w-6 h-6 object-contain drop-shadow-sm" />
              ) : (
                <Icon size={24} strokeWidth={1.5} className="drop-shadow-sm" />
              )}
            </div>
            <p className="text-[9px] uppercase tracking-widest font-semibold text-muted-foreground/80 mb-1 leading-tight">{label}</p>
            <div className="flex items-baseline gap-0.5">
              <span className="text-xl font-semibold tracking-tighter">{value}</span>
              <span className="text-[9px] font-semibold text-muted-foreground/60">{unit}</span>
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
              className="absolute top-1.5 right-1.5 p-1 rounded-full bg-muted/50 hover:bg-muted text-muted-foreground hover:text-primary transition-colors z-20 shadow-sm"
              title={t("Tutup Detail")}
            >
              <X size={10} />
            </button>
            <CardContent className="p-2 h-full flex flex-col justify-center items-center text-center relative z-10">
              {flipContent}
            </CardContent>
          </Card>
        )}
      </motion.div>
    </div>
  );
}
