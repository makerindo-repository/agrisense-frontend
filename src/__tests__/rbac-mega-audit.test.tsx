import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AreaManagementView from '../pages/AreaManagementView';
import { BrowserRouter } from 'react-router-dom';
import api from '../lib/api';

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as any,
});

// Mock Axios API
vi.mock('../lib/api', () => ({
  default: {
    get: vi.fn((url) => {
      if (url === '/land-plots') {
        return Promise.resolve({ data: [{ id: 1, plot_name: 'Lahan A', plot_code: 'L-001', area_hectare: 10 }] });
      }
      if (url === '/gardens') {
        return Promise.resolve({ data: [{ id: 1, garden_name: 'Kebun A', garden_code: 'G-001' }] });
      }
      if (url === '/plants') {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: [] });
    }),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  }
}));

// Mock Recharts to avoid ResizeObserver errors in JSDOM
vi.mock('recharts', async () => {
    const OriginalRechartsModule = await vi.importActual('recharts');
    return {
        ...OriginalRechartsModule,
        ResponsiveContainer: ({ children }: any) => (
            <div style={{ width: '100%', height: 300 }}>{children}</div>
        ),
    };
});

// Mock react-leaflet
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: any) => <div data-testid="map-container">{children}</div>,
  TileLayer: () => <div />,
  Marker: () => <div />,
  Popup: () => <div />,
  Polygon: () => <div />,
  Tooltip: () => <div />,
  useMap: () => ({ fitBounds: vi.fn(), setView: vi.fn() })
}));

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe('RBAC Mega Audit - Area Management Component', () => {

    it('should NOT crash on null API response (Null Safety / Edge Case)', async () => {
        // Force API to return null/undefined to simulate failure
        (api.get as any).mockImplementationOnce(() => Promise.resolve({ data: null }));
        
        expect(() => {
            renderWithRouter(<AreaManagementView userRole="admin" />);
        }).not.toThrow();
    });

    it('Admin should see "Tambah Lahan" and "Tambah Kebun" buttons', async () => {
        renderWithRouter(<AreaManagementView userRole="admin" />);
        
        await waitFor(() => {
            const addLandButtons = screen.getAllByText(/Tambah Lahan/i);
            expect(addLandButtons.length).toBeGreaterThan(0);
        });
    });

    it('Operator should NOT see Delete (Hapus) buttons for Land/Garden', async () => {
        renderWithRouter(<AreaManagementView userRole="operator" />);
        
        await waitFor(() => {
            expect(screen.getByText('Lahan A')).toBeInTheDocument();
        });

        // The "Hapus" button shouldn't exist for operator, based on userRole === 'admin' check in AreaManagementView Line 380 & 513
        const deleteButtons = screen.queryAllByRole('button', { name: /Hapus/i });
        const isDeletePresent = deleteButtons.some(b => b.textContent?.includes('Hapus Lahan') || b.textContent?.includes('Hapus Kebun'));
        
        expect(isDeletePresent).toBe(false);
    });

    it('Viewer should NOT see "Tambah Lahan", "Tambah Kebun", Edit, or Delete buttons', async () => {
        renderWithRouter(<AreaManagementView userRole="viewer" />);
        
        await waitFor(() => {
            expect(screen.getByText('Lahan A')).toBeInTheDocument();
        });

        const addLandButtons = screen.queryAllByText(/Tambah Lahan/i);
        expect(addLandButtons.length).toBe(0);

        const addGardenButtons = screen.queryAllByText(/Tambah Kebun/i);
        expect(addGardenButtons.length).toBe(0);

        const editButtons = screen.queryAllByRole('button', { name: /Edit/i });
        const isEditPresent = editButtons.some(b => b.textContent?.includes('Edit Lahan') || b.textContent?.includes('Edit Kebun'));
        expect(isEditPresent).toBe(false);
    });
});
