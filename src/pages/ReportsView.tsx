import React, { useState, useMemo, useEffect } from 'react';
import { 
  FileText, Download, Eye, Calendar as CalendarIcon, Activity, CheckCircle2, 
  FileCheck, SlidersHorizontal, Radio, FileSpreadsheet, BarChart3, ShieldCheck,
  TableProperties
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { formatFileDateOnly, format, addDays, id } from '@/utils/formatters';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import api from '../lib/api';

export default function ReportsView() {
  const { t, i18n } = useTranslation();
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date | undefined }>({
    from: addDays(new Date(), -7),
    to: new Date(),
  });
  const [reportType, setReportType] = useState("raw-data");
  const [fileFormat, setFileFormat] = useState("pdf");
  const [selectedNode, setSelectedNode] = useState("all");
  const [nodes, setNodes] = useState<any[]>([]);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Label dictionary for report types
  const reportTypeLabels: Record<string, string> = {
    'raw-data': t('Laporan Data Historis'),
    'analysis': t('Interpretasi dan Analisis'),
    'maintenance': t('Laporan Pemeliharaan'),
    'system-logs': t('Log Aktivitas Sistem')
  };

  useEffect(() => {
    // Fetch nodes for dropdown using authenticated api
    api.get('/nodes')
      .then(res => {
        if (Array.isArray(res.data)) setNodes(res.data);
      })
      .catch(err => console.error(err));
  }, []);

  const handleGenerate = async () => {
    setIsGenerating(true);
    let url = `/reports/export?format=${fileFormat}&type=${reportType}`;
    
    if (dateRange.from) {
      url += `&start_date=${format(dateRange.from, 'yyyy-MM-dd')}`;
    }
    if (dateRange.to) {
      url += `&end_date=${format(dateRange.to, 'yyyy-MM-dd')}`;
    }
    if (selectedNode !== 'all') {
      url += `&device_id=${selectedNode}`;
    }

    try {
      const activeNodeName = selectedNode === 'all' ? 'All_Nodes' : (nodes.find(n => (n.device_code || n.name || n.id).toString() === selectedNode.toString())?.name || 'Node');
      const typeLabel = reportType === 'raw-data' ? 'Data_Historis' : reportType === 'analysis' ? 'Analisis' : reportType === 'maintenance' ? 'Pemeliharaan' : 'Log_Sistem';
      const filename = `AgriSense_${typeLabel}_${activeNodeName}_${formatFileDateOnly()}`;

      if (fileFormat === 'csv') {
        const res = await api.get(url, { responseType: 'blob' });
        const downloadUrl = window.URL.createObjectURL(new Blob([res.data]));
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = `${filename}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(downloadUrl);
        a.remove();
        toast.success(t('CSV berhasil diunduh!'));
      } else {
        const res = await api.get(url);
        const exportData = res.data.data || [];
        setPreviewData(exportData);

        if (fileFormat === 'excel') {
          const worksheet = XLSX.utils.json_to_sheet(exportData);
          if (exportData.length > 0) {
            const colWidths = Object.keys(exportData[0]).map((key) => {
              const maxLen = Math.max(
                key.length,
                ...exportData.map((row: any) => String(row[key] ?? '').length)
              );
              return { wch: Math.min(Math.max(maxLen + 4, 12), 40) };
            });
            worksheet['!cols'] = colWidths;
          }
          const workbook = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan AgriSense");
          XLSX.writeFile(workbook, `${filename}.xlsx`);
          toast.success(t('Excel berhasil diunduh!'));
        } else if (fileFormat === 'pdf') {
          const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
          const typeTitle = reportTypeLabels[reportType] || 'Laporan AgriSense';
          
          // Header Banner
          doc.setFillColor(16, 185, 129); // Emerald 500
          doc.rect(0, 0, 297, 24, 'F');
          
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(16);
          doc.setFont('helvetica', 'bold');
          doc.text('AGRISENSE SMART CARBON SYSTEM', 14, 11);
          
          doc.setFontSize(11);
          doc.setFont('helvetica', 'normal');
          doc.text(`${typeTitle.toUpperCase()} - ${activeNodeName.toUpperCase()}`, 14, 18);

          // Report Info Metadata Subheader
          doc.setTextColor(51, 65, 85); // Slate 700
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          const dateFromStr = format(dateRange.from, "dd MMM yyyy", { locale: id });
          const dateToStr = dateRange.to ? format(dateRange.to, "dd MMM yyyy", { locale: id }) : '-';
          doc.text(`Periode Laporan: ${dateFromStr} s/d ${dateToStr}`, 14, 30);
          doc.setFont('helvetica', 'normal');
          doc.text(`Dicetak Pada: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`, 180, 30);

          if (exportData.length > 0) {
            const head = Object.keys(exportData[0]);
            const body = exportData.map((row: any) => Object.values(row).map(v => v !== null && v !== undefined ? String(v) : '-'));

            autoTable(doc, {
              head: [head],
              body: body,
              startY: 34,
              theme: 'striped',
              headStyles: {
                fillColor: [15, 118, 110], // Teal 700
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 7.5,
                halign: 'center',
                cellPadding: 2.5,
              },
              styles: {
                fontSize: 7,
                cellPadding: 2,
                overflow: 'linebreak',
                valign: 'middle',
              },
              alternateRowStyles: {
                fillColor: [248, 250, 252], // Slate 50
              },
              didDrawPage: (data) => {
                // Footer Page Numbering
                const str = `Halaman ${data.pageNumber} dari ${(doc as any).internal.getNumberOfPages()}`;
                doc.setFontSize(8);
                doc.setTextColor(148, 163, 184);
                doc.text(str, 297 - 14, 201, { align: 'right' });
                doc.text('Dokumen Resmi AgriSense System • Hak Cipta Dilindungi', 14, 201);
              }
            });
          } else {
            doc.setFontSize(10);
            doc.setTextColor(100, 116, 139);
            doc.text("Tidak ada record data telemetri yang ditemukan pada rentang tanggal ini.", 14, 45);
          }
          
          doc.save(`${filename}.pdf`);
          toast.success(t('PDF berhasil diunduh!'));
        }
      }
    } catch (err) {
      console.error("Export error:", err);
      toast.error(t('Gagal melakukan ekspor data. Pastikan rentang tanggal benar.'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleQuickPreview = async () => {
    setIsGenerating(true);
    try {
      let url = `/reports/export?format=json&type=${reportType}`;
      if (dateRange.from) url += `&start_date=${format(dateRange.from, 'yyyy-MM-dd')}`;
      if (dateRange.to) url += `&end_date=${format(dateRange.to, 'yyyy-MM-dd')}`;
      if (selectedNode !== 'all') url += `&device_id=${selectedNode}`;
      
      const res = await api.get(url);
      setPreviewData(res.data.data || []);
      toast.success(t('Pratinjau berhasil dimuat. Silakan cek tabel di sebelah kanan.'));
    } catch (err) {
      toast.error(t('Gagal memuat pratinjau. Periksa koneksi atau rentang tanggal.'));
    } finally {
      setIsGenerating(false);
    }
  };

  const estimatedSize = useMemo(() => {
    if (!previewData || previewData.length === 0) return '-';
    const str = JSON.stringify(previewData);
    const bytes = new Blob([str]).size;
    
    let multiplier = 1; // csv
    if (fileFormat === 'excel') multiplier = 1.5;
    if (fileFormat === 'pdf') multiplier = 2.0;
    
    const finalBytes = bytes * multiplier;
    
    if (finalBytes < 1024) return `${Math.ceil(finalBytes)} B`;
    if (finalBytes < 1024 * 1024) return `${(finalBytes / 1024).toFixed(1)} KB`;
    return `${(finalBytes / (1024 * 1024)).toFixed(2)} MB`;
  }, [previewData, fileFormat]);

  const selectedNodeLabel = useMemo(() => {
    if (selectedNode === 'all') return t('Semua Node');
    const target = nodes.find(n => (n.device_code || n.name || n.id).toString() === selectedNode.toString());
    return target ? (target.name || target.device_code || target.id) : selectedNode;
  }, [selectedNode, nodes, t]);

  return (
    <div className="w-full space-y-6 max-w-5xl mx-auto pb-24 select-none">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border/60">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-xs shrink-0">
            <FileText size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-foreground">
              {t('Laporan dan Ekspor')}
            </h1>
            <p className="text-xs font-semibold text-muted-foreground mt-0.5">
              {t('Pusat dokumentasi dan ekspor data sistem AgriSense')}
            </p>
          </div>
        </div>
      </div>

      {/* Top Configuration Card (Full Width) */}
      <Card className="bg-card border-border/80 shadow-md rounded-3xl overflow-hidden w-full">
        <CardHeader className="bg-muted/30 border-b border-border/60 p-6 py-5">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0 border border-emerald-500/20 shadow-xs">
              <FileCheck size={22} />
            </div>
            <div>
              <CardTitle className="text-base font-black tracking-tight text-foreground">
                {t('Konfigurasi Laporan')}
              </CardTitle>
              <CardDescription className="text-xs font-semibold text-muted-foreground mt-0.5">
                {t('Atur jenis laporan, rentang tanggal, dan format berkas luaran')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
            {/* 1. Jenis Laporan */}
            <div className="space-y-2">
              <Label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <SlidersHorizontal size={13} />
                {t('Jenis Laporan')}
              </Label>
              <Select value={reportType} onValueChange={(v) => setReportType(v || 'raw-data')}>
                <SelectTrigger className="h-11 w-full rounded-2xl bg-card border-border/80 font-extrabold text-xs shadow-sm">
                  <SelectValue>{reportTypeLabels[reportType] || reportTypeLabels['raw-data']}</SelectValue>
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-border shadow-xl">
                  <SelectItem value="raw-data" className="text-xs font-bold cursor-pointer">{t('Laporan Data Historis')}</SelectItem>
                  <SelectItem value="analysis" className="text-xs font-bold cursor-pointer">{t('Interpretasi dan Analisis')}</SelectItem>
                  <SelectItem value="maintenance" className="text-xs font-bold cursor-pointer">{t('Laporan Pemeliharaan')}</SelectItem>
                  <SelectItem value="system-logs" className="text-xs font-bold cursor-pointer">{t('Log Aktivitas Sistem')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 2. Pilih Perangkat (Node) */}
            {reportType !== 'system-logs' ? (
              <div className="space-y-2">
                <Label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Radio size={13} />
                  {t('Pilih Perangkat (Node)')}
                </Label>
                <Select value={selectedNode} onValueChange={(v) => setSelectedNode(v || 'all')}>
                  <SelectTrigger className="h-11 w-full rounded-2xl bg-card border-border/80 font-extrabold text-xs shadow-sm">
                    <SelectValue>{selectedNodeLabel}</SelectValue>
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-border shadow-xl">
                    <SelectItem value="all" className="text-xs font-bold cursor-pointer">{t('Semua Node')}</SelectItem>
                    {nodes.map(node => (
                      <SelectItem key={node.id} value={node.device_code || node.name || node.id} className="text-xs font-bold uppercase cursor-pointer">
                        {node.name || node.device_code || node.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2 opacity-50">
                <Label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Radio size={13} />
                  {t('Pilih Perangkat (Node)')}
                </Label>
                <div className="h-11 px-4 rounded-2xl bg-muted/50 border border-border/60 font-bold text-xs flex items-center text-muted-foreground">
                  {t('Seluruh Sistem')}
                </div>
              </div>
            )}

            {/* 3. Rentang Waktu */}
            <div className="space-y-2">
              <Label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <CalendarIcon size={13} />
                {t('Rentang Waktu')}
              </Label>
              <Popover>
                <PopoverTrigger>
                  <div className="w-full h-11 px-4 rounded-2xl bg-card border border-border/80 font-extrabold text-xs flex items-center justify-start text-left shadow-sm gap-2 cursor-pointer hover:bg-muted/50 transition-colors">
                    <CalendarIcon size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="truncate">
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, "dd MMM yyyy", { locale: id })} -{" "}
                            {format(dateRange.to, "dd MMM yyyy", { locale: id })}
                          </>
                        ) : (
                          format(dateRange.from, "dd MMM yyyy", { locale: id })
                        )
                      ) : (
                        <span>{t('Pilih rentang tanggal')}</span>
                      )}
                    </span>
                  </div>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-2xl border-border shadow-2xl" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange as any}
                    onSelect={setDateRange as any}
                    numberOfMonths={2}
                    className="rounded-2xl p-3"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* 4. Format Berkas Luaran */}
            <div className="space-y-2">
              <Label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <FileSpreadsheet size={13} />
                {t('Format Berkas Luaran')}
              </Label>
              <div className="grid grid-cols-3 gap-1.5">
                {['pdf', 'excel', 'csv'].map((fmt) => (
                  <Button 
                    key={fmt}
                    variant={fileFormat === fmt ? "default" : "outline"}
                    onClick={() => setFileFormat(fmt)}
                    className={cn(
                      "h-11 rounded-2xl font-extrabold text-xs uppercase transition-all cursor-pointer",
                      fileFormat === fmt ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20" : "border-border/60 hover:bg-muted"
                    )}
                  >
                    {fmt === 'excel' ? 'XLSX' : fmt}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Action Buttons Row */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-border/60">
            <Button 
              variant="outline"
              className="w-full sm:w-auto h-11 px-6 rounded-2xl font-extrabold gap-2 border-border/80 hover:bg-muted text-xs cursor-pointer"
              onClick={handleQuickPreview}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Eye size={16} />
              )}
              {t('Pratinjau Cepat')}
            </Button>
            <Button 
              className="w-full sm:w-auto h-11 px-6 rounded-2xl font-extrabold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20 text-xs cursor-pointer"
              onClick={handleGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Download size={16} />
              )}
              {t('Unduh Laporan')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Preview Table Card (Full Width) */}
      <Card className="bg-card border-border/80 shadow-md rounded-3xl overflow-hidden w-full">
        <CardHeader className="bg-muted/30 border-b border-border/60 p-6 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0 border border-emerald-500/20 shadow-xs">
                <TableProperties size={22} />
              </div>
              <div>
                <CardTitle className="text-base font-black tracking-tight text-foreground flex items-center gap-2">
                  {t('Pratinjau Laporan')}
                </CardTitle>
                <CardDescription className="text-xs font-semibold text-muted-foreground mt-0.5">
                  {t('Pratinjau struktur data untuk jenis laporan:')}{' '}
                  <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-extrabold text-[11px] border border-emerald-500/20">
                    {reportTypeLabels[reportType] || reportTypeLabels['raw-data']}
                  </span>
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="rounded-2xl border border-border/60 overflow-hidden min-h-[220px]">
            <Table className="w-full">
              <TableHeader className="bg-muted/40">
                <TableRow className="border-border/60">
                  {previewData.length > 0 ? (
                    Object.keys(previewData[0]).map((key) => (
                      <TableHead key={key} className="text-[10px] font-black uppercase tracking-wider whitespace-nowrap text-muted-foreground">{key}</TableHead>
                    ))
                  ) : (
                    reportType === 'raw-data' ? (
                      <>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{t('Waktu Telemetry')}</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{t('ID Perangkat')}</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{t('Kode RH Perangkat')}</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{t('Nama Perangkat')}</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{t('Kecepatan Angin (km/h)')}</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{t('Arah Angin (BMKG)')}</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Latitude</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Longitude</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{t('Elevasi (MDPL)')}</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{t('Baterai & Tegangan')}</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">CO2 (PPM)</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">CH4 (PPM)</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">N₂O (PPB)</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{t('Suhu Udara (°C)')}</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{t('Kelembapan Udara (%)')}</TableHead>
                      </>
                    ) : reportType === 'maintenance' ? (
                      <>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{t('ID Perangkat')}</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{t('Kode RH Perangkat')}</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{t('Nama Perangkat')}</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{t('Lahan Induk')}</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{t('Status Node')}</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{t('Baterai & Tegangan')}</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{t('Sinyal RSSI')}</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{t('Firmware')}</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{t('Pembacaan Terakhir')}</TableHead>
                      </>
                    ) : reportType === 'system-logs' ? (
                      <>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{t('ID Log')}</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{t('Stempel Waktu')}</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{t('Pengguna')}</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{t('Aktivitas')}</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{t('Modul Sistem')}</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{t('Status')}</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{t('Alamat IP')}</TableHead>
                      </>
                    ) : (
                      <>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{t('ID Perangkat')}</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{t('Kode RH Perangkat')}</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{t('Nama Perangkat')}</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{t('Lahan Induk')}</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{t('Jumlah Pembacaan')}</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{t('Periode Awal')}</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{t('Periode Akhir')}</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Rata-rata CO2 (PPM)</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Rata-rata CH4 (PPM)</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Rata-rata N₂O (PPB)</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{t('Suhu Udara (°C)')}</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{t('Kelembapan Udara (%)')}</TableHead>
                      </>
                    )
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewData.length > 0 ? (
                  previewData.slice(0, 5).map((reading: any, idx: number) => (
                    <TableRow key={idx} className="border-border/40 hover:bg-muted/30">
                      {Object.values(reading).map((val: any, ci: number) => (
                        <TableCell key={ci} className="text-xs font-semibold whitespace-nowrap text-foreground">
                          {val !== null && val !== undefined ? String(val) : '-'}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground font-medium">
                      {t('Klik "Pratinjau Cepat" untuk melihat data pratinjau.')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Bottom Export Statistics & Document Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-card border-border/80 shadow-md rounded-3xl p-5">
          <div className="flex items-center gap-4">
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0 border border-emerald-500/20 shadow-xs">
              <BarChart3 size={22} />
            </div>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">{t('Total Baris')}</p>
              <h3 className="text-2xl font-black text-foreground">{previewData.length > 0 ? previewData.length : '-'}</h3>
            </div>
            <div className="ml-auto text-right">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">{t('Estimasi Ukuran')}</p>
              <h3 className="text-2xl font-black text-foreground">{estimatedSize}</h3>
            </div>
          </div>
        </Card>

        <Card className="bg-card border-border/80 shadow-md rounded-3xl p-5">
          <div className="flex items-center gap-4">
            <div className="p-3.5 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0 border border-blue-500/20 shadow-xs">
              <ShieldCheck size={22} />
            </div>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">{t('Status Dokumen')}</p>
              <p className="text-xs font-semibold text-muted-foreground mt-0.5 leading-snug">
                {t('Laporan di-generate secara langsung. Tautan unduhan tersedia untuk format CSV, Excel, dan PDF.')}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
