import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  Radio,
  Database,
  CloudSun,
  Map as MapIcon,
  FileText,
  Settings,
  Users,
  Bell,
  Menu,
  X,
  AlertTriangle,
  Leaf,
  LogIn,
  LogOut,
  Eye,
  EyeOff,
  Activity,
  Layers,
  ChevronRight,
  BookOpen,
  Brain,
  Sprout,
  Globe
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatTime, format, id } from '@/utils/formatters';
import { IoTNode, User, UserRole, mockActivityLogs } from './lib/mockData';
import { cn } from '@/lib/utils';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';


import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import api from './lib/api';
import { getStoredUser } from './lib/storage';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
const AreaManagementView = React.lazy(() => import('./pages/AreaManagementView'));
const NodesView = React.lazy(() => import('./pages/NodesView'));
const DashboardView = React.lazy(() => import('./pages/DashboardView'));
const SensorsView = React.lazy(() => import('./pages/SensorsView'));
const BMKGView = React.lazy(() => import('./pages/BMKGView'));
const MapView = React.lazy(() => import('./pages/MapView'));
const AnalyticsView = React.lazy(() => import('./pages/AnalyticsView'));
const ReportsView = React.lazy(() => import('./pages/ReportsView'));
const ModelPerformanceView = React.lazy(() => import('./pages/ModelPerformanceView'));
const UsersView = React.lazy(() => import('./pages/UsersView'));
const LogsView = React.lazy(() => import('./pages/LogsView'));
const SettingsView = React.lazy(() => import('./pages/SettingsView'));
const ProfileView = React.lazy(() => import('./pages/ProfileView'));
const GlossaryView = React.lazy(() => import('./pages/GlossaryView'));
const CommodityView = React.lazy(() => import('./pages/CommodityView'));
const AboutView = React.lazy(() => import('./pages/AboutView'));

const LiveClock = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  const dayName = days[time.getDay()];
  const date = time.getDate();
  const monthName = months[time.getMonth()];
  const year = time.getFullYear();

  const hours = time.getHours().toString().padStart(2, '0');
  const minutes = time.getMinutes().toString().padStart(2, '0');
  const seconds = time.getSeconds().toString().padStart(2, '0');

  return (
    <div className="flex flex-col">
      <span className="text-[11px] font-bold text-muted-foreground leading-none mb-1">
        {dayName}, {date} {monthName} {year}
      </span>
      <span className="text-sm font-medium tracking-tight text-foreground leading-none">
        {hours}:{minutes}:{seconds}
      </span>
    </div>
  );
};
type View = 'dashboard' | 'area-management' | 'nodes' | 'sensors' | 'bmkg' | 'map' | 'analytics' | 'reports' | 'users' | 'settings' | 'logs' | 'profile' | 'glossary' | 'about' | 'commodity';

export interface SystemSettings {
  appName: string;
  appLogo?: string;
  co2Threshold: number | string;
  tempMax: number | string;
  humidityMin: number | string;
  samplingInterval: number | string;
  mqttUrl: string;
  aiEngineKey: string;
  emailAlert: boolean;
  telegramBot: boolean;
  telegramInviteLink: string;
  notificationEmails: string;
}

const getFullUrl = (path: string | null) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const baseUrl = import.meta.env.VITE_API_URL || '';
  return `${baseUrl}${path}`;
};

import { useTranslation } from 'react-i18next';

export default function App() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const activeView = location.pathname === '/' ? 'dashboard' : location.pathname.substring(1).replace(/\/$/, "");
  const [selectedAnalyticsNode, setSelectedAnalyticsNode] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [user, setUser] = useState<any | null>(() => getStoredUser());
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [userRole, setUserRole] = useState<string>(() => getStoredUser()?.role || '');
  const [users, setUsers] = useState<User[]>([]);
  const isInitialLoad = useRef(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [realTimeReadings, setRealTimeReadings] = useState<any[]>([]);
  const [realTimeLogs, setRealTimeLogs] = useState<any[]>([]);
  const [allNodes, setAllNodes] = useState<IoTNode[]>([]);
  const [appStats, setAppStats] = useState({ online: 0, warning: 0, offline: 0, total: 0 });
  const [lastSync, setLastSync] = useState<Date>(new Date());
  const [lastUpdateInfo, setLastUpdateInfo] = useState<{ name: string, id: string, time: string, status: string } | null>(null);
  const lastShownId = useRef<string>("");
  const notificationTimeoutMap = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleAuthExpired = () => {
      setUser(null);
      setUserRole('');
      toast.error('Sesi Anda telah berakhir, silakan login kembali.', { id: 'auth-expired' });
      navigate('/');
    };

    window.addEventListener('auth:expired', handleAuthExpired);
    return () => {
      window.removeEventListener('auth:expired', handleAuthExpired);
    };
  }, [navigate]);

  useEffect(() => {
    const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
    
    if (!user) {
      // Hanya muat reCAPTCHA di halaman login
      if (siteKey && !document.getElementById('recaptcha-script')) {
        const script = document.createElement('script');
        script.id = 'recaptcha-script';
        script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
        script.async = true;
        document.head.appendChild(script);
      }
    } else {
      // Jika sudah login, bersihkan script dan overlay reCAPTCHA yang nyangkut
      const script = document.getElementById('recaptcha-script');
      if (script) script.remove();
      
      // Hapus badge dan iframe invisible yang memblokir layar (z-index tinggi)
      document.querySelectorAll('.grecaptcha-badge').forEach(el => el.remove());
      document.querySelectorAll('div[style*="z-index: 2000000000"]').forEach(el => el.remove());
    }
  }, [user]);

  const [settings, setSettings] = useState<SystemSettings>({
    appName: "AgriSense",
    appLogo: "/logo_utama.png",
    co2Threshold: 1000,
    tempMax: 35,
    humidityMin: 40,
    samplingInterval: 60,
    mqttUrl: "wss://47236b5730574b438d2e060b7756448f.s1.eu.hivemq.cloud:8884/mqtt",
    aiEngineKey: "", // SECURITY: API Key dihapus dari hardcode, ambil dari .env backend
    emailAlert: true,
    telegramBot: false,
    telegramInviteLink: "",
    notificationEmails: "[]"
  });

  // Background Service for Data Refresh (Polling)
  useEffect(() => {
    if (!user) {
      setIsAuthReady(true);
      return;
    }

    // Initial data load
    setRealTimeLogs(mockActivityLogs);
    setIsAuthReady(true);

    const fetchStats = async () => {
      try {
        const isAdmin = userRole === 'admin';
        const isStaff = userRole === 'admin' || userRole === 'operator';

        // Base endpoints accessible by everyone (admin, operator, viewer)
        const baseEndpoints = [
          api.get('/dashboard/summary'),
          api.get('/nodes'),
          api.get('/readings?limit=1500')
        ];

        if (isStaff) {
          baseEndpoints.push(api.get('/logs'));
        }

        // allSettled (bukan Promise.all): satu endpoint gagal (mis. /logs error
        // transient) tidak lagi membuang data endpoint lain yang sukses — sebelumnya
        // Promise.all menolak SEMUA response begitu satu request gagal, sehingga
        // dashboard/nodes/readings yang sudah berhasil di-fetch pun ikut terbuang
        // dan UI diam-diam berhenti update tanpa pesan error apa pun ke user.
        const results = await Promise.allSettled(baseEndpoints);
        results.forEach((r, i) => {
          if (r.status === 'rejected') {
            console.error(`Polling: request #${i} failed`, r.reason);
          }
        });

        const resStats = results[0].status === 'fulfilled' ? results[0].value : null;
        const resNodes = results[1].status === 'fulfilled' ? results[1].value : null;
        const resReadings = results[2].status === 'fulfilled' ? results[2].value : null;
        const resLogs = (isStaff && results[3]?.status === 'fulfilled') ? results[3].value : null;

        if (resStats) {
          const data = resStats.data;
          if (data.nodes) setAppStats(data.nodes);

          if (data.latest_reading && data.latest_reading.device && isInitialLoad.current) {
            setSelectedAnalyticsNode(data.latest_reading.device.device_code);
            isInitialLoad.current = false;
          }
        }

        if (resNodes && Array.isArray(resNodes.data)) setAllNodes(resNodes.data);
        if (resReadings) setRealTimeReadings(resReadings.data);

        if (isStaff && resLogs) {
          setRealTimeLogs(resLogs.data);
        }

        // "Tersinkron" hanya jika minimal satu endpoint inti berhasil — mencegah
        // timestamp sync terlihat "up to date" padahal semua request gagal total.
        if (resStats || resNodes || resReadings) {
          setLastSync(new Date());
        }

        // Fetch user list only if admin
        if (isAdmin) {
          try {
            const resUsers = await api.get('/users');
            setUsers(resUsers.data);
          } catch (e) { console.error("Failed to fetch users:", e); }
        }

        // Settings fetching with individual catch
        try {
          const resSettings = await api.get('/settings');
          const settingsData = resSettings.data;
          setSettings({
            appName: settingsData.appName,
            appLogo: settingsData.appLogo,
            co2Threshold: parseInt(settingsData.co2Threshold),
            tempMax: parseInt(settingsData.tempMax),
            humidityMin: parseInt(settingsData.humidityMin),
            samplingInterval: parseInt(settingsData.samplingInterval),
            mqttUrl: settingsData.mqttUrl,
            aiEngineKey: settingsData.aiEngineKey,
            emailAlert: settingsData.emailAlert === '1',
            telegramBot: settingsData.telegramBot === '1',
            telegramInviteLink: settingsData.telegramInviteLink || "",
            notificationEmails: settingsData.notificationEmails || "[]",
          });
        } catch (settingsErr) {
          console.error("Failed to fetch settings:", settingsErr);
        }

        // Update notification info if there are new readings
        if (resReadings && Array.isArray(resReadings.data) && resReadings.data.length > 0) {
          const latest = resReadings.data[0]; // Backend returns desc (newest first)
          const latestId = latest.message_id || latest.id.toString();

          // ONLY SHOW IF THIS IS A NEW MESSAGE (Prevents stacking/heaviness)
          if (latestId !== lastShownId.current) {
            const node = (resNodes && Array.isArray(resNodes.data))
              ? resNodes.data.find((n: any) => n.id === latest.device_id || n.device_code === latest.device_code)
              : null;

            if (node) {
              lastShownId.current = latestId;

              const isWarning = (latest.carbon_data?.co2_ppm > settings.co2Threshold) ||
                (latest.environment?.air_temperature_c > settings.tempMax) ||
                (latest.environment?.air_humidity_percent < settings.humidityMin);

              setLastUpdateInfo({
                name: node.name,
                id: latestId,
                time: formatTime(latest.timestamp),
                status: isWarning ? 'MELEWATI AMBANG BATAS' : 'STATUS AMAN'
              });

              // Auto-hide after 5 seconds (Mobile-like notification behavior)
              if (notificationTimeoutMap.current) clearTimeout(notificationTimeoutMap.current);
              notificationTimeoutMap.current = setTimeout(() => {
                setLastUpdateInfo(null);
              }, 5000);
            }
          }
        }

      } catch (err) {
        console.error("Critical: Real-time service encountered an error", err);
      }
    };

    fetchStats();

    // -- ENABLED polling for Real-time Monitoring (Disesuaikan menjadi 30 detik untuk optimasi beban server)
    console.log("Background service started: Polling Laravel API every 30s...");
    const dataRefreshInterval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchStats();
    }, 30000);

    return () => clearInterval(dataRefreshInterval);
  }, [user]);

  const handleLogin = async () => {
    try {
      let recaptchaToken = '';
      const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
      
      if (siteKey && (window as any).grecaptcha) {
        recaptchaToken = await new Promise<string>((resolve) => {
          (window as any).grecaptcha.ready(async () => {
            try {
              const token = await (window as any).grecaptcha.execute(siteKey, { action: 'login' });
              resolve(token);
            } catch (e) {
              console.warn("reCAPTCHA execute failed", e);
              resolve('');
            }
          });
        });
      }

      const response = await api.post('/login', {
        email: loginEmail,
        password: loginPassword,
        recaptcha_token: recaptchaToken
      });

      if (response.data.status === 'success') {
        const { token, user: userData } = response.data;

        // Simpan token dan data user
        localStorage.setItem('agrisense_token', token);
        localStorage.setItem('agrisense_user', JSON.stringify(userData));

        setUser(userData);
        setUserRole(userData.role);

        toast.success(`Selamat datang, ${userData.name}!`);
      }
    } catch (err: any) {
      // Keamanan: Jangan tampilkan pesan error spesifik dari backend (seperti email tidak ditemukan / password salah).
      // Selalu gunakan pesan umum untuk mencegah user enumeration.
      toast.error("Email atau Password salah.");
    }
  };

  const handleGoogleCredential = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) {
      toast.error('Gagal mendapatkan credential dari Google.');
      return;
    }
    try {
      const response = await api.post('/auth/google', {
        token: credentialResponse.credential
      });

      if (response.data.status === 'success') {
        const { token, user: userData } = response.data;

        // Simpan token dan data user
        localStorage.setItem('agrisense_token', token);
        localStorage.setItem('agrisense_user', JSON.stringify(userData));

        setUser(userData);
        setUserRole(userData.role);

        toast.success(`Selamat datang, ${userData.name}!`);
      }
    } catch (err: any) {
      console.error("Google Login Error:", err);
      const message = err.response?.data?.message || "Gagal autentikasi dengan server AgriSense.";
      const debug = err.response?.data?.debug ? ` (${err.response.data.debug})` : "";
      toast.error(message + debug);
    }
  };

  const handleLogout = async () => {
    try {
      await api.post('/logout');
    } catch (e) {
      console.error("Logout backend failed", e);
    }
    setUser(null);
    localStorage.removeItem('agrisense_token');
    localStorage.removeItem('agrisense_user');
    navigate("/");
    toast.info("Anda telah keluar dari sistem.");
  };

  const menuGroups = useMemo(() => {
    const groups = [
      {
        title: 'OPERASIONAL',
        items: [
          { id: 'dashboard', label: 'Dasbor', icon: LayoutDashboard, roles: ['admin', 'operator', 'viewer'] },
          { id: 'sensors', label: 'Data Sensor', icon: Database, roles: ['admin', 'operator', 'viewer'] },
          { id: 'map', label: 'Peta Node', icon: MapIcon, roles: ['admin', 'operator', 'viewer'] },
        ]
      },
      {
        title: 'MANAJEMEN',
        items: [
          { id: 'commodity', label: 'Komoditi', icon: Sprout, roles: ['admin', 'operator', 'viewer'] },
          { id: 'area-management', label: 'Lahan, Kebun & Tanaman', icon: Layers, roles: ['admin', 'operator'] },
          { id: 'nodes', label: 'Perangkat', icon: Radio, roles: ['admin', 'operator', 'viewer'] },
          { id: 'users', label: 'Pengguna', icon: Users, roles: ['admin'] },
        ]
      },
      {
        title: 'ANALITIK',
        items: [
          { id: 'bmkg', label: 'Data Klimatologi', icon: CloudSun, roles: ['admin', 'operator', 'viewer'] },
          { id: 'analytics', label: 'Karbon & Tanaman', icon: Leaf, roles: ['admin', 'operator', 'viewer'] },
          { id: 'model-performance', label: 'Performa Model', icon: Brain, roles: ['admin', 'operator'] },
        ]
      },
      {
        title: 'SISTEM',
        items: [
          { id: 'reports', label: 'Laporan & Ekspor', icon: FileText, roles: ['admin', 'operator'] },
          { id: 'settings', label: 'Pengaturan', icon: Settings, roles: ['admin'] },
          { id: 'logs', label: 'Log Aktivitas', icon: Activity, roles: ['admin', 'operator'] },
        ]
      },
      {
        title: 'BANTUAN',
        items: [
          { id: 'glossary', label: 'Glosarium', icon: BookOpen, roles: ['admin', 'operator', 'viewer'] },
          { id: 'about', label: 'Tentang', icon: Users, roles: ['admin', 'operator', 'viewer'] },
        ]
      }
    ];

    return groups.map(group => ({
      ...group,
      items: group.items.filter(item => item.roles.includes(userRole))
    })).filter(group => group.items.length > 0);
  }, [userRole]);

  // Flattened items for breadcrumb lookup
  const menuItems = useMemo(() => {
    return menuGroups.flatMap(group => group.items);
  }, [menuGroups]);

  // -- NOTIFICATION GENERATOR --
  const notifications = useMemo(() => {
    const notifs: any[] = [];

    // Check nodes status
    allNodes.forEach(node => {
      // Find latest reading for this node to get accurate real server time for the event
      const nodeLatestReading = realTimeReadings.find(r => r.device_id === node.id || r.device_code === (node as any).device_code);
      const serverTime = nodeLatestReading?.timestamp
        ? format(new Date(nodeLatestReading.timestamp), "dd MMM HH:mm", { locale: id })
        : ((node as any).last_seen_at ? format(new Date((node as any).last_seen_at), "dd MMM HH:mm", { locale: id }) : 'Tidak diketahui');

      if (node.status === 'offline') {
        notifs.push({
          id: `offline-${node.id}`,
          title: 'Perangkat Mati',
          message: `Node ${node.name} (${(node as any).device_code}) kehilangan koneksi / mati.`,
          type: 'error',
          time: (node as any).last_seen_at ? format(new Date((node as any).last_seen_at), "dd MMM HH:mm", { locale: id }) : 'Tidak diketahui'
        });
      } else if (node.status === 'warning') {
        // Battery calculation must match NodeTable visual (Mock logic for demonstration)
        const battery = node.id.length % 2 === 0 ? 8 : 45;
        if (battery <= 10) {
          notifs.push({
            id: `battery-${node.id}`,
            title: 'Baterai Sangat Lemah',
            message: `Node ${node.name} (${(node as any).device_code}) mendeteksi daya sisa ${battery}%. Segera jadwalkan pengisian/penggantian baterai.`,
            type: 'error',
            time: serverTime
          });
        } else {
          notifs.push({
            id: `warning-${node.id}`,
            title: 'Perangkat Peringatan',
            message: `Node ${node.name} (${(node as any).device_code}) mendeteksi data lingkungan di luar ambang batas aman.`,
            type: 'warning',
            time: serverTime
          });
        }
      }
    });

    // Check logs for added devices
    realTimeLogs
      .filter(l => l.action?.toLowerCase().includes('tambah') && (l.action?.toLowerCase().includes('node') || l.action?.toLowerCase().includes('perangkat')))
      .slice(0, 5)
      .forEach(log => {
        notifs.push({
          id: log.id,
          title: 'Aktivitas Perangkat Baru',
          message: log.action,
          type: 'info',
          time: format(new Date(log.timestamp), "dd MMM HH:mm", { locale: id })
        });
      });

    return notifs;
  }, [allNodes, realTimeLogs]);

  // -- RENDER LOGIC --
  if (!isAuthReady) {
    return (
      <div className="h-[100dvh] w-full flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-black tracking-widest uppercase opacity-50">Menyiapkan AgriSense...</p>
        </div>
      </div>
    );
  }

  const LoginPage = (
    <div className="flex-1 flex w-full font-sans bg-background overflow-hidden">

      <div
        className="hidden lg:block lg:w-[60%] bg-cover bg-center bg-no-repeat relative border-r-2 border-border"
        style={{ backgroundImage: 'url("/login-background.webp")' }}
      >
        <div className="absolute inset-0 bg-black/40"></div>
        <div className="absolute bottom-6 left-6 flex items-center gap-3 bg-black/60 px-4 py-2 border-l-4 border-primary">
          <Leaf size={20} className="text-primary" />
          <span className="text-white font-bold text-xs tracking-widest uppercase">AGRISENSE ENGINE</span>
        </div>
      </div>

      <div className="w-full lg:w-[40%] bg-background flex flex-col p-8">
        <div className="w-full max-w-sm mx-auto flex-1 flex flex-col justify-center">
          <div className="text-center mb-10">
            <div className="flex flex-wrap justify-center items-center gap-2 mb-10 min-h-[40px]">
              <img src="/logo-unikom.png" alt="Logo UNIKOM" className="h-8 w-auto object-contain" width={32} height={32} />
              <img src="/Logo_LPDP.png" alt="Logo LPDP" className="h-8 w-auto object-contain" width={64} height={32} />
              <img src="/Logo_Waseda.png" alt="Logo Waseda" className="h-8 w-auto object-contain" width={102} height={32} />
              <img src="/Logo_CMU.png" alt="Logo CMU" className="h-8 w-auto object-contain" width={32} height={32} />
              <img src="/Logo_UTokyo.png" alt="Logo UTokyo" className="h-9 w-auto object-contain" width={36} height={36} />
              <img src="/tutwuri-handayan.png" alt="Logo Kemdikbud" className="h-8 w-auto object-contain" width={30} height={32} />
            </div>
            <h1 className="text-lg font-semibold tracking-tighter uppercase">{settings.appName}</h1>
            <p className="text-[10px] font-bold tracking-widest text-muted-foreground mt-2 uppercase">
              Sistem Web Monitoring IoT &Sistem Intelijen Klimatologi
            </p>
          </div>

          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground">Email / Username</Label>
              <div className="relative">
                <Menu className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                <Input
                  id="email"
                  placeholder="Masukkan email..."
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="pl-9 h-10 text-xs font-medium bg-background border-2 border-border rounded-none focus-visible:ring-0 focus-visible:border-primary transition-none"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground">Password</Label>
              <div className="relative">
                <LogIn className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Masukkan password..."
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="pl-9 pr-10 h-10 text-xs font-medium bg-background border-2 border-border rounded-none focus-visible:ring-0 focus-visible:border-primary transition-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-foreground focus:outline-none"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full h-10 text-xs font-black tracking-widest rounded-none shadow-none hover:bg-primary/90 transition-none mt-6 uppercase">
              Masuk Sistem
            </Button>

            <div className="flex items-center my-4">
              <div className="flex-1 border-t-2 border-border"></div>
              <span className="px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Atau</span>
              <div className="flex-1 border-t-2 border-border"></div>
            </div>

            <div className="w-full flex justify-center [&_iframe]:!rounded-none">
              <GoogleLogin
                onSuccess={handleGoogleCredential}
                onError={() => {
                  console.error('Google Login Component Error');
                  toast.error('Gagal terhubung dengan layanan Google. Coba refresh halaman.');
                }}
                theme="outline"
                size="large"
                shape="rectangular"
                width="320"
                text="signin_with"
              />
            </div>
          </form>

          <div className="mt-8 border-t-2 border-border pt-6 text-center">
            <p className="text-[9px] text-muted-foreground font-black tracking-[0.2em] uppercase">
              Tim Riset E-ASIA <br /> Universitas Komputer Indonesia © 2026
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  if (location.pathname === '/login') {
    if (user) return <Navigate to="/dashboard" replace />;
    return LoginPage;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex-1 flex w-full overflow-hidden bg-background text-foreground font-sans min-h-0 relative">

      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <motion.aside
        initial={false}
        animate={{ width: isSidebarOpen ? 280 : 80 }}
        className={cn(
          "bg-sidebar border-r border-sidebar-border flex flex-col z-50 shrink-0 h-full min-h-0 transition-transform duration-300",
          "absolute md:relative inset-y-0 left-0",
          !isSidebarOpen ? "-translate-x-full md:translate-x-0" : "translate-x-0"
        )}
      >
        <div className="min-h-[4rem] py-3 flex flex-col justify-center px-6 border-b border-sidebar-border overflow-hidden">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary text-primary-foreground shrink-0 overflow-hidden shadow-sm">
              {settings.appLogo ? (
                <img src={settings.appLogo} alt="Logo" className="w-full h-full object-cover scale-110" />
              ) : (
                <Leaf size={26} />
              )}
            </div>
            {isSidebarOpen && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <span className="font-medium text-xl tracking-tight leading-none">
                  {settings.appName}
                </span>
              </motion.div>
            )}
          </div>
          {isSidebarOpen && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-1"
            >
              <LiveClock />
            </motion.div>
          )}
        </div>

        <nav className={cn("flex-1 overflow-y-auto overflow-x-hidden py-6 space-y-6 scrollbar-thin", isSidebarOpen ? "px-4" : "px-3")}>
          {menuGroups.map((group) => (
            <div key={group.title} className="space-y-1.5">
              {isSidebarOpen && (
                <p className="px-3 text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest mb-2">
                  {t(group.title)}
                </p>
              )}
              {group.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => navigate(`/${item.id}`)}
                  className={cn(
                    "flex items-center gap-3 rounded-md transition-all duration-200 group focus:outline-none",
                    isSidebarOpen ? "w-full py-3 px-3" : "w-[48px] h-[48px] justify-center mx-auto",
                    activeView === item.id
                      ? "bg-primary text-primary-foreground shadow-sm shadow-primary/10"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <item.icon size={20} className={cn("shrink-0", activeView === item.id ? "" : "text-muted-foreground group-hover:text-foreground")} />
                  {isSidebarOpen && (
                    <motion.span
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="font-medium text-sm text-left"
                    >
                      {t(item.label)}
                    </motion.span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="px-3 pt-3 pb-6 md:pb-3 border-t border-sidebar-border space-y-1 mt-auto shrink-0">
          <AlertDialog>
            <AlertDialogTrigger className={cn(
              "w-full flex items-center gap-3 py-3 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive transition-colors cursor-pointer",
              !isSidebarOpen ? "justify-center px-0" : "px-3"
            )}>
              <LogOut size={20} className="shrink-0" />
              {isSidebarOpen && <span className="text-sm font-medium">Keluar</span>}
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-2xl border-none shadow-2xl">
              <AlertDialogHeader>
                <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mb-2">
                  <LogOut size={24} />
                </div>
                <AlertDialogTitle className="text-xl font-bold">Konfirmasi Keluar</AlertDialogTitle>
                <AlertDialogDescription className="text-muted-foreground">
                  Apakah Anda yakin ingin keluar dari sistem AgriSense? Anda perlu login kembali untuk mengakses data.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-2">
                <AlertDialogCancel className="rounded-xl font-bold">Batal</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleLogout}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl font-bold"
                >
                  Ya, Keluar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-sidebar-accent text-muted-foreground transition-colors"
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </motion.aside>

      <main className="flex-1 flex flex-col min-w-0 relative">
        <header className="h-20 border-b border-border bg-card flex items-center justify-between px-4 md:px-8 shrink-0 z-10">
          <div className="flex items-center gap-6">
            {/* Breadcrumb & System Status */}
            <div className="flex items-center gap-2 text-muted-foreground mr-4">
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                title={isSidebarOpen ? "Tutup Sidebar" : "Buka Sidebar"}
                className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer outline-none focus:ring-2 focus:ring-primary/50"
              >
                {isSidebarOpen ? <LayoutDashboard size={14} /> : <Menu size={14} />}
              </button>
              <ChevronRight size={14} />
              <span className="text-sm font-semibold text-foreground">
                {t(menuItems.find(m => m.id === activeView)?.label || activeView.replace('-', ' '))}
              </span>
            </div>

            <div className="h-6 w-[1px] bg-border hidden md:block"></div>

            {/* Notification: Interactive Vertical Slide Activity Feed */}
            <div className="hidden lg:block overflow-hidden h-10 relative">
              <AnimatePresence mode="wait">
                {lastUpdateInfo && (
                  <motion.div
                    key={lastUpdateInfo.id}
                    initial={{ y: 30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -30, opacity: 0 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="flex flex-col justify-center h-full"
                  >
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <div className="p-1 rounded bg-muted/50">
                        <Activity size={12} className="text-foreground" />
                      </div>
                      <div className="flex flex-col -space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-foreground uppercase tracking-wider">{lastUpdateInfo.name}</span>
                          <span className="text-[9px] font-bold opacity-40">•</span>
                          <span className="text-[9px] font-bold opacity-60">{lastUpdateInfo.time}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={cn(
                            "text-[8px] font-black tracking-[0.15em] uppercase",
                            lastUpdateInfo.status === 'STATUS AMAN' ? "opacity-40" : "text-foreground underline decoration-dotted underline-offset-2"
                          )}>
                            {lastUpdateInfo.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Popover>
              <PopoverTrigger className="relative p-2 rounded-full hover:bg-muted transition-colors outline-none focus:ring-0">
                <Bell size={20} />
                {notifications.length > 0 && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-destructive rounded-full border-2 border-background animate-pulse"></span>
                )}
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[340px] p-0 rounded-2xl shadow-xl overflow-hidden border-border/50 z-[2000]">
                <div className="bg-muted/30 p-4 border-b border-border/50 flex justify-between items-center">
                  <p className="font-black text-[10px] uppercase tracking-[0.2em] text-primary">Notifikasi Perangkat</p>
                  <Badge variant="secondary" className="font-black text-[10px]">{notifications.length}</Badge>
                </div>
                <div className="max-h-[350px] overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="py-10 flex flex-col items-center justify-center opacity-10">
                      <p className="text-[9px] font-black uppercase tracking-[0.2em]">Belum ada aktivitas</p>
                    </div>
                  ) : (
                    <div className="flex flex-col">
                      {notifications.map(n => (
                        <div key={n.id} className="p-4 border-b border-border/30 hover:bg-muted/30 transition-colors flex gap-3 items-start">
                          <div className="shrink-0 mt-0.5">
                            {n.type === 'error' ? <AlertTriangle size={16} className="text-destructive animate-pulse" /> :
                              n.type === 'warning' ? <AlertTriangle size={16} className="text-amber-500" /> :
                                <Activity size={16} className="text-primary" />}
                          </div>
                          <div className="flex flex-col gap-1">
                            <p className="text-[11px] font-black uppercase tracking-wider">{n.title}</p>
                            <p className="text-[10px] text-muted-foreground leading-relaxed">{n.message}</p>
                            <p className="text-[9px] font-bold opacity-40 mt-1">{n.time}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
            <div className="h-8 w-[1px] bg-border mx-2"></div>
            <div
              className="flex items-center gap-3 p-1 rounded-xl cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => navigate('/profile')}
              title="Klik untuk lihat profil"
            >
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold">{user?.name || 'AgriSense User'}</p>
                <p className="text-[10px] text-muted-foreground">{user?.email || 'dev@agrisense.id'}</p>
                <Badge variant="outline" className="text-[9px] h-4 px-1 font-black uppercase tracking-tighter bg-primary/5 text-primary border-primary/20">
                  {userRole}
                </Badge>
              </div>
              {(user?.profile_photo || user?.photoURL) ? (
                <img src={getFullUrl((user.profile_photo || user.photoURL) as string) || undefined} alt="Avatar" className="w-10 h-10 rounded-full border-2 border-black shadow-sm" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-10 h-10 rounded-full border-2 border-black shadow-sm bg-white flex items-center justify-center p-1">
                  <img src="/user.png" alt="Default Avatar" className="w-full h-full object-cover rounded-full" />
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 pb-24 md:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="max-w-7xl mx-auto"
            >
              <React.Suspense fallback={<div className="h-[50vh] w-full flex items-center justify-center"><div className="flex flex-col items-center gap-4"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div><p className="text-[10px] font-black tracking-[0.2em] uppercase text-muted-foreground opacity-50">MEMUAT HALAMAN...</p></div></div>}>
                <Routes location={location}>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<DashboardView stats={appStats} nodes={allNodes} onNavigate={navigate} />} />
                  <Route path="/area-management" element={['admin', 'operator'].includes(userRole) ? <AreaManagementView userRole={userRole} /> : <Navigate to="/dashboard" replace />} />
                  <Route path="/commodity" element={['admin', 'operator', 'viewer'].includes(userRole) ? <CommodityView userRole={userRole} /> : <Navigate to="/dashboard" replace />} />
                  <Route path="/nodes" element={<NodesView nodes={allNodes} userRole={userRole} />} />
                  <Route path="/sensors" element={<SensorsView readings={realTimeReadings} nodes={allNodes} />} />
                  <Route path="/bmkg" element={<BMKGView />} />
                  <Route path="/map" element={<MapView
                    nodes={allNodes}
                    readings={realTimeReadings}
                    onViewAnalytics={(nodeId) => {
                      setSelectedAnalyticsNode(nodeId);
                      navigate('/analytics');
                    }}
                  />} />
                  <Route path="/analytics" element={<AnalyticsView selectedNode={selectedAnalyticsNode} setSelectedNode={setSelectedAnalyticsNode} readings={realTimeReadings} nodes={allNodes} userRole={userRole} />} />
                  <Route path="/reports" element={['admin', 'operator'].includes(userRole) ? <ReportsView /> : <Navigate to="/dashboard" replace />} />
                  <Route path="/model-performance" element={['admin', 'operator'].includes(userRole) ? <ModelPerformanceView nodes={allNodes} /> : <Navigate to="/dashboard" replace />} />
                  <Route path="/users" element={userRole === 'admin' ? <UsersView users={users} setUsers={setUsers} /> : <Navigate to="/dashboard" replace />} />
                  <Route path="/settings" element={userRole === 'admin' ? <SettingsView settings={settings} setSettings={setSettings} userRole={userRole} /> : <Navigate to="/dashboard" replace />} />
                  <Route path="/logs" element={['admin', 'operator'].includes(userRole) ? <LogsView logs={realTimeLogs} /> : <Navigate to="/dashboard" replace />} />
                  <Route path="/profile" element={<ProfileView user={user} userRole={userRole} onUpdateUser={(u: any) => setUser(u)} onNavigateBack={() => navigate(-1)} />} />
                  <Route path="/glossary" element={<GlossaryView userRole={userRole} />} />
                  <Route path="/about" element={<AboutView />} />
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </React.Suspense>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

