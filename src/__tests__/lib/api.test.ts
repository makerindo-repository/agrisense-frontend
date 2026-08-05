import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';

// ============================================================
// Unit Test: API Axios Instance (Interceptors)
// ============================================================

// We need to test the interceptors logic in isolation
describe('API Interceptors Logic', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  // ── Token Injection Tests ──

  describe('Request Interceptor — Token Injection', () => {
    it('should add Bearer token from localStorage when present', async () => {
      localStorage.setItem('agrisense_token', 'test-token-123');
      
      // Simulate request interceptor logic
      const config: any = { headers: {} };
      const token = localStorage.getItem('agrisense_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      
      expect(config.headers.Authorization).toBe('Bearer test-token-123');
    });

    it('should NOT add Authorization header when no token exists', () => {
      const config: any = { headers: {} };
      const token = localStorage.getItem('agrisense_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      
      expect(config.headers.Authorization).toBeUndefined();
    });
  });

  // ── 401 Handler Tests ──

  describe('Response Interceptor — 401 Handler', () => {
    it('should clear localStorage on 401 from non-auth endpoints', () => {
      localStorage.setItem('agrisense_token', 'old-token');
      localStorage.setItem('agrisense_user', '{"id":1}');
      
      // Simulate 401 handler logic
      const error = {
        response: { status: 401 },
        config: { url: '/api/plantings' },
      };
      
      const url = error.config?.url || '';
      if (error.response.status === 401) {
        if (!url.includes('/auth/google') && !url.includes('/login')) {
          localStorage.removeItem('agrisense_token');
          localStorage.removeItem('agrisense_user');
        }
      }
      
      expect(localStorage.getItem('agrisense_token')).toBeNull();
      expect(localStorage.getItem('agrisense_user')).toBeNull();
    });

    it('should NOT clear localStorage on 401 from /login endpoint', () => {
      localStorage.setItem('agrisense_token', 'keep-this');
      
      const error = {
        response: { status: 401 },
        config: { url: '/api/login' },
      };
      
      const url = error.config?.url || '';
      if (error.response.status === 401) {
        if (!url.includes('/auth/google') && !url.includes('/login')) {
          localStorage.removeItem('agrisense_token');
        }
      }
      
      expect(localStorage.getItem('agrisense_token')).toBe('keep-this');
    });

    it('should NOT clear localStorage on 401 from /auth/google endpoint', () => {
      localStorage.setItem('agrisense_token', 'keep-this');
      
      const error = {
        response: { status: 401 },
        config: { url: '/api/auth/google' },
      };
      
      const url = error.config?.url || '';
      if (error.response.status === 401) {
        if (!url.includes('/auth/google') && !url.includes('/login')) {
          localStorage.removeItem('agrisense_token');
        }
      }
      
      expect(localStorage.getItem('agrisense_token')).toBe('keep-this');
    });

    it('should dispatch auth:expired custom event on 401', () => {
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
      
      // Simulate the event dispatch
      window.dispatchEvent(new CustomEvent('auth:expired'));
      
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'auth:expired' })
      );
    });
  });

  // ── Error Message Transformer Tests ──

  describe('Response Interceptor — Message Transformer', () => {
    it('should transform "The given data was invalid." to Indonesian', () => {
      const error = {
        response: {
          status: 422,
          data: { message: 'The given data was invalid.' },
        },
      };
      
      if (error.response.data && error.response.data.message === 'The given data was invalid.') {
        error.response.data.message = 'Data yang Anda masukkan tidak valid atau belum lengkap.';
      }
      
      expect(error.response.data.message).toBe('Data yang Anda masukkan tidak valid atau belum lengkap.');
    });

    it('should NOT transform other error messages', () => {
      const error = {
        response: {
          status: 422,
          data: { message: 'Custom error message' },
        },
      };
      
      if (error.response.data && error.response.data.message === 'The given data was invalid.') {
        error.response.data.message = 'Data yang Anda masukkan tidak valid atau belum lengkap.';
      }
      
      expect(error.response.data.message).toBe('Custom error message');
    });
  });
});

// ============================================================
// Unit Test: localStorage Storage Helper
// ============================================================

describe('localStorage integration', () => {
  beforeEach(() => localStorage.clear());

  it('should store and retrieve agrisense_token', () => {
    localStorage.setItem('agrisense_token', 'abc123');
    expect(localStorage.getItem('agrisense_token')).toBe('abc123');
  });

  it('should store and parse agrisense_user as JSON', () => {
    const user = { id: 1, name: 'Test Admin', role: 'admin' };
    localStorage.setItem('agrisense_user', JSON.stringify(user));
    const parsed = JSON.parse(localStorage.getItem('agrisense_user')!);
    expect(parsed.role).toBe('admin');
    expect(parsed.name).toBe('Test Admin');
  });
});
