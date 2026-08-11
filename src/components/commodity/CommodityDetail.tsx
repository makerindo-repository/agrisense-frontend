import React from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Sprout, Thermometer, Droplets, Mountain, Bug, Activity, Sparkles, Calendar, HeartPulse } from 'lucide-react';
import api from '../../lib/api';
import { getStorageUrl } from '../../utils/fileUtils';

export interface CommodityDetailProps {
  detailTarget: any | null;
  onClose: () => void;
}

const CommodityDetail: React.FC<CommodityDetailProps> = ({ detailTarget, onClose }) => {
  const { t } = useTranslation();

  const formatRange = (min: any, max: any, unit?: string) => {
    if (min == null && max == null) return '-';
    const suffix = unit ? ` ${unit}` : '';
    if (min != null && max != null) return `${min}–${max}${suffix}`;
    if (min != null) return `≥${min}${suffix}`;
    return `≤${max}${suffix}`;
  };

  return (
    <Dialog open={!!detailTarget} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto rounded-[28px] border border-border/80 shadow-2xl p-6 sm:p-7 bg-card gap-0">
        {detailTarget && (
          <>
            <DialogHeader className="flex flex-row items-start gap-4 pb-5 mb-5 border-b border-border/60 space-y-0 text-left">
              <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0 shadow-xs">
                <Sprout size={24} />
              </div>
              <div className="flex flex-col gap-1 pr-6 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <DialogTitle className="text-xl font-black tracking-tight text-foreground leading-snug">
                    {detailTarget.nama_komoditi}
                  </DialogTitle>
                  <Badge className="rounded-xl font-extrabold text-[10px] uppercase tracking-wider px-2.5 py-0.5 border-none bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                    {detailTarget.status}
                  </Badge>
                </div>
                <DialogDescription className="text-xs font-semibold text-muted-foreground leading-relaxed">
                  <span className="font-mono font-bold text-foreground">{detailTarget.kode_komoditi}</span> • {detailTarget.kategori_tanaman}
                  {detailTarget.nama_latin && <span className="italic ml-1">({detailTarget.nama_latin})</span>}
                </DialogDescription>
              </div>
            </DialogHeader>

            <div className="space-y-6 text-xs">
              {/* Deskripsi & Varietas */}
              {(detailTarget.deskripsi || detailTarget.varietas) && (
                <div className="bg-muted/20 p-4 rounded-2xl border border-border/60 space-y-2">
                  {detailTarget.varietas && (
                    <div className="font-bold text-foreground">
                      <span className="text-muted-foreground uppercase text-[10px] tracking-wider block font-extrabold">{t('Varietas')}</span>
                      {detailTarget.varietas}
                    </div>
                  )}
                  {detailTarget.deskripsi && (
                    <p className="text-muted-foreground font-semibold leading-relaxed">{detailTarget.deskripsi}</p>
                  )}
                </div>
              )}
              
              {/* Lingkungan Ideal */}
              {detailTarget.lingkungan && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-extrabold text-[11px] uppercase tracking-wider">
                    <Thermometer size={16} />
                    {t('Lingkungan Tumbuh Ideal')}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="bg-card p-3 rounded-2xl border border-border/80 shadow-xs flex flex-col gap-1">
                      <span className="text-[10px] font-extrabold text-muted-foreground uppercase">{t('Suhu')}</span>
                      <span className="font-black text-sm text-foreground">{formatRange(detailTarget.lingkungan.suhu_min, detailTarget.lingkungan.suhu_max, '°C')}</span>
                    </div>
                    <div className="bg-card p-3 rounded-2xl border border-border/80 shadow-xs flex flex-col gap-1">
                      <span className="text-[10px] font-extrabold text-muted-foreground uppercase">{t('pH Tanah')}</span>
                      <span className="font-black text-sm text-foreground">{formatRange(detailTarget.lingkungan.ph_min, detailTarget.lingkungan.ph_max)}</span>
                    </div>
                    <div className="bg-card p-3 rounded-2xl border border-border/80 shadow-xs flex flex-col gap-1">
                      <span className="text-[10px] font-extrabold text-muted-foreground uppercase">{t('Kelembapan')}</span>
                      <span className="font-black text-sm text-foreground">{formatRange(detailTarget.lingkungan.kelembapan_udara_min, detailTarget.lingkungan.kelembapan_udara_max, '%')}</span>
                    </div>
                    <div className="bg-card p-3 rounded-2xl border border-border/80 shadow-xs flex flex-col gap-1">
                      <span className="text-[10px] font-extrabold text-muted-foreground uppercase">{t('Ketinggian')}</span>
                      <span className="font-black text-sm text-foreground">{formatRange(detailTarget.lingkungan.ketinggian_min, detailTarget.lingkungan.ketinggian_max, 'mdpl')}</span>
                    </div>
                    {detailTarget.lingkungan.jenis_tanah && (
                      <div className="bg-card p-3 rounded-2xl border border-border/80 shadow-xs flex flex-col gap-1">
                        <span className="text-[10px] font-extrabold text-muted-foreground uppercase">{t('Jenis Tanah')}</span>
                        <span className="font-bold text-xs text-foreground truncate">{detailTarget.lingkungan.jenis_tanah}</span>
                      </div>
                    )}
                    {detailTarget.lingkungan.drainase && (
                      <div className="bg-card p-3 rounded-2xl border border-border/80 shadow-xs flex flex-col gap-1">
                        <span className="text-[10px] font-extrabold text-muted-foreground uppercase">{t('Drainase')}</span>
                        <span className="font-bold text-xs text-foreground">{detailTarget.lingkungan.drainase}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Hama dan Penyakit */}
              {(detailTarget.hama_penyakit || []).length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-extrabold text-[11px] uppercase tracking-wider">
                    <Bug size={16} />
                    {t('Hama dan Penyakit Potensial')}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(detailTarget.hama_penyakit || []).map((hp: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-card border border-border/80 shadow-xs">
                        <div className="flex items-center gap-2">
                          <Badge className={`rounded-lg font-extrabold text-[9px] uppercase px-2 py-0.5 border-none ${
                            hp.jenis === 'Hama' ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400' : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                          }`}>
                            {hp.jenis}
                          </Badge>
                          <span className="font-bold text-foreground text-xs">{hp.nama}</span>
                        </div>
                        {hp.tingkat_risiko && (
                          <span className="text-[10px] font-extrabold text-muted-foreground uppercase">{hp.tingkat_risiko}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Siklus & Masa Tanam */}
              {detailTarget.fase_tanam && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-extrabold text-[11px] uppercase tracking-wider">
                    <Calendar size={16} />
                    {t('Siklus dan Masa Tanam')}
                  </div>
                  <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-3">
                    <div className="flex items-center justify-between border-b border-emerald-500/10 pb-2">
                      <span className="font-extrabold uppercase text-[10px] text-muted-foreground">{t('Perkiraan Usia Panen')}</span>
                      <span className="font-black text-sm text-emerald-600 dark:text-emerald-400">
                        {formatRange(detailTarget.fase_tanam.usia_tanam_min, detailTarget.fase_tanam.usia_tanam_max, detailTarget.fase_tanam.satuan_usia)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-muted-foreground">
                      {detailTarget.fase_tanam.fase_pembibitan && <div>Pembibitan: <span className="text-foreground font-bold">{detailTarget.fase_tanam.fase_pembibitan}</span></div>}
                      {detailTarget.fase_tanam.fase_vegetatif && <div>Vegetatif: <span className="text-foreground font-bold">{detailTarget.fase_tanam.fase_vegetatif}</span></div>}
                      {detailTarget.fase_tanam.fase_generatif && <div>Generatif: <span className="text-foreground font-bold">{detailTarget.fase_tanam.fase_generatif}</span></div>}
                      {detailTarget.fase_tanam.fase_panen && <div>Panen: <span className="text-foreground font-bold">{detailTarget.fase_tanam.fase_panen}</span></div>}
                    </div>
                    {detailTarget.fase_tanam.catatan_budidaya && (
                      <div className="pt-2 text-muted-foreground text-[11px] font-medium border-t border-emerald-500/10">
                        <span className="font-bold text-foreground">{t('Catatan Budidaya')}: </span>
                        {detailTarget.fase_tanam.catatan_budidaya}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Kebutuhan Nutrisi */}
              {detailTarget.nutrisi && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-extrabold text-[11px] uppercase tracking-wider">
                    <HeartPulse size={16} />
                    {t('Kebutuhan Nutrisi Utama')}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-2xl text-center">
                      <div className="font-black text-blue-600 dark:text-blue-400 text-sm">Nitrogen (N)</div>
                      <div className="font-extrabold text-xs text-foreground mt-0.5">{formatRange(detailTarget.nutrisi.nitrogen_min, detailTarget.nutrisi.nitrogen_max)}</div>
                    </div>
                    <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-2xl text-center">
                      <div className="font-black text-amber-600 dark:text-amber-400 text-sm">Fosfor (P)</div>
                      <div className="font-extrabold text-xs text-foreground mt-0.5">{formatRange(detailTarget.nutrisi.fosfor_min, detailTarget.nutrisi.fosfor_max)}</div>
                    </div>
                    <div className="bg-purple-500/10 border border-purple-500/20 p-3 rounded-2xl text-center">
                      <div className="font-black text-purple-600 dark:text-purple-400 text-sm">Kalium (K)</div>
                      <div className="font-extrabold text-xs text-foreground mt-0.5">{formatRange(detailTarget.nutrisi.kalium_min, detailTarget.nutrisi.kalium_max)}</div>
                    </div>
                  </div>
                  {detailTarget.nutrisi.rekomendasi_pemupukan && (
                    <p className="text-muted-foreground text-[11px] font-medium bg-muted/20 p-3 rounded-2xl border border-border/60">
                      <span className="font-bold text-foreground">{t('Rekomendasi Pemupukan')}: </span>
                      {detailTarget.nutrisi.rekomendasi_pemupukan}
                    </p>
                  )}
                </div>
              )}

              {/* Analisis Kesesuaian Lahan (AI) */}
              {detailTarget.rekomendasi && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400 font-extrabold text-[11px] uppercase tracking-wider">
                    <Sparkles size={16} />
                    {t('Analisis Kesesuaian Lahan AI')}
                  </div>
                  <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground">{t('Status Kesesuaian')}</span>
                      <Badge className="rounded-xl font-extrabold text-[10px] uppercase px-2.5 py-0.5 border-none bg-violet-500/15 text-violet-700 dark:text-violet-400">
                        {detailTarget.rekomendasi.status_kesesuaian_lahan}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground">{t('Skor Kesesuaian')}</span>
                      <span className="font-black text-sm text-emerald-600 dark:text-emerald-400">{detailTarget.rekomendasi.skor_kesesuaian}/100</span>
                    </div>
                    {detailTarget.rekomendasi.rekomendasi_tindakan && (
                      <div className="pt-3 border-t border-border/60">
                        <span className="font-extrabold uppercase text-[10px] text-muted-foreground block mb-1">{t('Rekomendasi Tindakan')}</span>
                        <p className="text-muted-foreground font-semibold leading-relaxed">{detailTarget.rekomendasi.rekomendasi_tindakan}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Foto Komoditi */}
              {detailTarget.foto && (
                <div className="space-y-2">
                  <span className="font-extrabold uppercase text-[10px] text-muted-foreground tracking-wider block">{t('Foto Komoditi')}</span>
                  <div className="rounded-2xl overflow-hidden max-h-[220px] border border-border/80 shadow-xs">
                    <img 
                      src={getStorageUrl(detailTarget.foto)} 
                      alt={detailTarget.nama_komoditi} 
                      className="w-full h-full object-cover" 
                    />
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CommodityDetail;
