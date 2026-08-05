import React, { useState, useMemo, useEffect } from 'react';
import { 
  LayoutDashboard, Radio, Database, CloudSun, Map as MapIcon, BarChart3, 
  FileText, Settings, Users, Bell, Search, Menu, X, Droplets, Thermometer, 
  Wind, Battery, Signal, AlertTriangle, Leaf, LogIn, LogOut, Calendar as CalendarIcon, 
  FlaskConical, Zap, Activity, Filter, Plus, Save, MoreVertical, Edit, Trash2, 
  Download, CheckCircle2, Eye, EyeOff, Trees, Layers, Sprout, MapPin, SearchIcon, Share2, Map as MapIconS
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { formatFileDateOnly, format, addDays, id } from '@/utils/formatters';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, ScatterChart, Scatter, ZAxis, Legend } from 'recharts';
import { toast } from 'sonner';
import { IoTNode, User, UserRole } from '../lib/mockData';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import api from '../lib/api';

// Map related overrides
import { MapContainer, TileLayer, Marker, Popup, useMap, Polygon, Tooltip as LeafletTooltip } from 'react-leaflet';
import L from 'leaflet';
import LeafletDrawMap, { PolygonDrawResult } from '../components/LeafletDrawMap';

// App specific imports

export default function ReportsView() {
  const [dateRange, setDateRange] = React.useState<{ from: Date; to: Date | undefined }>({
    from: addDays(new Date(), -7),
    to: new Date(),
  });
  const [reportType, setReportType] = React.useState("raw-data");
  const [fileFormat, setFileFormat] = React.useState("pdf");
  const [selectedNode, setSelectedNode] = React.useState("all");
  const [nodes, setNodes] = React.useState<any[]>([]);
  const [previewData, setPreviewData] = React.useState<any[]>([]);
  const [isGenerating, setIsGenerating] = React.useState(false);

  useEffect(() => {
    // Fetch nodes for dropdown using authenticated api
    api.get('/nodes')
      .then(res => {
        if(Array.isArray(res.data)) setNodes(res.data);
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
        toast.success("CSV berhasil diunduh!");
      } else {
        const res = await api.get(url);
        const exportData = res.data.data || [];
        setPreviewData(exportData);

        if (fileFormat === 'excel') {
          const worksheet = XLSX.utils.json_to_sheet(exportData);
          const workbook = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
          XLSX.writeFile(workbook, `${filename}.xlsx`);
          toast.success("Excel berhasil diunduh!");
        } else if (fileFormat === 'pdf') {
          const doc = new jsPDF();
          doc.text(`Laporan AgriSense - ${activeNodeName}`, 14, 15);
          doc.setFontSize(10);
          doc.text(`Periode: ${format(dateRange.from, "dd MMM yyyy", { locale: id })} - ${dateRange.to ? format(dateRange.to, "dd MMM yyyy", { locale: id }) : '-'}`, 14, 22);
          
          if (exportData.length > 0) {
            const head = Object.keys(exportData[0]);
            const body = exportData.map((row: any) => Object.values(row));
            
            autoTable(doc, {
              head: [head],
              body: body,
              startY: 30,
              theme: 'grid',
              headStyles: { fillColor: [16, 185, 129] },
              styles: { fontSize: 8 }
            });
          } else {
            doc.text("Tidak ada data pada periode ini.", 14, 40);
          }
          
          doc.save(`${filename}.pdf`);
          toast.success("PDF berhasil diunduh!");
        }
      }
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Gagal melakukan ekspor data. Pastikan rentang tanggal benar.");
    } finally {
      setIsGenerating(false);
    }
  };

  const estimatedSize = useMemo(() => {
    if (!previewData || previewData.length === 0) return '-';
    // Approx base size in bytes
    const str = JSON.stringify(previewData);
    const bytes = new Blob([str]).size;
    
    // Add overhead multiplier depending on the format
    let multiplier = 1; // csv
    if (fileFormat === 'excel') multiplier = 1.5;
    if (fileFormat === 'pdf') multiplier = 2.0;
    
    const finalBytes = bytes * multiplier;
    
    if (finalBytes < 1024) return `${Math.ceil(finalBytes)} B`;
    if (finalBytes < 1024 * 1024) return `${(finalBytes / 1024).toFixed(1)} KB`;
    return `${(finalBytes / (1024 * 1024)).toFixed(2)} MB`;
  }, [previewData, fileFormat]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Laporan & Ekspor</h1>
          <p className="text-muted-foreground">Pusat dokumentasi dan ekspor data sistem AgriSense</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 border-none shadow-sm shadow-black/5">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Konfigurasi Laporan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Jenis Laporan</Label>
              <Select value={reportType} onValueChange={(v) => setReportType(v || 'raw-data')}>
                <SelectTrigger className="bg-card border-none h-12 rounded-md shadow-md font-semibold text-xs transition-all">
                <SelectValue placeholder="Pilih Jenis Laporan" />
              </SelectTrigger>
              <SelectContent className="rounded-md border-none shadow-2xl min-w-[280px]">
                  <SelectItem value="raw-data" className="font-semibold text-xs">Laporan Data Historis</SelectItem>
                  <SelectItem value="analysis" className="font-semibold text-xs">Interpretasi & Analisis</SelectItem>
                  <SelectItem value="maintenance" className="font-semibold text-xs">Laporan Pemeliharaan</SelectItem>
                  <SelectItem value="system-logs" className="font-semibold text-xs">Log Aktivitas Sistem</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {reportType !== 'system-logs' && (
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Pilih Perangkat (Node)
              </Label>
              <Select value={selectedNode} onValueChange={(v) => setSelectedNode(v || 'all')}>
                <SelectTrigger className="bg-card border-none h-12 rounded-md shadow-md font-semibold text-xs transition-all">
                <SelectValue placeholder="Pilih Node" />
              </SelectTrigger>
              <SelectContent className="rounded-md border-none shadow-2xl min-w-[280px]">
                <SelectItem value="all" className="font-semibold text-xs">Semua Node</SelectItem>
                {nodes.map(node => (
                  <SelectItem key={node.id} value={node.device_code || node.name || node.id} className="font-semibold text-xs uppercase">{node.name || node.device_code || node.id}</SelectItem>
                ))}
                </SelectContent>
              </Select>
            </div>
            )}

            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Rentang Waktu</Label>
              <Popover>
                <PopoverTrigger className="w-full inline-flex items-center justify-start text-left bg-card border-none h-10 rounded-md shadow-md font-semibold text-xs hover:bg-slate-50 transition-all px-4">
                    <img src="https://cdn-icons-png.flaticon.com/512/833/833593.png" alt="calendar" className="w-4 h-4 object-contain opacity-75 mr-2" />
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
                      <span>Pilih rentang tanggal</span>
                    )}
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-md border-none shadow-2xl" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange as any}
                    onSelect={setDateRange as any}
                    numberOfMonths={2}
                    className="rounded-md"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Format File Luaran</Label>
              <div className="grid grid-cols-3 gap-2">
                {['pdf', 'excel', 'csv'].map((format) => (
                  <Button 
                    key={format}
                    variant={fileFormat === format ? "default" : "outline"}
                    onClick={() => setFileFormat(format)}
                    className={cn(
                      "h-10 rounded-md font-bold text-[10px] uppercase transition-all",
                      fileFormat === format ? "shadow-lg shadow-primary/20" : "bg-card border-none shadow-sm hover:bg-slate-50"
                    )}
                  >
                    {format === 'excel' ? 'XLSX' : format}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 mt-4 pb-1">
              <Button 
                variant="outline"
                className="flex-1 h-11 rounded-md font-bold gap-2 bg-muted/50 border-border/50 hover:bg-muted text-xs"
                onClick={async () => {
                  setIsGenerating(true);
                  try {
                    let url = `/reports/export?format=json&type=${reportType}`;
                    if (dateRange.from) url += `&start_date=${format(dateRange.from, 'yyyy-MM-dd')}`;
                    if (dateRange.to) url += `&end_date=${format(dateRange.to, 'yyyy-MM-dd')}`;
                    if (selectedNode !== 'all') url += `&device_id=${selectedNode}`;
                    
                    const res = await api.get(url);
                    setPreviewData(res.data.data || []);
                    toast.success("Pratinjau berhasil dimuat. Silakan cek tabel di sebelah kanan.");
                  } catch (err) {
                    toast.error("Gagal memuat pratinjau. Periksa koneksi atau rentang tanggal.");
                  } finally {
                    setIsGenerating(false);
                  }
                }}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Eye size={16} />
                )}
                Pratinjau Cepat
              </Button>
              <Button 
                className="flex-1 h-11 rounded-md font-bold gap-2 shadow-sm shadow-primary/20 text-xs"
                onClick={handleGenerate}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Download size={16} />
                )}
                Unduh Laporan
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          <Card className="border-none shadow-sm shadow-black/5">
            <CardHeader className="flex flex-row items-center justify-between pt-4">
              <div>
                <CardTitle className="text-lg font-bold">Preview Laporan</CardTitle>
                <CardDescription>Pratinjau struktur data untuk jenis laporan: <span className="text-primary font-bold">{
                  reportType === 'raw-data' ? 'Data Historis' :
                  reportType === 'analysis' ? 'Interpretasi & Analisis' :
                  reportType === 'maintenance' ? 'Pemeliharaan Perangkat' :
                  reportType === 'system-logs' ? 'Log Aktivitas Sistem' : 'Lainnya'
                }</span></CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pb-10">
              <div className="rounded-md border border-border overflow-hidden flex flex-col min-h-[220px]">
                <Table className="flex-1">
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      {previewData.length > 0 ? (
                        Object.keys(previewData[0]).map((key) => (
                          <TableHead key={key} className="text-[10px] font-black uppercase whitespace-nowrap">{key}</TableHead>
                        ))
                      ) : (
                        reportType === 'raw-data' ? (
                          <>
                            <TableHead className="text-[10px] font-black uppercase">Timestamp</TableHead>
                            <TableHead className="text-[10px] font-black uppercase">Node ID</TableHead>
                            <TableHead className="text-[10px] font-black uppercase">CO2 (ppm)</TableHead>
                            <TableHead className="text-[10px] font-black uppercase">CH4 (ppm)</TableHead>
                            <TableHead className="text-[10px] font-black uppercase">Temp (°C)</TableHead>
                          </>
                        ) : reportType === 'maintenance' ? (
                          <>
                            <TableHead className="text-[10px] font-black uppercase">Tanggal</TableHead>
                            <TableHead className="text-[10px] font-black uppercase">Node ID</TableHead>
                            <TableHead className="text-[10px] font-black uppercase">Teknisi</TableHead>
                            <TableHead className="text-[10px] font-black uppercase">Status Hardware</TableHead>
                            <TableHead className="text-[10px] font-black uppercase">Tindakan</TableHead>
                          </>
                        ) : reportType === 'system-logs' ? (
                          <>
                            <TableHead className="text-[10px] font-black uppercase">Waktu</TableHead>
                            <TableHead className="text-[10px] font-black uppercase">User</TableHead>
                            <TableHead className="text-[10px] font-black uppercase">Tindakan</TableHead>
                            <TableHead className="text-[10px] font-black uppercase">Modul</TableHead>
                          </>
                        ) : (
                          <>
                            <TableHead className="text-[10px] font-black uppercase">Periode</TableHead>
                            <TableHead className="text-[10px] font-black uppercase">Node ID</TableHead>
                            <TableHead className="text-[10px] font-black uppercase">Tren Analisis</TableHead>
                            <TableHead className="text-[10px] font-black uppercase">Rekomendasi</TableHead>
                          </>
                        )
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.length > 0 ? (
                      previewData.slice(0, 5).map((reading: any, idx: number) => (
                        <TableRow key={idx}>
                          {Object.values(reading).map((val: any, ci: number) => (
                            <TableCell key={ci} className="text-[10px] font-medium whitespace-nowrap">
                              {val !== null && val !== undefined ? String(val) : '-'}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={reportType === 'raw-data' || reportType === 'maintenance' ? 5 : 4} className="text-center py-6 text-muted-foreground font-medium">Klik "Pratinjau Cepat" untuk melihat data pratinjau.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-none shadow-sm shadow-black/5 bg-card border border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Activity size={16} />
                  Statistik Ekspor
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Total Baris</p>
                    <p className="text-xl font-black">{previewData.length > 0 ? previewData.length : '-'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Estimasi Ukuran</p>
                    <p className="text-xl font-black">{estimatedSize}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-none shadow-sm shadow-black/5 bg-card border border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <FileText size={16} />
                  Status Dokumen
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Laporan akan di-generate secara asinkron. Tautan unduhan akan dikirimkan ke notifikasi sistem setelah proses selesai.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
