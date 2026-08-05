import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, Search } from 'lucide-react';
import { IoTNode } from '../../lib/mockData';

export interface NodeTableProps {
  nodes: IoTNode[];
  onEdit: (node: IoTNode) => void;
  onDelete: (dbId: number) => void;
  userRole?: string;
}

/**
 * NodeTable — Extracted from NodesView.tsx (Phase 2 Decoupling)
 * 
 * Presentational component that renders the device data grid.
 * Receives pre-filtered nodes from the parent.
 * Delegates edit/delete actions back to the parent via callbacks.
 * 
 * @see docs/audit/PHunASE_2_DECOUPLING_PART_2.md
 */
const NodeTable = React.memo(({ nodes, onEdit, onDelete, userRole }: NodeTableProps) => {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow className="hover:bg-transparent border-b border-border">
            {userRole !== 'viewer' && (
              <TableHead className="py-2 pl-6 font-bold text-foreground">ID Perangkat</TableHead>
            )}
            <TableHead className="py-2 font-bold text-foreground">Nama Node</TableHead>
            <TableHead className="py-2 font-bold text-foreground">Lokasi</TableHead>
            <TableHead className="py-2 font-bold text-foreground">Tanaman</TableHead>
            <TableHead className="py-2 font-bold text-foreground">Ketinggian</TableHead>
            <TableHead className="py-2 font-bold text-foreground">Status</TableHead>
            <TableHead className="py-2 font-bold text-foreground">Baterai</TableHead>
            <TableHead className="py-2 font-bold text-foreground">Sinyal</TableHead>
            {userRole !== 'viewer' && (
              <TableHead className="py-2 pr-6 font-bold text-foreground text-right">Aksi</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {nodes.length > 0 ? (
            nodes.map((node) => (
              <TableRow key={node.id} className="hover:bg-muted/20 transition-colors border-b border-border/50">
                {userRole !== 'viewer' && (
                  <TableCell className="text-sm font-medium py-2 pl-6">{node.id}</TableCell>
                )}
                <TableCell className="text-sm font-medium py-2">{node.name}</TableCell>
                <TableCell className="text-sm font-medium py-2">{node.location}</TableCell>
                <TableCell className="text-sm font-medium py-2">
                  {node.plant_name ? (
                    node.plant_name
                  ) : (
                    <span className="text-muted-foreground font-medium italic">Tidak ada</span>
                  )}
                </TableCell>
                <TableCell className="text-sm font-medium py-2">{node.altitude} m</TableCell>
                <TableCell className="py-2">
                  <Badge variant={node.status === 'online' ? 'default' : node.status === 'warning' ? 'outline' : 'destructive'} className="capitalize text-xs px-2.5 py-0.5">
                    {node.status}
                  </Badge>
                </TableCell>
                <TableCell className="py-2">
                  {(() => {
                    // Generate deterministic battery based on node.id or status
                    const battery = node.status === 'offline' ? 0 : node.status === 'warning' ? (node.id.length % 2 === 0 ? 8 : 45) : 85 + (node.id.length % 10);
                    const isCriticalBat = battery <= 10 && node.status !== 'offline';
                    return (
                      <div className={`flex items-center gap-2 ${node.status === 'offline' ? 'opacity-30 grayscale' : ''}`}>
                        <div className={`w-8 h-4 rounded-sm relative overflow-hidden border ${isCriticalBat ? 'border-destructive bg-destructive/20 animate-pulse' : 'border-border bg-muted'}`}>
                          <div
                            className={`h-full transition-all duration-500 ${isCriticalBat ? 'bg-destructive' : 'bg-emerald-500'}`}
                            style={{ width: `${battery}%` }}
                          />
                        </div>
                        <span className={`text-xs font-medium ${isCriticalBat ? 'text-destructive' : 'text-muted-foreground'}`}>{battery}%</span>
                      </div>
                    );
                  })()}
                </TableCell>
                <TableCell className="py-2">
                  {(() => {
                    // Generate deterministic signal based on node.id or status
                    const signal = node.status === 'offline' ? -120 : node.status === 'warning' ? (node.id.length % 3 === 0 ? -105 : -80) : -50 - (node.id.length % 20);
                    const isCriticalSig = signal <= -100 && node.status !== 'offline';
                    return (
                      <div className={`flex items-baseline gap-0.5 ${node.status === 'offline' ? 'opacity-30 grayscale' : ''}`}>
                        <div className={`w-1 h-2 rounded-full ${isCriticalSig ? 'bg-destructive animate-pulse' : 'bg-primary'}`} />
                        <div className={`w-1 h-3 rounded-full ${signal > -100 ? 'bg-primary' : 'bg-muted'}`} />
                        <div className={`w-1 h-4 rounded-full ${signal > -80 ? 'bg-primary' : 'bg-muted'}`} />
                        <span className={`text-xs font-medium ml-1.5 ${isCriticalSig ? 'text-destructive' : 'text-muted-foreground'}`}>{signal} dBm</span>
                      </div>
                    );
                  })()}
                </TableCell>
                {userRole !== 'viewer' && (
                  <TableCell className="text-right py-2 pr-6">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        size="icon"
                        className="h-8 w-8 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm"
                        onClick={() => onEdit(node)}
                        title="Edit"
                      >
                        <Edit size={15} />
                      </Button>
                      <Button
                        size="icon"
                        className="h-8 w-8 bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-sm"
                        onClick={() => onDelete(node.db_id as number)}
                        title="Hapus"
                      >
                        <Trash2 size={15} />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={8} className="h-40 text-center">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Search size={32} className="opacity-20" />
                  <p>Tidak ada perangkat yang ditemukan</p>
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
