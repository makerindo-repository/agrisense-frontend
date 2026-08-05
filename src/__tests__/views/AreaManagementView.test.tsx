import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import AreaManagementView from '../../pages/AreaManagementView';
import api from '../../lib/api';


// Mock react-leaflet because it doesn't work well in JSDOM without canvas
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: any) => <div data-testid="map-container">{children}</div>,
  TileLayer: () => <div />,
  Polygon: () => <div />,
  Tooltip: () => <div />,
  LayersControl: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('react-leaflet', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react-leaflet')>();
    return {
        ...actual,
        MapContainer: ({ children }: any) => <div data-testid="map-container">{children}</div>,
        TileLayer: () => <div />,
        Polygon: () => <div />,
        Tooltip: () => <div />,
        LayersControl: ({ children }: any) => <div>{children}</div>,
    }
});

// Mock LeafletDrawMap
vi.mock('../../components/LeafletDrawMap', () => ({
  default: () => <div data-testid="leaflet-draw-map" />
}));

vi.mock('../../lib/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  }
}));

const mockLandPlots = [
  { id: 1, plot_name: 'Lahan Alpha', area_hectare: 10, latitude: -6.9, longitude: 107.6, gardens: [] }
];

const mockGardens = [
  { id: 1, garden_name: 'Kebun Beta', land_plot_id: 1, area_hectare: 2, latitude: -6.9, longitude: 107.6 }
];

const mockPlantings = [
  { id: 1, nama_tanaman: 'Tanaman Gamma', garden_id: 1, komoditi_id: 1, status_fase: 'Vegetatif' }
];

describe('AreaManagementView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.get as any).mockImplementation((url: string) => {
      if (url === '/land-plots') return Promise.resolve({ data: mockLandPlots });
      if (url === '/gardens') return Promise.resolve({ data: mockGardens });
      if (url === '/plantings') return Promise.resolve({ data: mockPlantings });
      if (url === '/komoditi') return Promise.resolve({ data: [] });
      if (url === '/devices') return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [] });
    });
  });

  it('renders correctly and fetches data', async () => {
    render(<AreaManagementView />);

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Lahan Alpha')).toBeInTheDocument();
    });

    // Check if tabs are rendered
    expect(screen.getByText('Lahan Induk')).toBeInTheDocument();
    expect(screen.getByText('Kebun / Blok')).toBeInTheDocument();
    expect(screen.getByText('Tanaman')).toBeInTheDocument();
  });
});
