import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import UsersView from '../../pages/UsersView';

vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>
  },
  AnimatePresence: ({ children }: any) => <>{children}</>
}));

vi.mock('../../lib/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  }
}));

const mockUsers = [
  { id: '1', real_id: 1, name: 'Admin Test', email: 'admin@test.com', role: 'admin', status: 'active', lastLogin: '2026-07-06T12:00:00Z' },
  { id: '2', real_id: 2, name: 'Viewer Test', email: 'viewer@test.com', role: 'viewer', status: 'active', lastLogin: '2026-07-06T12:00:00Z' }
];

describe('UsersView', () => {
  it('renders users list correctly', async () => {
    const setUsersMock = vi.fn();
    render(<UsersView users={mockUsers as any} setUsers={setUsersMock} />);

    // Wait for the UI to settle
    await waitFor(() => {
      expect(screen.getByText('Manajemen Pengguna')).toBeInTheDocument();
      expect(screen.getByText('Admin Test')).toBeInTheDocument();
      expect(screen.getByText('Viewer Test')).toBeInTheDocument();
    });
  });
});
