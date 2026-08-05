import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SensorsView from '../../pages/SensorsView';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  })
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="recharts-container">{children}</div>,
  LineChart: () => <div />,
  Line: () => <div />,
  AreaChart: () => <div />,
  Area: () => <div />,
  ScatterChart: () => <div />,
  Scatter: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  ZAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
  Legend: () => <div />
}));

vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>
  },
  AnimatePresence: ({ children }: any) => <>{children}</>
}));

const mockNodes = [
  { id: 1, device_id: 'DEV-001', device_name: 'Node Alpha', device_status: 'online' }
];

const mockReadings = [
  { id: 1, device_id: 'DEV-001', created_at: '2026-07-06T12:00:00Z', air_temperature_sensor: 25, air_humidity_sensor: 60 }
];

describe('SensorsView', () => {
  it('renders correctly', async () => {
    render(<SensorsView readings={mockReadings} nodes={mockNodes} />);

    // Wait for the UI to settle
    await waitFor(() => {
      expect(screen.getByText('Data Sensor')).toBeInTheDocument();
    });
  });
});
