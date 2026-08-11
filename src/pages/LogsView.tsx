import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, Download, LogIn, Radio, Activity, Filter, RefreshCw, X, ShieldCheck, UserCheck, Clock, CheckCircle2, AlertTriangle, XCircle, History
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateTime } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../lib/api';

// Categorization Keywords
const AUTH_MODULES = ['auth', 'login', 'logout', 'session', 'sesi'];
const DEVICE_MODULES = ['node', 'device', 'perangkat', 'sensor', 'iot', 'reading'];

function classifyLogCategory(log: any): 'auth' | 'device' | 'system' {
  const mod = (log.module || '').toLowerCase();
  const act = (log.action || '').toLowerCase();

  if (AUTH_MODULES.some(k => mod.includes(k) || act.includes(k))) return 'auth';
  if (DEVICE_MODULES.some(k => mod.includes(k) || act.includes(k))) return 'device';
  return 'system';
}

function LogTable({ logs, searchQuery, selectedModule }: { logs: any[], searchQuery: string, selectedModule: string }) {
  const { t } = useTranslation();
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || 
        (log.user || '').toLowerCase().includes(q) ||
        (log.action || '').toLowerCase().includes(q) ||
        (log.module || '').toLowerCase().includes(q) ||
        (log.ip || '').toLowerCase().includes(q);

      const matchesModule = selectedModule === 'ALL' || (log.module || '').toLowerCase() === selectedModule.toLowerCase();
      return matchesSearch && matchesModule;
    });
  }, [searchQuery, selectedModule, logs]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / itemsPerPage));
  const paginatedLogs = filteredLogs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => { setCurrentPage(1); }, [searchQuery, selectedModule, logs, itemsPerPage]);

  if (filteredLogs.length === 0) {
    return (
      <div className="py-16 text-center flex flex-col items-center justify-center border-2 border-dashed border-border/80 rounded-3xl bg-muted/20 p-8 my-4">
        <Activity size={40} className="text-muted-foreground/30 mb-3" />
        <h3 className="font-extrabold text-base text-foreground">{t('Belum ada log aktivitas terdeteksi')}</h3>
        <p className="text-xs text-muted-foreground font-medium max-w-sm mt-1">
          {t('Aktivitas sistem yang terekam akan muncul secara otomatis pada tabel ini.')}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-border/60">
        <Table className="w-full">
          <TableHeader className="bg-muted/40">
            <TableRow className="border-border/60">
              <TableHead className="pl-6 py-3.5 font-black uppercase text-[10px] tracking-widest text-muted-foreground whitespace-nowrap">{t('Stempel Waktu')}</TableHead>
              <TableHead className="py-3.5 font-black uppercase text-[10px] tracking-widest text-muted-foreground whitespace-nowrap">{t('Pengguna')}</TableHead>
              <TableHead className="py-3.5 font-black uppercase text-[10px] tracking-widest text-muted-foreground whitespace-nowrap">{t('Aktivitas')}</TableHead>
              <TableHead className="py-3.5 font-black uppercase text-[10px] tracking-widest text-muted-foreground whitespace-nowrap">{t('Modul Sistem')}</TableHead>
              <TableHead className="py-3.5 font-black uppercase text-[10px] tracking-widest text-muted-foreground whitespace-nowrap">{t('Status')}</TableHead>
              <TableHead className="pr-6 py-3.5 font-black uppercase text-[10px] tracking-widest text-muted-foreground text-right whitespace-nowrap">{t('Alamat IP')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedLogs.map((log, idx) => (
              <TableRow key={log.id || idx} className="hover:bg-muted/30 transition-colors border-border/40">
                <TableCell className="pl-6 text-xs font-mono text-muted-foreground font-bold whitespace-nowrap">
                  {formatDateTime(log.timestamp)}
                </TableCell>
                <TableCell className="font-extrabold text-xs text-foreground whitespace-nowrap">
                  {log.user || 'System'}
                </TableCell>
                <TableCell className="text-xs font-semibold text-foreground max-w-md">
                  {log.action}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <Badge variant="secondary" className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-lg bg-muted text-muted-foreground border border-border/60">
                    {log.module}
                  </Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <Badge variant="outline" className={cn(
                    "font-black text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-lg border",
                    log.status === 'success' ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" :
                    log.status === 'warning' ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" :
                    "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                  )}>
                    {log.status === 'success' ? (
                      <CheckCircle2 size={11} className="mr-1 inline text-emerald-500" />
                    ) : log.status === 'warning' ? (
                      <AlertTriangle size={11} className="mr-1 inline text-amber-500" />
                    ) : (
                      <XCircle size={11} className="mr-1 inline text-rose-500" />
                    )}
                    {log.status || 'success'}
                  </Badge>
                </TableCell>
                <TableCell className="pr-6 text-xs text-muted-foreground font-mono font-bold text-right whitespace-nowrap">
                  {log.ip || '127.0.0.1'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between px-2 pt-4 gap-4">
        <div className="flex items-center gap-3">
          <p className="text-xs text-muted-foreground font-medium">
            {t('Menampilkan')} <span className="font-extrabold text-foreground">{filteredLogs.length > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0}</span>-
            <span className="font-extrabold text-foreground">{Math.min(currentPage * itemsPerPage, filteredLogs.length)}</span> {t('dari')}{' '}
            <span className="font-extrabold text-foreground">{filteredLogs.length}</span> {t('data')}
          </p>
          <div className="h-4 w-px bg-border/60 hidden sm:block" />
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">{t('Baris per Halaman:')}</span>
            <Select value={itemsPerPage.toString()} onValueChange={(v) => { setItemsPerPage(parseInt(v || '10')); setCurrentPage(1); }}>
              <SelectTrigger className="h-8 w-[70px] text-xs border-border/60 bg-card font-extrabold rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border shadow-xl">
                <SelectItem value="10" className="text-xs font-bold">10</SelectItem>
                <SelectItem value="25" className="text-xs font-bold">25</SelectItem>
                <SelectItem value="50" className="text-xs font-bold">50</SelectItem>
                <SelectItem value="100" className="text-xs font-bold">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Button 
            variant="outline" 
            size="sm" 
            disabled={currentPage === 1} 
            onClick={() => setCurrentPage(p => p - 1)} 
            className="h-8 px-3 text-xs font-extrabold rounded-xl border-border/60 hover:bg-emerald-600 hover:text-white transition-all cursor-pointer"
          >
            {t('Sebelumnya')}
          </Button>
          
          <div className="hidden sm:flex items-center gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let page: number;
              if (totalPages <= 5) page = i + 1;
              else if (currentPage <= 3) page = i + 1;
              else if (currentPage >= totalPages - 2) page = totalPages - 4 + i;
              else page = currentPage - 2 + i;
              
              return (
                <Button 
                  key={page} 
                  variant={currentPage === page ? "default" : "outline"} 
                  size="sm" 
                  onClick={() => setCurrentPage(page)} 
                  className={cn(
                    "h-8 w-8 text-xs font-black rounded-xl p-0 transition-all cursor-pointer",
                    currentPage === page ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20" : "border-border/60"
                  )}
                >
                  {page}
                </Button>
              );
            })}
          </div>

          <Button 
            variant="outline" 
            size="sm" 
            disabled={currentPage === totalPages} 
            onClick={() => setCurrentPage(p => p + 1)} 
            className="h-8 px-3 text-xs font-extrabold rounded-xl border-border/60 hover:bg-emerald-600 hover:text-white transition-all cursor-pointer"
          >
            {t('Berikutnya')}
          </Button>
        </div>
      </div>
    </>
  );
}

export default function LogsView({ logs: initialLogs = [] }: { logs?: any[] }) {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<any[]>(initialLogs);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModule, setSelectedModule] = useState("ALL");
  const [activeTab, setActiveTab] = useState("all");

  // Fetch backend logs via GET /api/logs with 8s polling
  const fetchBackendLogs = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/logs');
      if (Array.isArray(res.data)) {
        setLogs(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch activity logs from backend:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBackendLogs();
    const interval = setInterval(fetchBackendLogs, 8000);
    return () => clearInterval(interval);
  }, []);

  // Filter logs by active tab category
  const { allLogs, authLogs, deviceLogs, systemLogs, moduleList } = useMemo(() => {
    const auth: any[] = [];
    const device: any[] = [];
    const system: any[] = [];
    const modulesSet = new Set<string>();

    logs.forEach(log => {
      if (log.module) modulesSet.add(log.module);
      const cat = classifyLogCategory(log);
      if (cat === 'auth') auth.push(log);
      else if (cat === 'device') device.push(log);
      else system.push(log);
    });

    return {
      allLogs: logs,
      authLogs: auth,
      deviceLogs: device,
      systemLogs: system,
      moduleList: Array.from(modulesSet)
    };
  }, [logs]);

  const activeLogsList = useMemo(() => {
    if (activeTab === 'auth') return authLogs;
    if (activeTab === 'device') return deviceLogs;
    if (activeTab === 'system') return systemLogs;
    return allLogs;
  }, [activeTab, allLogs, authLogs, deviceLogs, systemLogs]);

  // Realtime Statistics
  const todayCount = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return logs.filter(l => l.timestamp && l.timestamp.startsWith(today)).length;
  }, [logs]);

  const successRate = useMemo(() => {
    if (logs.length === 0) return 100;
    const successCount = logs.filter(l => l.status === 'success').length;
    return Math.round((successCount / logs.length) * 100);
  }, [logs]);

  // Export handlers
  const exportLogsToExcel = () => {
    const data = activeLogsList.map(l => ({
      'Stempel Waktu': formatDateTime(l.timestamp),
      'Pengguna': l.user || 'System',
      'Aktivitas': l.action,
      'Modul Sistem': l.module,
      'Status': l.status || 'success',
      'Alamat IP': l.ip || '127.0.0.1'
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    const sheetName = activeTab.toUpperCase() + '_LOGS';
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, `AgriSense_Log_Aktivitas_${sheetName}.xlsx`);
  };

  const exportLogsToPDF = () => {
    const doc = new jsPDF();
    doc.text('AgriSense — Rekam Jejak Audit Log Aktivitas', 14, 15);
    
    const tableData = activeLogsList.map(l => [
      formatDateTime(l.timestamp),
      l.user || 'System',
      l.action,
      l.module,
      l.status || 'success',
      l.ip || '127.0.0.1'
    ]);

    autoTable(doc, {
      head: [['Stempel Waktu', 'Pengguna', 'Aktivitas', 'Modul', 'Status', 'Alamat IP']],
      body: tableData,
      startY: 22,
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129] }
    });

    doc.save(`AgriSense_Log_Aktivitas_${activeTab}.pdf`);
  };

  return (
    <div className="w-full space-y-6 max-w-5xl mx-auto pb-24 select-none">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border/60">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20 shadow-xs shrink-0">
            <History size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-foreground">
              {t('Log Aktivitas')}
            </h1>
            <p className="text-xs font-semibold text-muted-foreground mt-0.5">
              {t('Rekam jejak audit seluruh aktivitas pengguna, modul, dan sistem AgriSense')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            onClick={fetchBackendLogs}
            className="rounded-xl font-extrabold h-10 px-4 text-xs gap-1.5 border-border/60 hover:bg-muted cursor-pointer"
            title={t('Refresh Data')}
          >
            <RefreshCw size={14} className={cn(isLoading && "animate-spin")} />
            <span className="hidden sm:inline">{t('Refresh')}</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger>
              <div className="inline-flex items-center justify-center rounded-xl font-extrabold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 px-4 h-10 text-xs cursor-pointer">
                <Download size={15} />
                {t('Ekspor Log')}
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-2xl border-border shadow-2xl p-1.5">
              <DropdownMenuItem onClick={exportLogsToExcel} className="font-extrabold text-xs rounded-xl cursor-pointer py-2.5">
                {t('Ekspor ke Excel (.xlsx)')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportLogsToPDF} className="font-extrabold text-xs rounded-xl cursor-pointer py-2.5">
                {t('Ekspor ke PDF (.pdf)')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border/80 shadow-sm rounded-3xl p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
              <Activity size={18} />
            </div>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">{t('Total Entri Log')}</p>
              <h3 className="text-lg font-black text-foreground">{logs.length}</h3>
            </div>
          </div>
        </Card>

        <Card className="bg-card border-border/80 shadow-sm rounded-3xl p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
              <Clock size={18} />
            </div>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">{t('Aktivitas Hari Ini')}</p>
              <h3 className="text-lg font-black text-foreground">{todayCount}</h3>
            </div>
          </div>
        </Card>

        <Card className="bg-card border-border/80 shadow-sm rounded-3xl p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0">
              <ShieldCheck size={18} />
            </div>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">{t('Keberhasilan Akses')}</p>
              <h3 className="text-lg font-black text-foreground">{successRate}%</h3>
            </div>
          </div>
        </Card>

        <Card className="bg-card border-border/80 shadow-sm rounded-3xl p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
              <UserCheck size={18} />
            </div>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">{t('Modul Aktif')}</p>
              <h3 className="text-lg font-black text-foreground">{moduleList.length}</h3>
            </div>
          </div>
        </Card>
      </div>

      {/* Control Bar: Search & Module Filter Dropdown */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={17} />
          <Input 
            placeholder={t('Cari pengguna, aktivitas, modul, atau IP...')} 
            className="pl-11 pr-10 h-11 bg-card border-border/80 font-extrabold text-xs sm:text-sm rounded-2xl shadow-sm focus-visible:ring-emerald-500/20"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Module Filter Dropdown */}
        <Select value={selectedModule} onValueChange={setSelectedModule}>
          <SelectTrigger className="h-11 w-full sm:w-[220px] rounded-2xl bg-card border-border/80 font-extrabold text-xs sm:text-sm shadow-sm shrink-0 px-4 focus:ring-emerald-500/20">
            <SelectValue placeholder={t('Semua Modul')} />
          </SelectTrigger>
          <SelectContent className="rounded-2xl border-border shadow-xl">
            <SelectItem value="ALL" className="text-xs font-extrabold cursor-pointer">{t('Semua Modul')}</SelectItem>
            {moduleList.map(m => (
              <SelectItem key={m} value={m} className="text-xs font-bold cursor-pointer">{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Categorized Filter Chips */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          onClick={() => setActiveTab("all")}
          className={`px-4 py-2 rounded-2xl text-xs font-extrabold transition-all cursor-pointer border ${
            activeTab === "all" 
              ? "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/25" 
              : "bg-card border-border/70 text-muted-foreground hover:bg-muted"
          }`}
        >
          {t('Semua Log')} ({allLogs.length})
        </button>
        <button
          onClick={() => setActiveTab("auth")}
          className={`px-4 py-2 rounded-2xl text-xs font-extrabold transition-all cursor-pointer border ${
            activeTab === "auth" 
              ? "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/25" 
              : "bg-card border-border/70 text-muted-foreground hover:bg-muted"
          }`}
        >
          {t('Log Autentikasi')} ({authLogs.length})
        </button>
        <button
          onClick={() => setActiveTab("device")}
          className={`px-4 py-2 rounded-2xl text-xs font-extrabold transition-all cursor-pointer border ${
            activeTab === "device" 
              ? "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/25" 
              : "bg-card border-border/70 text-muted-foreground hover:bg-muted"
          }`}
        >
          {t('Log Perangkat dan Telemetri')} ({deviceLogs.length})
        </button>
        <button
          onClick={() => setActiveTab("system")}
          className={`px-4 py-2 rounded-2xl text-xs font-extrabold transition-all cursor-pointer border ${
            activeTab === "system" 
              ? "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/25" 
              : "bg-card border-border/70 text-muted-foreground hover:bg-muted"
          }`}
        >
          {t('Log Sistem dan Modul')} ({systemLogs.length})
        </button>
      </div>

      {/* Main Table Card (Full Width) */}
      <Card className="bg-card border-border/80 shadow-md rounded-3xl overflow-hidden w-full">
        <CardContent className="p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <LogTable logs={activeLogsList} searchQuery={searchQuery} selectedModule={selectedModule} />
            </motion.div>
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
}
