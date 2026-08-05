import React, { useState, useMemo } from 'react';
import { 
  Search, Download, LogIn, Radio, Activity, Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateTime } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Kata kunci untuk klasifikasi log
const LOGIN_KEYWORDS = ['login', 'logout', 'masuk', 'keluar', 'autentikasi', 'auth', 'sesi', 'session', 'google'];
const NODE_KEYWORDS = ['node', 'device', 'perangkat', 'sensor', 'iot', 'reading', 'data', 'mqtt', 'firmware', 'mendaftarkan', 'menghapus', 'mengubah'];

function classifyLog(log: any): 'login' | 'node' | 'other' {
  const action = (log.action || '').toLowerCase();
  const module = (log.module || '').toLowerCase();

  if (LOGIN_KEYWORDS.some(k => action.includes(k) || module.includes(k) || module === 'auth' || module === 'login')) {
    return 'login';
  }
  if (NODE_KEYWORDS.some(k => action.includes(k) || module.includes(k) || module === 'node' || module === 'device')) {
    return 'node';
  }
  return 'other';
}

function LogTable({ logs, searchQuery }: { logs: any[], searchQuery: string }) {
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const filteredLogs = useMemo(() => {
    if (!searchQuery) return logs;
    return logs.filter(log => 
      (log.user || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.action || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.module || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, logs]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / itemsPerPage));
  const paginatedLogs = filteredLogs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  React.useEffect(() => { setCurrentPage(1); }, [searchQuery, logs, itemsPerPage]);

  if (filteredLogs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 opacity-30">
        <Activity size={40} className="mb-3" />
        <p className="text-[11px] font-black uppercase tracking-[0.2em]">Belum ada log aktivitas</p>
      </div>
    );
  }

  return (
    <>
    <div className="overflow-x-auto">
      <Table>
        <TableHeader className="bg-muted/30">
          <TableRow>
            <TableHead className="pl-6 py-4 font-black uppercase text-[10px] tracking-widest">Timestamp</TableHead>
            <TableHead className="py-4 font-black uppercase text-[10px] tracking-widest">Pengguna</TableHead>
            <TableHead className="py-4 font-black uppercase text-[10px] tracking-widest">Aktivitas</TableHead>
            <TableHead className="py-4 font-black uppercase text-[10px] tracking-widest">Modul</TableHead>
            <TableHead className="py-4 font-black uppercase text-[10px] tracking-widest">Status</TableHead>
            <TableHead className="pr-6 py-4 font-black uppercase text-[10px] tracking-widest text-right">IP Address</TableHead>
          </TableRow>
        </TableHeader>
      <TableBody>
        {paginatedLogs.map((log) => (
          <TableRow key={log.id} className="hover:bg-muted/20 transition-colors">
            <TableCell className="pl-8 text-xs font-mono text-muted-foreground">
              {formatDateTime(log.timestamp)}
            </TableCell>
            <TableCell className="font-bold text-sm">{log.user}</TableCell>
            <TableCell className="text-sm">{log.action}</TableCell>
            <TableCell>
              <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-tighter">
                {log.module}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge variant="outline" className={cn(
                "font-bold text-[10px] uppercase tracking-tighter px-2 py-0",
                log.status === 'success' ? "bg-emerald-50 text-emerald-600 border-emerald-200" :
                log.status === 'warning' ? "bg-amber-50 text-amber-600 border-amber-200" :
                "bg-rose-50 text-rose-600 border-rose-200"
              )}>
                {log.status}
              </Badge>
            </TableCell>
            <TableCell className="pr-8 text-xs text-muted-foreground font-medium text-right">{log.ip}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    </div>
    {/* Pagination - Always visible */}
    <div className="flex flex-col md:flex-row items-center justify-between px-6 py-4 border-t border-border/50 gap-4">
        <div className="flex items-center gap-4">
          <p className="text-xs text-muted-foreground font-medium">
            Menampilkan {filteredLogs.length > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0}-{Math.min(currentPage * itemsPerPage, filteredLogs.length)} dari {filteredLogs.length} data
          </p>
          <div className="h-4 w-px bg-border hidden sm:block" />
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Baris:</span>
            <Select value={itemsPerPage.toString()} onValueChange={(v) => { setItemsPerPage(parseInt(v || '10')); setCurrentPage(1); }}>
              <SelectTrigger className="h-8 w-[70px] text-xs border-none bg-muted/50 font-semibold rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-md border-none shadow-2xl">
                <SelectItem value="10" className="text-xs font-semibold">10</SelectItem>
                <SelectItem value="15" className="text-xs font-semibold">15</SelectItem>
                <SelectItem value="25" className="text-xs font-semibold">25</SelectItem>
                <SelectItem value="50" className="text-xs font-semibold">50</SelectItem>
                <SelectItem value="100" className="text-xs font-semibold">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button 
            variant="outline" 
            size="sm" 
            disabled={currentPage === 1} 
            onClick={() => setCurrentPage(p => p - 1)} 
            className="h-8 px-3 text-xs font-semibold rounded-lg hover:bg-primary hover:text-primary-foreground transition-all"
          >
            Sebelumnya
          </Button>
          
          <div className="hidden sm:flex items-center mx-2 gap-1">
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
                    "h-8 w-8 text-xs font-semibold rounded-lg p-0 transition-all",
                    currentPage === page ? "shadow-lg shadow-primary/20" : ""
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
            className="h-8 px-3 text-xs font-semibold rounded-lg hover:bg-primary hover:text-primary-foreground transition-all"
          >
            Berikutnya
          </Button>
        </div>
      </div>
    </>
  );
}

export default function LogsView({ logs }: { logs: any[] }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("login");

  // Klasifikasikan logs
  const { loginLogs, nodeLogs } = useMemo(() => {
    const login: any[] = [];
    const node: any[] = [];

    logs.forEach(log => {
      const type = classifyLog(log);
      if (type === 'login') login.push(log);
      else if (type === 'node') node.push(log);
      else {
        // Log yang tidak terklasifikasi masuk ke keduanya
        login.push(log);
        node.push(log);
      }
    });

    return { loginLogs: login, nodeLogs: node };
  }, [logs]);

  const activeLogsList = activeTab === 'login' ? loginLogs : nodeLogs;

  const filteredCount = useMemo(() => {
    if (!searchQuery) return activeLogsList.length;
    return activeLogsList.filter(log => 
      (log.user || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.action || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.module || '').toLowerCase().includes(searchQuery.toLowerCase())
    ).length;
  }, [searchQuery, activeLogsList]);

  const exportLogsToExcel = () => {
    const data = activeLogsList.map(l => ({
      Timestamp: formatDateTime(l.timestamp),
      Pengguna: l.user,
      Aktivitas: l.action,
      Modul: l.module,
      Status: l.status,
      'IP Address': l.ip
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    const sheetName = activeTab === 'login' ? 'Log Login' : 'Log Node';
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, `AgriSense_${sheetName.replace(' ', '_')}.xlsx`);
  };

  const exportLogsToPDF = () => {
    const doc = new jsPDF();
    const title = activeTab === 'login' ? 'Log Aktivitas Login' : 'Log Aktivitas Node';
    doc.text(title + ' - AgriSense', 14, 15);
    
    const tableData = activeLogsList.map(l => [
      formatDateTime(l.timestamp),
      l.user,
      l.action,
      l.module,
      l.status,
      l.ip
    ]);

    autoTable(doc, {
      head: [['Timestamp', 'Pengguna', 'Aktivitas', 'Modul', 'Status', 'IP Address']],
      body: tableData,
      startY: 20,
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129] }
    });

    doc.save(`AgriSense_${title.replace(/ /g, '_')}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Logs Aktivitas</h1>
          <p className="text-muted-foreground">Jejak audit seluruh aktivitas sistem AgriSense</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input 
              placeholder={activeTab === 'login' ? "Cari log login..." : "Cari log node..."} 
              className="pl-10 h-11 bg-card border-none shadow-sm rounded-md font-normal text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Badge variant="outline" className="bg-card font-bold h-11 px-4 rounded-md shadow-sm text-sm hidden md:flex items-center">
            {filteredCount} Entri
          </Badge>
          <DropdownMenu>
            <DropdownMenuTrigger>
              <Button variant="outline" className="h-11 rounded-md font-bold gap-2 bg-card shadow-sm">
                <Download size={18} />
                Export Logs
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-md">
              <DropdownMenuItem onClick={exportLogsToExcel} className="font-medium cursor-pointer">
                Export ke Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportLogsToPDF} className="font-medium cursor-pointer">
                Export ke PDF (.pdf)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tab Switcher - CENTERED ABOVE TABLE */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col">
        <div className="flex justify-center mb-2">
          <TabsList className="bg-muted/50 p-1.5 rounded-lg h-14 shadow-sm border border-border/30">
            <TabsTrigger 
              value="login" 
              className="rounded-md font-bold px-8 py-2.5 text-sm data-[state=active]:bg-card data-[state=active]:shadow-sm gap-2 transition-all flex-1 md:flex-none"
            >
              Log Login
              <Badge variant="secondary" className="text-[9px] font-black ml-1 px-1.5 h-4">{loginLogs.length}</Badge>
            </TabsTrigger>
            <TabsTrigger 
              value="node" 
              className="rounded-md font-bold px-8 py-2.5 text-sm data-[state=active]:bg-card data-[state=active]:shadow-sm gap-2 transition-all flex-1 md:flex-none"
            >
              Log Node
              <Badge variant="secondary" className="text-[9px] font-black ml-1 px-1.5 h-4">{nodeLogs.length}</Badge>
            </TabsTrigger>
          </TabsList>
        </div>

        <Card className="border-none shadow-sm shadow-black/5 overflow-hidden w-full">
          <CardContent className="p-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
              >
                <TabsContent value="login" className="mt-0">
                  <LogTable logs={loginLogs} searchQuery={searchQuery} />
                </TabsContent>
                <TabsContent value="node" className="mt-0">
                  <LogTable logs={nodeLogs} searchQuery={searchQuery} />
                </TabsContent>
              </motion.div>
            </AnimatePresence>
          </CardContent>
        </Card>
      </Tabs>
    </div>
  );
}
