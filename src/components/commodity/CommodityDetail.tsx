import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import api from '../../lib/api';

export interface CommodityDetailProps {
  detailTarget: any | null;
  onClose: () => void;
}

const CommodityDetail: React.FC<CommodityDetailProps> = ({ detailTarget, onClose }) => {
  const formatRange = (min: any, max: any, unit?: string) => {
    if (min == null && max == null) return '-';
    const suffix = unit ? ` ${unit}` : '';
    if (min != null && max != null) return `${min}–${max}${suffix}`;
    if (min != null) return `≥${min}${suffix}`;
    return `≤${max}${suffix}`;
  };

  return (
    <Dialog open={!!detailTarget} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl lg:max-w-3xl max-h-[80vh] overflow-y-auto rounded-md">
        {detailTarget && (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">
                {detailTarget.nama_komoditi}
              </DialogTitle>
              <DialogDescription className="text-sm">
                {detailTarget.kode_komoditi} — {detailTarget.kategori_tanaman}
                {detailTarget.nama_latin && <span className="italic ml-1">({detailTarget.nama_latin})</span>}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-2 text-sm">
              {detailTarget.deskripsi && <p className="text-muted-foreground">{detailTarget.deskripsi}</p>}
              {detailTarget.varietas && <div><span className="font-medium">Varietas:</span> {detailTarget.varietas}</div>}
              
              {detailTarget.lingkungan && (
                <div className="space-y-2">
                  <h4 className="font-medium text-xs uppercase tracking-wide text-muted-foreground">Lingkungan Ideal</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>Suhu: {formatRange(detailTarget.lingkungan.suhu_min, detailTarget.lingkungan.suhu_max, '°C')}</div>
                    <div>pH: {formatRange(detailTarget.lingkungan.ph_min, detailTarget.lingkungan.ph_max)}</div>
                    <div>Kelembapan: {formatRange(detailTarget.lingkungan.kelembapan_udara_min, detailTarget.lingkungan.kelembapan_udara_max, '%')}</div>
                    <div>Ketinggian: {formatRange(detailTarget.lingkungan.ketinggian_min, detailTarget.lingkungan.ketinggian_max, 'mdpl')}</div>
                    {detailTarget.lingkungan.jenis_tanah && <div>Tanah: {detailTarget.lingkungan.jenis_tanah}</div>}
                    {detailTarget.lingkungan.drainase && <div>Drainase: {detailTarget.lingkungan.drainase}</div>}
                  </div>
                </div>
              )}

              {(detailTarget.hama_penyakit || []).length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-xs uppercase tracking-wide text-muted-foreground">Hama & Penyakit</h4>
                  <div className="space-y-1">
                    {(detailTarget.hama_penyakit || []).map((hp: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className={`text-xs px-1.5 py-0.5 rounded-sm ${hp.jenis === 'Hama' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{hp.jenis}</span>
                        <span>{hp.nama}</span>
                        {hp.tingkat_risiko && <span className="text-xs text-muted-foreground">({hp.tingkat_risiko})</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {detailTarget.fase_tanam && (
                <div className="space-y-2">
                  <h4 className="font-medium text-xs uppercase tracking-wide text-muted-foreground">Siklus & Masa Tanam</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm bg-muted/20 p-2 rounded-md">
                    <div className="col-span-2 font-medium">Perkiraan Panen: <span className="text-emerald-600">{formatRange(detailTarget.fase_tanam.usia_tanam_min, detailTarget.fase_tanam.usia_tanam_max, detailTarget.fase_tanam.satuan_usia)}</span></div>
                    {detailTarget.fase_tanam.fase_pembibitan && <div>Pembibitan: {detailTarget.fase_tanam.fase_pembibitan}</div>}
                    {detailTarget.fase_tanam.fase_vegetatif && <div>Vegetatif: {detailTarget.fase_tanam.fase_vegetatif}</div>}
                    {detailTarget.fase_tanam.fase_generatif && <div>Generatif: {detailTarget.fase_tanam.fase_generatif}</div>}
                    {detailTarget.fase_tanam.fase_panen && <div>Panen: {detailTarget.fase_tanam.fase_panen}</div>}
                    {detailTarget.fase_tanam.catatan_budidaya && <div className="col-span-2 text-muted-foreground mt-1 text-xs">Catatan: {detailTarget.fase_tanam.catatan_budidaya}</div>}
                  </div>
                </div>
              )}

              {detailTarget.nutrisi && (
                <div className="space-y-2">
                  <h4 className="font-medium text-xs uppercase tracking-wide text-muted-foreground">Kebutuhan Nutrisi (ppm/ha)</h4>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="bg-blue-50 text-blue-800 p-2 rounded text-center">
                      <div className="font-bold">N</div>
                      <div className="text-xs">{formatRange(detailTarget.nutrisi.nitrogen_min, detailTarget.nutrisi.nitrogen_max)}</div>
                    </div>
                    <div className="bg-orange-50 text-orange-800 p-2 rounded text-center">
                      <div className="font-bold">P</div>
                      <div className="text-xs">{formatRange(detailTarget.nutrisi.fosfor_min, detailTarget.nutrisi.fosfor_max)}</div>
                    </div>
                    <div className="bg-purple-50 text-purple-800 p-2 rounded text-center">
                      <div className="font-bold">K</div>
                      <div className="text-xs">{formatRange(detailTarget.nutrisi.kalium_min, detailTarget.nutrisi.kalium_max)}</div>
                    </div>
                    <div className="col-span-3 text-xs mt-1">Organik: {formatRange(detailTarget.nutrisi.bahan_organik_min, detailTarget.nutrisi.bahan_organik_max, '%')}</div>
                    {detailTarget.nutrisi.rekomendasi_pemupukan && <div className="col-span-3 text-muted-foreground mt-1 text-xs">Saran: {detailTarget.nutrisi.rekomendasi_pemupukan}</div>}
                  </div>
                </div>
              )}

              {detailTarget.rekomendasi && (
                <div className="space-y-2">
                  <h4 className="font-medium text-xs uppercase tracking-wide text-muted-foreground">Analisis Kesesuaian Lahan (AI)</h4>
                  <div className="p-3 bg-muted/30 rounded-md text-sm space-y-2 border">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Status</span>
                      <Badge variant={detailTarget.rekomendasi.status_kesesuaian_lahan === 'Sangat Sesuai' ? 'default' : detailTarget.rekomendasi.status_kesesuaian_lahan === 'Sesuai' ? 'secondary' : 'destructive'}>{detailTarget.rekomendasi.status_kesesuaian_lahan}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Skor Kesesuaian</span>
                      <span className="font-bold">{detailTarget.rekomendasi.skor_kesesuaian}/100</span>
                    </div>
                    {detailTarget.rekomendasi.rekomendasi_tindakan && (
                      <div className="pt-2 border-t mt-2">
                        <span className="font-medium text-xs block text-muted-foreground mb-1">Rekomendasi Tindakan</span>
                        <p>{detailTarget.rekomendasi.rekomendasi_tindakan}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {detailTarget.foto && (
                <div className="space-y-2">
                  <h4 className="font-medium text-xs uppercase tracking-wide text-muted-foreground">Foto Komoditi</h4>
                  <div className="rounded-md overflow-hidden max-h-[200px] border">
                    <img src={`${api.defaults.baseURL?.replace('/api', '')}/storage/${detailTarget.foto}`} alt={detailTarget.nama_komoditi} className="w-full object-cover" />
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
