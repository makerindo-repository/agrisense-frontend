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
  Globe,
  Mail,
  Lock,
  Loader2,
  ShieldCheck,
  Sparkles,
  Cpu,
  CheckCircle2,
  Clock
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from 'react-i18next';
import { formatTime, format, id } from '@/utils/formatters';
import { IoTNode, User, UserRole, mockActivityLogs, normalizeNode } from './lib/mockData';
import { cn } from '@/lib/utils';
import { SidebarTooltip } from './components/ui/tooltip';
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
const CommodityView = React.lazy(() => import('./pages/CommodityView'));
import GlossaryView from './pages/GlossaryView';
import AboutView from './pages/AboutView';

const LiveClock = () => {
  const { i18n } = useTranslation();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const locale = i18n.language === 'en' ? 'en-US' : 'id-ID';
  const dateStr = time.toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const hours = time.getHours().toString().padStart(2, '0');
  const minutes = time.getMinutes().toString().padStart(2, '0');
  const seconds = time.getSeconds().toString().padStart(2, '0');

  return (
    <div className="flex flex-col">
      <span className="text-[11px] font-bold text-muted-foreground leading-none mb-1 capitalize">
        {dateStr}
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
  useBmkgTemp?: boolean;
}

const getFullUrl = (path: string | null) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const baseUrl = import.meta.env.VITE_API_URL || '';
  return `${baseUrl}${path}`;
};

export default function App() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const activeView = location.pathname === '/' ? 'dashboard' : location.pathname.substring(1).replace(/\/$/, "");
  const [selectedAnalyticsNode, setSelectedAnalyticsNode] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [user, setUser] = useState<any | null>(() => getStoredUser());
  const [loginEmail, setLoginEmail] = useState(() => localStorage.getItem('agrisense_remember_email') || "");
  const [loginPassword, setLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => !!localStorage.getItem('agrisense_remember_email'));
  const [userRole, setUserRole] = useState<string>(() => getStoredUser()?.role || '');
  const [users, setUsers] = useState<User[]>([]);
  const isInitialLoad = useRef(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [realTimeReadings, setRealTimeReadings] = useState<any[]>([]);
  const [realTimeLogs, setRealTimeLogs] = useState<any[]>([]);
  const [allNodes, setAllNodes] = useState<IoTNode[]>([]);
  const [appStats, setAppStats] = useState({ online: 0, warning: 0, offline: 0, total: 0 });
  const [lastSync, setLastSync] = useState<Date>(new Date());
  const [lastUpdateInfo, setLastUpdateInfo] = useState<{ name: string, id: string, time: string, status: string, detail: string, isWarning: boolean } | null>(null);
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
    notificationEmails: "[]",
    useBmkgTemp: false,
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
          api.get('/readings?limit=5000')
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

        if (resReadings) setRealTimeReadings(resReadings.data);

        if (resNodes && Array.isArray(resNodes.data)) {
          const readingsList = Array.isArray(resReadings?.data?.data) 
            ? resReadings.data.data 
            : (Array.isArray(resReadings?.data) ? resReadings.data : []);
          
          const normalizedNodes = resNodes.data.map((n: any) => {
            const latestR = readingsList.find((r: any) => 
              String(r.device_code || r.device_id || r.deviceId || '') === String(n.device_code || n.id || '')
            );
            const payloadFw = latestR?.firmware_version || latestR?.firmware || latestR?.fw_ver || latestR?.fwVersion;
            if (payloadFw) {
              n.firmware_version = payloadFw;
            }
            return normalizeNode(n);
          });
          setAllNodes(normalizedNodes);
        }

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
            useBmkgTemp: settingsData.useBmkgTemp === '1' || settingsData.useBmkgTemp === true,
          });
        } catch (settingsErr) {
          console.error("Failed to fetch settings:", settingsErr);
        }

        // Update notification info if there are new readings
        if (resReadings && Array.isArray(resReadings.data) && resReadings.data.length > 0) {
          const latest = resReadings.data[0]; // Backend returns desc (newest first)
          const latestId = latest.message_id || latest.id.toString();

          // HANYA TAMPILKAN JIKA ADA PESAN DARI DATASET/BACKEND BARU
          if (latestId !== lastShownId.current) {
            const node = (resNodes && Array.isArray(resNodes.data))
              ? resNodes.data.find((n: any) => n.id === latest.device_id || n.device_code === latest.device_code)
              : null;

            if (node) {
              lastShownId.current = latestId;

              const co2 = latest.carbon_data?.co2_ppm ?? latest.co2_sensor ?? 0;
              const temp = latest.environment?.air_temperature_c ?? latest.air_temperature_sensor ?? 0;
              const hum = latest.environment?.air_humidity_percent ?? latest.air_humidity_sensor ?? 0;

              const co2Exceeded = co2 > settings.co2Threshold;
              const tempExceeded = temp > settings.tempMax;
              const humExceeded = hum < settings.humidityMin;

              const isWarning = co2Exceeded || tempExceeded || humExceeded;

              let detail = `Suhu ${temp.toFixed(1)}°C • Lembap ${hum.toFixed(0)}%`;
              if (tempExceeded) detail = `Suhu Melampaui Batas (${temp.toFixed(1)}°C)`;
              else if (co2Exceeded) detail = `Kadar CO₂ Tinggi (${co2} ppm)`;
              else if (humExceeded) detail = `Kelembapan Udara Rendah (${hum.toFixed(0)}%)`;

              setLastUpdateInfo({
                name: node.name,
                id: latestId,
                time: formatTime(latest.timestamp),
                status: isWarning ? 'Anomali Terdeteksi' : 'Kondisi Normal',
                detail: detail,
                isWarning: isWarning
              });

              // Sembunyikan otomatis setelah 6 detik
              if (notificationTimeoutMap.current) clearTimeout(notificationTimeoutMap.current);
              notificationTimeoutMap.current = setTimeout(() => {
                setLastUpdateInfo(null);
              }, 6000);
            }
          }
        }

      } catch (err) {
        console.error("Critical: Real-time service encountered an error", err);
      }
    };

    fetchStats();

    const handleNodesUpdated = () => {
      fetchStats();
    };
    window.addEventListener('nodes:updated', handleNodesUpdated);

    // -- ENABLED polling for Real-time Monitoring (Disesuaikan menjadi 30 detik untuk optimasi beban server)
    console.log("Background service started: Polling Laravel API every 30s...");
    const dataRefreshInterval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchStats();
    }, 30000);

    return () => {
      clearInterval(dataRefreshInterval);
      window.removeEventListener('nodes:updated', handleNodesUpdated);
    };
  }, [user]);

  const handleLogin = async () => {
    if (!loginEmail.trim() || !loginPassword) {
      toast.error("Harap isi Email dan Password.");
      return;
    }
    setIsLoggingIn(true);
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

        // Integrasi Fitur Ingat Saya (Remember Me)
        if (rememberMe) {
          localStorage.setItem('agrisense_remember_email', loginEmail.trim());
        } else {
          localStorage.removeItem('agrisense_remember_email');
        }

        setUser(userData);
        setUserRole(userData.role);

        toast.success(`Selamat datang kembali, ${userData.name}!`);
        navigate('/dashboard');
      }
    } catch (err: any) {
      // Keamanan: Pesan error umum untuk mencegah user enumeration.
      toast.error("Email atau Password tidak cocok.");
    } finally {
      setIsLoggingIn(false);
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
        navigate('/dashboard');
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
          { id: 'map', label: 'Peta Node', icon: MapIcon, roles: ['admin', 'operator', 'viewer'] },
          { id: 'sensors', label: 'Data Sensor', icon: Database, roles: ['admin', 'operator', 'viewer'] },
        ]
      },
      {
        title: 'MANAJEMEN',
        items: [
          { id: 'area-management', label: 'Lahan, Kebun, Tanaman', icon: Layers, roles: ['admin', 'operator'] },
          { id: 'commodity', label: 'Komoditi', icon: Sprout, roles: ['admin', 'operator', 'viewer'] },
          { id: 'nodes', label: 'Perangkat', icon: Radio, roles: ['admin', 'operator', 'viewer'] },
          { id: 'users', label: 'Pengguna', icon: Users, roles: ['admin'] },
        ]
      },
      {
        title: 'ANALITIK',
        items: [
          { id: 'bmkg', label: 'Data Klimatologi', icon: CloudSun, roles: ['admin', 'operator', 'viewer'] },
          { id: 'analytics', label: 'Karbon, Tanaman', icon: Leaf, roles: ['admin', 'operator', 'viewer'] },
          { id: 'model-performance', label: 'Performa Model', icon: Brain, roles: ['admin', 'operator'] },
        ]
      },
      {
        title: 'SISTEM',
        items: [
          { id: 'reports', label: 'Laporan', icon: FileText, roles: ['admin', 'operator'] },
          { id: 'logs', label: 'Log Aktivitas', icon: Activity, roles: ['admin', 'operator'] },
          { id: 'settings', label: 'Pengaturan', icon: Settings, roles: ['admin'] },
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
        const battery = Number((node as any).battery_percent ?? (node as any).battery ?? 0);
        if (battery > 0 && battery <= 10) {
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
    <div className="flex-1 flex w-full min-h-[100dvh] font-sans bg-background overflow-hidden">
      {/* Left Hero Section (58% Width on desktop) */}
      <div
        className="hidden lg:flex lg:w-[58%] bg-cover bg-center bg-no-repeat relative border-r border-border flex-col justify-between p-12 overflow-hidden"
        style={{ backgroundImage: 'url("/login-background.webp")' }}
      >
        {/* Sleek Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/55 to-black/30 backdrop-blur-[2px]"></div>

        {/* Top Header Badge & 3 Country Flag Badges */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-2.5 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
            <Leaf size={18} className="text-emerald-400 animate-pulse" />
            <span className="text-white font-bold text-xs tracking-widest uppercase">E-ASIA JOINT RESEARCH</span>
          </div>

          {/* 3 Country Flag Badges with Custom Design */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-xs font-bold text-white shadow-sm">
              <span className="text-sm">🇮🇩</span> <span>Indonesia</span>
            </div>
            <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-xs font-bold text-white shadow-sm">
              <span className="text-sm">🇯🇵</span> <span>Japan</span>
            </div>
            <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-xs font-bold text-white shadow-sm">
              <span className="text-sm">🇹🇭</span> <span>Thailand</span>
            </div>
          </div>
        </div>

        {/* Center Hero Content */}
        <div className="relative z-10 max-w-xl space-y-4 my-auto">
          {/* 2 Separate Badges with Different Designs */}
          <div className="flex flex-wrap gap-2.5 items-center">
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px] font-bold tracking-widest uppercase px-3 py-1.5 rounded-md flex items-center gap-1.5 shadow-sm">
              <Cpu size={13} className="text-emerald-400" /> IoT System
            </Badge>
            <Badge className="bg-sky-500/20 text-sky-300 border-sky-500/40 text-[10px] font-bold tracking-widest uppercase px-3 py-1.5 rounded-md flex items-center gap-1.5 shadow-sm">
              <Brain size={13} className="text-sky-400" /> AI Precision Agriculture
            </Badge>
          </div>
          
          <h1 className="text-4xl font-extrabold text-white tracking-tight leading-tight">
            Sistem Pemantauan IoT dan Intelijen Klimatologi Karbon
          </h1>
          
          <p className="text-sm text-gray-300 font-normal leading-relaxed">
            Platform komprehensif analisis emisi karbon tanah, fluks CO₂/CH₄, serta pemodelan cuaca berbasis kecerdasan buatan untuk keberlanjutan pertanian tropis Indonesia.
          </p>

          {/* Key Feature Highlights (Actual Data Specs) */}
          <div className="grid grid-cols-3 gap-3 pt-4">
            <div className="bg-white/5 border border-white/10 backdrop-blur-md p-3 rounded-lg">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs mb-1">
                <Cpu size={14} /> Auto Sync (30s)
              </div>
              <p className="text-[10px] text-gray-400">Interval Polling 30 Detik</p>
            </div>
            <div className="bg-white/5 border border-white/10 backdrop-blur-md p-3 rounded-lg">
              <div className="flex items-center gap-2 text-sky-400 font-bold text-xs mb-1">
                <Brain size={14} /> AI Forecast
              </div>
              <p className="text-[10px] text-gray-400">SVM, XGBoost, LSTM</p>
            </div>
            <div className="bg-white/5 border border-white/10 backdrop-blur-md p-3 rounded-lg">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs mb-1">
                <CheckCircle2 size={14} /> Verified Standard
              </div>
              <p className="text-[10px] text-gray-400">NEE dan SOC Accounting</p>
            </div>
          </div>
        </div>

        {/* Footer Brand Info */}
        <div className="relative z-10 flex items-center justify-between text-xs text-white/50 border-t border-white/10 pt-4">
          <span>AgriSense Engine v2.4.0</span>
        </div>
      </div>

      {/* Right Login Form Section (42% Width on desktop) */}
      <div className="w-full lg:w-[42%] bg-background flex flex-col justify-between p-6 sm:p-10 overflow-y-auto">
        <div className="w-full max-w-sm mx-auto my-auto py-4">
          
          {/* Header Logos */}
          <div className="text-center mb-8">
            <div className="flex flex-wrap justify-center items-center gap-3 mb-6 p-2.5 bg-muted/30 rounded-xl border border-border/50">
              <img src="/logo-unikom.png" alt="Logo UNIKOM" className="h-7 w-auto object-contain" width={28} height={28} />
              <img src="/Logo_LPDP.png" alt="Logo LPDP" className="h-7 w-auto object-contain" width={56} height={28} />
              <img src="/Logo_Waseda.png" alt="Logo Waseda" className="h-7 w-auto object-contain" width={90} height={28} />
              <img src="/Logo_CMU.png" alt="Logo CMU" className="h-7 w-auto object-contain" width={28} height={28} />
              <img src="/Logo_UTokyo.png" alt="Logo UTokyo" className="h-8 w-auto object-contain" width={32} height={32} />
              <img src="/tutwuri-handayan.png" alt="Logo Kemdikbud" className="h-7 w-auto object-contain" width={26} height={28} />
            </div>
            
            <h2 className="text-xl font-bold tracking-tight text-foreground uppercase">{settings.appName}</h2>
            <p className="text-[11px] font-semibold text-muted-foreground mt-1 tracking-wide">
              Masukkan kredensial Anda untuk mengakses dasbor
            </p>
          </div>

          {/* Login Form */}
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
            {/* Email Field */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground">
                EMAIL
              </Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  autoFocus
                  placeholder="Masukkan email terdaftar..."
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  disabled={isLoggingIn}
                  className="pl-10 h-10 text-xs font-medium bg-background border border-border rounded-lg focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary transition-all"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground">
                  Password
                </Label>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  placeholder="Masukkan kata sandi..."
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  disabled={isLoggingIn}
                  className="pl-10 pr-10 h-10 text-xs font-medium bg-background border border-border rounded-lg focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  tabIndex={-1}
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-foreground focus:outline-none transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 accent-primary rounded border-border cursor-pointer focus:ring-primary"
                />
                <span className="text-xs font-medium text-muted-foreground">Ingat saya</span>
              </label>
              
              <button
                type="button"
                onClick={() => toast.info("Harap hubungi Administrator Sistem AgriSense untuk bantuan reset kata sandi.")}
                className="text-xs font-semibold text-primary hover:underline focus:outline-none"
              >
                Lupa Password?
              </button>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isLoggingIn}
              className="w-full h-10 text-xs font-bold tracking-widest rounded-lg shadow-sm hover:shadow-md transition-all mt-4 uppercase flex items-center justify-center gap-2"
            >
              {isLoggingIn ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('Memverifikasi...')}</span>
                </>
              ) : (
                <>
                  <LogIn size={15} />
                  <span>{t('Masuk Sistem')}</span>
                </>
              )}
            </Button>

            {/* Divider */}
            <div className="flex items-center my-4">
              <div className="flex-1 border-t border-border/80"></div>
              <span className="px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Atau</span>
              <div className="flex-1 border-t border-border/80"></div>
            </div>

            {/* Google OAuth Login Button Container */}
            <div className="w-full flex justify-center overflow-hidden">
              <GoogleLogin
                onSuccess={handleGoogleCredential}
                onError={() => {
                  console.error('Google Login Component Error');
                  toast.error('Gagal terhubung dengan layanan Google. Coba refresh halaman.');
                }}
                theme="outline"
                size="large"
                shape="rectangular"
                width="300"
                text="signin_with"
              />
            </div>
          </form>

          {/* Footer Copyright */}
          <div className="mt-8 border-t border-border/80 pt-4 text-center">
            <p className="text-[10px] text-muted-foreground font-semibold tracking-wider">
              © 2026 Universitas Komputer Indonesia. All rights reserved.
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
        animate={{ width: isSidebarOpen ? 280 : 76 }}
        className={cn(
          "bg-sidebar border-r border-sidebar-border flex flex-col z-50 shrink-0 h-full min-h-0 transition-all duration-300 shadow-sm select-none",
          "absolute md:relative inset-y-0 left-0",
          !isSidebarOpen ? "-translate-x-full md:translate-x-0" : "translate-x-0"
        )}
      >
        {/* Brand Header: Centered Alignment (Center-Center) + Unclipped Fresh Logo + Floating Leaf Animations */}
        <div className="py-5 px-3 border-b border-sidebar-border shrink-0 flex items-center justify-center relative min-h-[5.5rem]">
          {/* Floating Leaf Particles Micro-Animations */}
          {isSidebarOpen && (
            <>
              <motion.div
                animate={{
                  y: [0, -6, 0, -4, 0],
                  x: [0, 4, -3, 3, 0],
                  rotate: [0, 15, -10, 8, 0],
                  opacity: [0.2, 0.6, 0.25, 0.5, 0.2]
                }}
                transition={{
                  duration: 6,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="absolute right-3 top-2.5 pointer-events-none text-emerald-500/40 dark:text-emerald-400/30"
              >
                <Leaf size={14} />
              </motion.div>
              <motion.div
                animate={{
                  y: [0, 5, 0, -5, 0],
                  x: [0, -5, 4, -2, 0],
                  rotate: [0, -20, 12, -8, 0],
                  opacity: [0.15, 0.5, 0.2, 0.45, 0.15]
                }}
                transition={{
                  duration: 8,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 1.5
                }}
                className="absolute left-3 bottom-2 pointer-events-none text-teal-500/35 dark:text-teal-400/30"
              >
                <Leaf size={12} />
              </motion.div>
            </>
          )}

          <SidebarTooltip
            content={t("AgriSense • IoT dan Intelijen Klimatologi")}
            side="right"
            disabled={isSidebarOpen}
          >
            <div className={cn(
              "flex items-center w-full cursor-pointer select-none relative z-10 transition-all duration-300",
              isSidebarOpen ? "flex-col justify-center text-center px-1" : "justify-center"
            )}>
              {/* Ultra Fresh Vector Logo Icon (100% Unclipped Hover Animation) */}
              <motion.div
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.95 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 text-white shrink-0 shadow-lg shadow-emerald-500/25 ring-2 ring-emerald-500/20 cursor-pointer"
              >
                <Sprout size={26} className="drop-shadow-md text-white" />
              </motion.div>

              {isSidebarOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 350, damping: 25 }}
                  className="flex flex-col items-center justify-center text-center w-full mt-2"
                >
                  <motion.span
                    className="font-extrabold text-base tracking-tight leading-none text-foreground text-center"
                    whileHover={{ scale: 1.02 }}
                  >
                    AgriSense
                  </motion.span>
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 leading-tight mt-1 text-center whitespace-normal max-w-[210px]">
                    {t('IoT dan Intelijen Klimatologi')}
                  </span>
                </motion.div>
              )}
            </div>
          </SidebarTooltip>
        </div>

        {/* Navigation Menu */}
        <nav className={cn("flex-1 overflow-y-auto overflow-x-hidden py-4 space-y-5 scrollbar-thin", isSidebarOpen ? "px-3" : "px-2")}>
          {menuGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              {isSidebarOpen && (
                <p className="px-3 text-[10px] font-extrabold text-muted-foreground/70 uppercase tracking-widest mb-1.5">
                  {t(group.title)}
                </p>
              )}
              {group.items.map((item) => {
                const isActive = activeView === item.id;
                return (
                  <SidebarTooltip
                    key={item.id}
                    content={t(item.label)}
                    side="right"
                    disabled={isSidebarOpen}
                  >
                    <button
                      onClick={() => navigate(`/${item.id}`)}
                      className={cn(
                        "flex items-center transition-all duration-200 group focus:outline-none relative select-none",
                        isSidebarOpen
                          ? "w-full py-2.5 px-3 rounded-lg gap-3"
                          : "w-[44px] h-[44px] justify-center mx-auto rounded-xl",
                        isActive
                          ? isSidebarOpen
                            ? "bg-primary/10 text-primary font-bold shadow-xs border-l-4 border-primary pl-2.5"
                            : "bg-primary text-primary-foreground font-bold shadow-md scale-105"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <item.icon
                        size={19}
                        className={cn(
                          "shrink-0 transition-transform duration-200 group-hover:scale-110",
                          isActive
                            ? isSidebarOpen
                              ? "text-primary"
                              : "text-primary-foreground"
                            : "text-muted-foreground group-hover:text-foreground"
                        )}
                      />
                      {isSidebarOpen && (
                        <motion.span
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="text-xs truncate text-left font-medium"
                        >
                          {t(item.label)}
                        </motion.span>
                      )}
                    </button>
                  </SidebarTooltip>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer Section: Live Clock & Logout */}
        <div className="px-3 py-3 border-t border-sidebar-border space-y-2 mt-auto shrink-0 bg-sidebar-accent/20">
          {/* Live Clock Card */}
          {isSidebarOpen ? (
            <div className="p-2.5 rounded-xl bg-card/80 border border-border/50 shadow-xs flex flex-col items-center justify-center text-center">
              <LiveClock />
            </div>
          ) : (
            <SidebarTooltip content="Waktu Realtime Sistem" side="right">
              <div className="w-[44px] h-[36px] mx-auto flex items-center justify-center rounded-lg bg-card/80 border border-border/50 text-[10px] font-bold text-muted-foreground">
                <Clock size={16} />
              </div>
            </SidebarTooltip>
          )}

          {/* Logout Alert Dialog */}
          <AlertDialog>
            <SidebarTooltip content={t("Keluar dari Sistem")} side="right" disabled={isSidebarOpen}>
              <AlertDialogTrigger className={cn(
                "w-full flex items-center gap-2.5 py-2 rounded-lg text-rose-500 hover:bg-rose-500/10 hover:text-rose-600 transition-colors cursor-pointer text-xs font-bold",
                !isSidebarOpen ? "justify-center px-0 h-[40px]" : "px-3"
              )}>
                <LogOut size={18} className="shrink-0" />
                {isSidebarOpen && <span>{t("Keluar")}</span>}
              </AlertDialogTrigger>
            </SidebarTooltip>
            <AlertDialogContent className="sm:max-w-[460px] rounded-[28px] border border-border/80 shadow-2xl p-6 sm:p-7 bg-card gap-0 overflow-hidden">
              <AlertDialogHeader className="flex flex-row items-start gap-4 pb-5 mb-5 border-b border-border/60 space-y-0 text-left">
                <div className="p-3 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shrink-0 shadow-xs">
                  <LogOut size={22} />
                </div>
                <div className="flex flex-col gap-1 pr-6">
                  <AlertDialogTitle className="text-xl font-black tracking-tight text-foreground leading-snug">
                    {t("Konfirmasi Keluar")}
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-xs font-semibold text-muted-foreground leading-relaxed">
                    {t("Apakah Anda yakin ingin keluar dari sistem AgriSense? Anda perlu login kembali untuk mengakses data.")}
                  </AlertDialogDescription>
                </div>
              </AlertDialogHeader>
              <AlertDialogFooter className="mt-2 flex flex-row items-center justify-end gap-3 space-x-0">
                <AlertDialogCancel className="h-11 px-6 rounded-2xl border-border/80 font-extrabold text-xs bg-muted/30 hover:bg-muted transition-all m-0">
                  {t("Batal")}
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleLogout}
                  className="h-11 px-7 rounded-2xl font-black text-xs bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/25 transition-all cursor-pointer m-0"
                >
                  {t("Ya, Keluar")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </motion.aside>

      <main className="flex-1 flex flex-col min-w-0 relative">
        <motion.header
          initial={{ y: -16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="h-16 border-b border-border/80 bg-card/85 backdrop-blur-xl flex items-center justify-between px-4 md:px-6 shrink-0 z-10 sticky top-0 shadow-xs"
        >
          <div className="flex items-center gap-4">
            {/* Breadcrumb & Sidebar Toggle Pill */}
            <div className="flex items-center gap-2 text-muted-foreground">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                title={isSidebarOpen ? "Ciutkan Sidebar" : "Buka Sidebar"}
                className="flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-all cursor-pointer outline-none shadow-xs border border-emerald-500/20"
              >
                {isSidebarOpen ? <LayoutDashboard size={16} /> : <Menu size={16} />}
              </motion.button>
              <ChevronRight size={14} className="text-muted-foreground/50" />
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-card border border-border/60 shadow-xs">
                <span className="text-xs font-extrabold text-foreground tracking-tight">
                  {t(menuItems.find(m => m.id === activeView)?.label || (activeView === 'profile' ? 'Profil Saya' : activeView.replace('-', ' ')))}
                </span>
              </div>
            </div>

            <div className="h-5 w-[1px] bg-border/60 hidden md:block"></div>

            {/* Notification: Interactive Dynamic Island Activity Feed */}
            <div className="hidden md:flex items-center">
              <AnimatePresence mode="wait">
                {lastUpdateInfo && (
                  <motion.div
                    key={lastUpdateInfo.id}
                    initial={{ scale: 0.85, y: -8, opacity: 0 }}
                    animate={{ scale: 1, y: 0, opacity: 1 }}
                    exit={{ scale: 0.85, y: -8, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 450, damping: 28 }}
                    onClick={() => navigate('/nodes')}
                    className={cn(
                      "flex items-center gap-2.5 px-3.5 py-1.5 rounded-full shadow-lg border backdrop-blur-xl cursor-pointer transition-all duration-300 hover:scale-[1.03] active:scale-[0.97]",
                      lastUpdateInfo.isWarning
                        ? "bg-rose-950/90 text-rose-100 border-rose-500/40 shadow-rose-950/30"
                        : "bg-zinc-900/90 text-zinc-100 border-emerald-500/30 shadow-black/30"
                    )}
                  >
                    {/* Pulsing Live Telemetry LED Dot */}
                    <div className="relative flex items-center justify-center shrink-0">
                      <span className={cn(
                        "animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full opacity-75",
                        lastUpdateInfo.isWarning ? "bg-rose-400" : "bg-emerald-400"
                      )}></span>
                      <span className={cn(
                        "relative inline-flex rounded-full h-2 w-2",
                        lastUpdateInfo.isWarning ? "bg-rose-500" : "bg-emerald-500"
                      )}></span>
                    </div>

                    {/* Text Details (100% EYD V Baku) */}
                    <div className="flex items-center gap-2 text-xs truncate">
                      <span className="font-extrabold text-white truncate max-w-[130px]">
                        {lastUpdateInfo.name}
                      </span>
                      <span className="text-zinc-500 text-[10px]">•</span>
                      <span className={cn(
                        "font-extrabold px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider",
                        lastUpdateInfo.isWarning ? "bg-rose-500/30 text-rose-300" : "bg-emerald-500/20 text-emerald-300"
                      )}>
                        {lastUpdateInfo.status}
                      </span>
                      <span className="text-zinc-300 font-semibold text-[11px] truncate max-w-[170px] hidden lg:inline">
                        {lastUpdateInfo.detail}
                      </span>
                      <span className="text-zinc-400 text-[10px] font-medium">{lastUpdateInfo.time}</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Language Switcher Pill Button */}
            <DropdownMenu>
              <DropdownMenuTrigger>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border/70 hover:bg-muted font-extrabold text-xs text-foreground cursor-pointer shadow-xs select-none"
                  title="Pilih Bahasa / Select Language"
                >
                  <Globe size={14} className="text-emerald-500" />
                  <span>{i18n.language === 'en' ? 'EN' : 'ID'}</span>
                </motion.div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40 rounded-2xl border-border shadow-2xl p-1.5">
                <DropdownMenuItem 
                  onClick={() => { i18n.changeLanguage('id'); localStorage.setItem('agrisense_language', 'id'); }} 
                  className={cn("font-bold text-xs rounded-xl cursor-pointer py-2 gap-2.5", i18n.language === 'id' && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-extrabold")}
                >
                  🇮🇩 Bahasa Indonesia
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => { i18n.changeLanguage('en'); localStorage.setItem('agrisense_language', 'en'); }} 
                  className={cn("font-bold text-xs rounded-xl cursor-pointer py-2 gap-2.5", i18n.language === 'en' && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-extrabold")}
                >
                  🇬🇧 English (US)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Notification Popover Bell */}
            <Popover>
              <PopoverTrigger className="relative outline-none cursor-pointer">
                <motion.div
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  className="w-9 h-9 rounded-full bg-muted/50 hover:bg-muted/80 transition-colors flex items-center justify-center border border-border/60 shadow-xs"
                >
                  <Bell size={18} className="text-foreground/80" />
                  {notifications.length > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-500 rounded-full border border-background animate-ping"></span>
                  )}
                  {notifications.length > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-500 rounded-full border border-background"></span>
                  )}
                </motion.div>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[360px] p-0 rounded-2xl shadow-2xl overflow-hidden border-border/80 z-[2000] backdrop-blur-2xl bg-card/95">
                <div className="bg-gradient-to-r from-emerald-500/10 via-card to-card p-4 border-b border-border/60 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Radio size={16} className="text-emerald-500 animate-pulse" />
                    <p className="font-extrabold text-xs tracking-tight text-foreground">{t('Notifikasi Perangkat')}</p>
                  </div>
                  <Badge variant="outline" className="font-extrabold text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                    {notifications.length} {t('Peristiwa')}
                  </Badge>
                </div>
                <div className="max-h-[380px] overflow-y-auto divide-y divide-border/40 scrollbar-thin">
                  {notifications.length === 0 ? (
                    <div className="py-12 px-4 flex flex-col items-center justify-center text-center">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-3 border border-emerald-500/20">
                        <CheckCircle2 size={24} />
                      </div>
                      <p className="text-xs font-extrabold text-foreground">{t('Semua Perangkat Normal')}</p>
                      <p className="text-[10px] text-muted-foreground mt-1 max-w-[200px]">
                        {t('Tidak ada peringatan atau gangguan koneksi pada node sensor IoT saat ini.')}
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col">
                      {notifications.map(n => (
                        <div
                          key={n.id}
                          onClick={() => navigate('/nodes')}
                          className="p-3.5 hover:bg-muted/50 transition-colors flex gap-3 items-start cursor-pointer group relative border-l-4 border-transparent hover:border-emerald-500"
                        >
                          <div className={cn(
                            "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-xs border",
                            n.type === 'error' ? "bg-rose-500/10 text-rose-500 border-rose-500/20" :
                              n.type === 'warning' ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                                "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                          )}>
                            {n.type === 'error' ? <AlertTriangle size={16} className="animate-pulse" /> :
                              n.type === 'warning' ? <AlertTriangle size={16} /> :
                                <Activity size={16} />}
                          </div>
                          <div className="flex flex-col gap-1 flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-extrabold text-foreground group-hover:text-emerald-600 transition-colors truncate">
                                {n.title}
                              </p>
                              <span className="text-[9px] font-semibold text-muted-foreground shrink-0">{n.time}</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">{n.message}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {notifications.length > 0 && (
                  <div className="p-2.5 bg-muted/30 border-t border-border/50 text-center">
                    <button
                      onClick={() => navigate('/nodes')}
                      className="text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      {t('Kelola Semua Perangkat Node')} &rarr;
                    </button>
                  </div>
                )}
              </PopoverContent>
            </Popover>

            <div className="h-6 w-[1px] bg-border/60 mx-1"></div>

            {/* Redesigned User Profile Glassmorphism Pill Card (100% Unclipped Right Side) */}
            <motion.div
              whileHover={{ scale: 1.03, y: -1 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 22 }}
              className="flex items-center gap-3 py-1.5 pl-4 pr-2.5 rounded-full bg-gradient-to-r from-card via-card to-emerald-500/10 hover:to-emerald-500/20 border border-border/80 hover:border-emerald-500/30 transition-all cursor-pointer shadow-xs select-none group shrink-0"
              onClick={() => navigate('/profile')}
              title="Klik untuk lihat profil pengguna"
            >
              <div className="flex flex-col text-right hidden sm:flex leading-tight">
                <div className="flex items-center gap-1.5 justify-end">
                  <span className="text-xs font-extrabold text-foreground group-hover:text-emerald-600 transition-colors">
                    {user?.name || 'Super User'}
                  </span>
                </div>
                <div className="flex items-center justify-end gap-1 mt-0.5">
                  <Badge variant="outline" className="text-[9px] h-3.5 px-1.5 font-extrabold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 rounded-md">
                    {userRole || 'Admin'}
                  </Badge>
                </div>
              </div>

              {/* User Avatar (Zero Right Clipping) */}
              {(user?.profile_photo || user?.photoURL) ? (
                <img
                  src={getFullUrl((user.profile_photo || user.photoURL) as string) || undefined}
                  alt="Avatar"
                  className="w-9 h-9 rounded-full object-cover shadow-sm border-2 border-white dark:border-zinc-800 shrink-0"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 text-white font-extrabold text-xs flex items-center justify-center shadow-md shadow-emerald-500/20 border-2 border-white dark:border-zinc-800 shrink-0">
                  {user?.name ? user.name.charAt(0).toUpperCase() : 'S'}
                </div>
              )}
            </motion.div>
          </div>
        </motion.header>

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

