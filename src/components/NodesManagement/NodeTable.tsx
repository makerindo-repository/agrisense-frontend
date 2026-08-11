import React from 'react';
import { useTranslation } from 'react-i18next';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, Search, Wind } from 'lucide-react';
import { IoTNode, formatEYDDeviceName } from '../../lib/mockData';

export interface NodeTableProps {
  nodes: IoTNode[];
  onEdit: (node: IoTNode) => void;
  onDelete: (dbId: number) => void;
  userRole?: string;
}

const NodeTable = React.memo(({ nodes, onEdit, onDelete, userRole }: NodeTableProps) => {
  const { t } = useTranslation();

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow className="hover:bg-transparent border-b border-border">
            <TableHead className="py-3 pl-6 font-bold text-xs uppercase tracking-wider text-muted-foreground">{t('ID Perangkat')}</TableHead>
            <TableHead className="py-3 font-bold text-xs uppercase tracking-wider text-muted-foreground">{t('Kode / Nomor Seri (RH)')}</TableHead>
            <TableHead className="py-3 font-bold text-xs uppercase tracking-wider text-muted-foreground">{t('Nama Perangkat')}</TableHead>
            <TableHead className="py-3 font-bold text-xs uppercase tracking-wider text-muted-foreground">{t('Lokasi')}</TableHead>
            <TableHead className="py-3 font-bold text-xs uppercase tracking-wider text-muted-foreground">{t('Latitude')}</TableHead>
            <TableHead className="py-3 font-bold text-xs uppercase tracking-wider text-muted-foreground">{t('Longitude')}</TableHead>
            <TableHead className="py-3 font-bold text-xs uppercase tracking-wider text-muted-foreground">{t('Kecepatan Angin')}</TableHead>
            <TableHead className="py-3 font-bold text-xs uppercase tracking-wider text-muted-foreground">{t('Status')}</TableHead>
            <TableHead className="py-3 font-bold text-xs uppercase tracking-wider text-muted-foreground">{t('Baterai')}</TableHead>
            <TableHead className="py-3 font-bold text-xs uppercase tracking-wider text-muted-foreground">{t('Sinyal')}</TableHead>
            {userRole !== 'viewer' && (
              <TableHead className="py-3 pr-6 font-bold text-xs uppercase tracking-wider text-muted-foreground text-right">{t('Aksi')}</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {nodes.length > 0 ? (
            nodes.map((node) => {
              const rawCode = (node as any).device_code || (node as any).code || node.id;
              const dbId = (node as any).db_id || node.id;

              return (
                <TableRow key={node.id} className="hover:bg-muted/20 transition-colors border-b border-border/50">
                  <TableCell className="text-sm font-bold py-3 pl-6 text-foreground">{dbId}</TableCell>
                  <TableCell className="py-3 whitespace-nowrap">
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-black text-xs px-2.5 py-0.5 rounded-full">
                      {rawCode}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm font-bold py-3 text-foreground whitespace-nowrap">{formatEYDDeviceName(node.name, rawCode)}</TableCell>
                  <TableCell className="text-sm font-medium py-3 text-muted-foreground whitespace-nowrap">{node.location}</TableCell>
                  <TableCell className="text-sm font-mono font-semibold py-3 text-muted-foreground whitespace-nowrap">
                    {node.coords?.[0]?.toFixed(6) ?? '-'}
                  </TableCell>
                  <TableCell className="text-sm font-mono font-semibold py-3 text-muted-foreground whitespace-nowrap">
                    {node.coords?.[1]?.toFixed(6) ?? '-'}
                  </TableCell>
                  <TableCell className="py-3 whitespace-nowrap">
                    <div className={`flex items-center gap-1.5 ${node.status === 'offline' ? 'opacity-30 grayscale' : ''}`}>
                      <Wind size={14} className="text-sky-500 shrink-0" />
                      <span className="text-sm font-semibold text-muted-foreground">
                        {node.wind_speed ? `${node.wind_speed} km/h` : '- km/h'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3 whitespace-nowrap">
                    <Badge 
                      variant={node.status === 'online' ? 'default' : node.status === 'warning' ? 'outline' : 'destructive'} 
                      className="capitalize text-xs font-black px-3 py-1 rounded-full border-none shadow-xs"
                    >
                      {node.status === 'online' ? t('Aktif') : node.status === 'warning' ? t('Peringatan') : t('Tidak Aktif')}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3 whitespace-nowrap">
                    {(() => {
                      const battery = Math.min(100, Math.max(0, node.battery_percent ?? node.battery ?? 80));
                      const rawVolt = node.battery_voltage;
                      const voltageStr = rawVolt ? Number(rawVolt).toFixed(2) : (3.2 + (battery / 100) * 1.0).toFixed(2);
                      const isCriticalBat = battery <= 15 && node.status !== 'offline';
                      return (
                        <div className={`flex items-center gap-2 ${node.status === 'offline' ? 'opacity-30 grayscale' : ''}`}>
                          <div className={`w-8 h-4 rounded-sm relative overflow-hidden border ${isCriticalBat ? 'border-destructive bg-destructive/20 animate-pulse' : 'border-border bg-muted'}`}>
                            <div
                              className={`h-full transition-all duration-500 ${isCriticalBat ? 'bg-destructive' : 'bg-emerald-500'}`}
                              style={{ width: `${battery}%` }}
                            />
                          </div>
                          <span className={`text-xs font-bold ${isCriticalBat ? 'text-destructive' : 'text-muted-foreground'}`}>
                            {battery}% <span className="font-semibold text-[11px] text-muted-foreground">({voltageStr}V)</span>
                          </span>
                        </div>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="py-3 whitespace-nowrap">
                    {(() => {
                      const signal = node.rssi ?? -120;
                      const isCriticalSig = signal <= -100 && node.status !== 'offline';
                      return (
                        <div className={`flex items-baseline gap-0.5 ${node.status === 'offline' ? 'opacity-30 grayscale' : ''}`}>
                          <div className={`w-1 h-2 rounded-full ${isCriticalSig ? 'bg-destructive animate-pulse' : 'bg-primary'}`} />
                          <div className={`w-1 h-3 rounded-full ${signal > -100 ? 'bg-primary' : 'bg-muted'}`} />
                          <div className={`w-1 h-4 rounded-full ${signal > -80 ? 'bg-primary' : 'bg-muted'}`} />
                          <span className={`text-xs font-bold ml-1.5 ${isCriticalSig ? 'text-destructive' : 'text-muted-foreground'}`}>{signal} dBm</span>
                        </div>
                      );
                    })()}
                  </TableCell>
                  {userRole !== 'viewer' && (
                    <TableCell className="text-right py-3 pr-6 whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8.5 w-8.5 rounded-xl border-border/80 bg-background hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer shadow-xs transition-all"
                          onClick={() => onEdit(node)}
                          title={t('Edit')}
                        >
                          <Edit size={14} />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8.5 w-8.5 rounded-xl border-rose-200 dark:border-rose-900/60 bg-rose-50/80 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 cursor-pointer shadow-xs transition-all"
                          onClick={() => onDelete(node.db_id as number)}
                          title={t('Hapus')}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })
          ) : (
            <TableRow>
              <TableCell colSpan={11} className="h-40 text-center">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Search size={32} className="opacity-20" />
                  <p className="font-bold text-sm">{t('Tidak ada perangkat yang ditemukan')}</p>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
});

NodeTable.displayName = 'NodeTable';

export default NodeTable;
