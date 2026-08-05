import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import DashboardView from '../../pages/DashboardView';
import api from '../../lib/api';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'id' }
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

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: any) => <div data-testid="map-container">{children}</div>,
  TileLayer: () => <div />,
  Marker: () => <div />,
  Popup: () => <div />,
  Polygon: () => <div />,
  Tooltip: () => <div />,
  useMap: () => ({ setView: vi.fn(), fitBounds: vi.fn(), getBounds: vi.fn(), on: vi.fn(), off: vi.fn() })
}));

vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>
  },
  AnimatePresence: ({ children }: any) => <>{children}</>
}));

vi.mock('../../lib/api', () => ({
  default: {
    get: vi.fn(),
  }
}));

const mockStats = { online: 5, warning: 1, offline: 0, total: 6 };
const mockNodes = [
  { id: 1, device_id: 'DEV-001', device_name: 'Node Alpha', device_status: 'online' } as any
];

describe('DashboardView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.get as any).mockImplementation((url: string) => {
      if (url === '/devices') return Promise.resolve({ data: mockNodes });
      if (url === '/plantings') return Promise.resolve({ data: [] });
      if (url === '/land-plots') return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [] });
    });
  });

  it('renders correctly', async () => {
    render(<DashboardView stats={mockStats} nodes={mockNodes} />);

    // Wait for the UI to settle
    await waitFor(() => {
      expect(screen.getByText('Analisis Dasbor')).toBeInTheDocument();
    });
  });
});
