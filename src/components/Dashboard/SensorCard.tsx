import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';

export function SensorCard({ title, value, unit, icon: Icon, readings }: any) {
  return (
    <Card className="border-none shadow-sm shadow-black/5 overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Icon size={18} />
          </div>
          <h3 className="font-medium text-sm">{title}</h3>
        </div>
        <div className="flex items-baseline gap-1 mb-4">
          <span className="text-4xl font-semibold tracking-tight">{value}</span>
          <span className="text-lg text-muted-foreground font-medium">{unit}</span>
        </div>
        <div className="h-16 w-full min-h-0 min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={readings}>
              <Area type="monotone" dataKey="value" stroke="var(--color-primary)" fill="var(--color-primary)" fillOpacity={0.1} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
