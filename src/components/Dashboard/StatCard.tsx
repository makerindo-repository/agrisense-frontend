import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { Card, CardContent } from '@/components/ui/card';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

export function StatCard({ title, value, total, unit, icon: Icon, color, isFlippable, flipContent }: any) {
  const [isFlipped, setIsFlipped] = useState(false);
  const { t } = useTranslation();

  const accent = useMemo(() => {
    if (!color) return { ring: 'ring-emerald-500/30', bg: 'from-emerald-500/8 to-transparent', text: 'text-emerald-600 dark:text-emerald-400', badge: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', flipBg: 'from-emerald-600 to-teal-600', flipBorder: 'border-emerald-500/30' };
    if (color.includes('amber') || color.includes('yellow')) return { ring: 'ring-amber-500/30', bg: 'from-amber-500/8 to-transparent', text: 'text-amber-500 dark:text-amber-400', badge: 'bg-amber-500/10 text-amber-600 border-amber-500/20', flipBg: 'from-amber-500 to-orange-500', flipBorder: 'border-amber-500/30' };
    if (color.includes('rose') || color.includes('red') || color.includes('destructive')) return { ring: 'ring-rose-500/30', bg: 'from-rose-500/8 to-transparent', text: 'text-rose-500 dark:text-rose-400', badge: 'bg-rose-500/10 text-rose-600 border-rose-500/20', flipBg: 'from-rose-500 to-pink-600', flipBorder: 'border-rose-500/30' };
    if (color.includes('blue')) return { ring: 'ring-blue-500/30', bg: 'from-blue-500/8 to-transparent', text: 'text-blue-600 dark:text-blue-400', badge: 'bg-blue-500/10 text-blue-600 border-blue-500/20', flipBg: 'from-blue-500 to-indigo-600', flipBorder: 'border-blue-500/30' };
    return { ring: 'ring-emerald-500/30', bg: 'from-emerald-500/8 to-transparent', text: 'text-emerald-600 dark:text-emerald-400', badge: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', flipBg: 'from-emerald-600 to-teal-600', flipBorder: 'border-emerald-500/30' };
  }, [color]);

  return (
    <div
      className={cn("w-full h-[140px] select-none", isFlippable ? "group cursor-pointer" : "")}
      style={{ perspective: '1000px' }}
      onClick={() => isFlippable && setIsFlipped(!isFlipped)}
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
          <div className={cn("absolute inset-0 bg-gradient-to-br opacity-50 pointer-events-none rounded-2xl", accent.bg)} />

          <CardContent className="p-5 h-full flex flex-col relative z-10">
            <div className="flex items-start justify-between">
              <div className={cn("transition-transform duration-300 group-hover:scale-110", accent.text)}>
                {typeof Icon === 'string' ? (
                  <div 
                    className="w-7 h-7 bg-current" 
                    style={{ 
                      WebkitMaskImage: `url(${Icon})`, maskImage: `url(${Icon})`,
                      WebkitMaskSize: 'contain', maskSize: 'contain',
                      WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
                      WebkitMaskPosition: 'center', maskPosition: 'center' 
                    }} 
                  />
                ) : (
                  <Icon size={24} strokeWidth={1.5} />
                )}
              </div>
              {total !== undefined && total !== null && (
                <div className={cn("text-[10px] font-black px-2 py-0.5 rounded-lg border", accent.badge)}>
                  {value}/{total}
                </div>
              )}
            </div>
            <div className="mt-auto">
              <h3 className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider mb-0.5 truncate">{title}</h3>
              <div className="flex items-baseline gap-1">
                <span className={cn("text-3xl font-black tracking-tight", accent.text)}>{value}</span>
                {unit && <span className="text-[10px] font-bold text-muted-foreground uppercase">{unit}</span>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Back — Modern Gradient Card ── */}
        {isFlippable && (
          <Card
            className={cn("absolute inset-0 shadow-xl rounded-2xl overflow-hidden", accent.flipBorder)}
            style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg) translateZ(1px)' }}
          >
            {/* Gradient background */}
            <div className={cn("absolute inset-0 bg-gradient-to-br opacity-95", accent.flipBg)} />
            {/* Decorative circles */}
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none" />
            <div className="absolute -left-4 -bottom-4 w-16 h-16 bg-white/10 rounded-full blur-lg pointer-events-none" />

            <CardContent className="p-4 h-full flex flex-col justify-between items-center text-center relative z-10">
              <div className="flex-1 flex flex-col items-center justify-center space-y-1.5 w-full my-auto">
                {flipContent ? (
                  <div className="text-white text-center w-full [&_*]:text-white [&_*]:border-white/25">
                    {flipContent}
                  </div>
                ) : (
                  <>
                    <h4 className="text-[11px] font-black text-white uppercase tracking-widest">{title}</h4>
                    <div className="w-6 h-0.5 bg-white/40 rounded-full" />
                    <p className="text-[9.5px] font-medium text-white/90 leading-relaxed">
                      Informasi detail parameter {title}.
                    </p>
                  </>
                )}
              </div>
              <div className="text-[8px] font-black text-white/85 uppercase tracking-widest bg-white/20 px-3 py-0.5 rounded-full backdrop-blur-sm shrink-0 mt-2 mb-0.5">
                {t("Klik untuk kembali")}
              </div>
            </CardContent>
          </Card>
        )}
      </motion.div>
    </div>
  );
}
