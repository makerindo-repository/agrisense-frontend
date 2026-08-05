import React, { useState, useMemo, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import {
  LayoutDashboard, Radio, Database, CloudSun, Map as MapIcon, BarChart3,
  FileText, Settings, Users, Bell, Search, Menu, X, Droplets, Thermometer,
  Wind, Battery, Signal, AlertTriangle, Leaf, LogIn, LogOut, Calendar as CalendarIcon,
  FlaskConical, Zap, Activity, Filter, Plus, Save, MoreVertical, Edit, Trash2,
  Download, CheckCircle2, Eye, EyeOff, Trees, Layers, Sprout, MapPin, SearchIcon, Share2, Map as MapIconS, Copy, ExternalLink, Globe
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, ScatterChart, Scatter, ZAxis, Legend } from 'recharts';
import { IoTNode, User, UserRole } from '../lib/mockData';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import api from '../lib/api';

// Map related overrides
import { MapContainer, TileLayer, Marker, Popup, useMap, Polygon, Tooltip as LeafletTooltip } from 'react-leaflet';
import L from 'leaflet';
import LeafletDrawMap, { PolygonDrawResult } from '../components/LeafletDrawMap';

// App specific imports
import { SystemSettings } from '../App';

export default function SettingsView({ settings, setSettings, userRole }: { settings: SystemSettings, setSettings: (s: SystemSettings) => void, userRole: string }) {
  const { t, i18n } = useTranslation();
  const [localSettings, setLocalSettings] = useState<SystemSettings>(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Sync localSettings ketika settings prop berubah dari parent (polling setiap 10 detik)
  // HANYA sync jika user BELUM melakukan perubahan lokal yang belum disimpan
  useEffect(() => {
    if (!hasUnsavedChanges) {
      setLocalSettings(settings);
    }
  }, [settings]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [newSubscriberEmail, setNewSubscriberEmail] = useState("");

  // Helper: update local settings dan tandai ada perubahan yang belum disimpan
  const updateLocal = (patch: Partial<SystemSettings>) => {
    setLocalSettings(prev => ({ ...prev, ...patch }));
    setHasUnsavedChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Validasi: Pastikan nilai string kosong diubah menjadi 0 sebelum dikirim ke API
      const payloadToSave = {
        ...localSettings,
        co2Threshold: localSettings.co2Threshold === '' ? 0 : Number(localSettings.co2Threshold),
        tempMax: localSettings.tempMax === '' ? 0 : Number(localSettings.tempMax),
        humidityMin: localSettings.humidityMin === '' ? 0 : Number(localSettings.humidityMin),
        samplingInterval: localSettings.samplingInterval === '' ? 0 : Number(localSettings.samplingInterval),
      };

      const res = await api.post('/settings', payloadToSave);
      if (res.data?.status === 'success') {
        setSettings(payloadToSave);
        setHasUnsavedChanges(false); // Reset flag setelah berhasil simpan
        setShowSuccess(true);
        toast.success('Pengaturan berhasil disimpan!');
        setTimeout(() => setShowSuccess(false), 3000);
      } else {
        toast.error('Gagal menyimpan pengaturan. Silakan coba lagi.');
      }
    } catch (err: any) {
      console.error("Failed to save settings", err);
      const msg = err.response?.data?.message || err.message || 'Terjadi kesalahan server.';
      toast.error('Gagal menyimpan: ' + msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoChange = () => {
    logoInputRef.current?.click();
  };

  const handleLogoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type and size
    const validTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error('Format file tidak didukung. Gunakan PNG, SVG, JPG, atau WebP.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Ukuran file terlalu besar. Maksimal 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setLogoPreview(dataUrl);
      // Save logo as a setting key
      setLocalSettings(prev => ({ ...prev, appLogo: dataUrl } as any));
      toast.success('Logo berhasil dimuat! Klik "Simpan Semua Perubahan" untuk menerapkan.');
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('Pengaturan Sistem')}</h1>
          <p className="text-muted-foreground">Konfigurasi global infrastruktur AgriSense</p>
        </div>
        <div className="flex items-center gap-3">
          {showSuccess && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 text-emerald-600 font-bold text-sm bg-emerald-50 px-4 py-2 rounded-md border border-emerald-100"
            >
              <CheckCircle2 size={18} />
              Perubahan Disimpan!
            </motion.div>
          )}
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-md font-bold gap-2 shadow-sm shadow-primary/20 min-w-[200px]"
          >
            {isSaving ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Save size={18} />
            )}
            {isSaving ? 'Menyimpan...' : 'Simpan Semua Perubahan'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Branding & Logo */}
        <Card className="border-none shadow-sm shadow-black/5">
          <CardHeader>
            <CardTitle className="text-lg font-bold">
              Profil Aplikasi
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider">Logo Aplikasi </Label>
              <div className="flex items-center gap-4 p-4 rounded-md bg-muted/30 border border-dashed border-muted-foreground/20">
                <div className="w-16 h-16 bg-primary rounded-md flex items-center justify-center text-primary-foreground overflow-hidden shadow-inner">
                  {(logoPreview || localSettings.appLogo) ? (
                    <img src={logoPreview || localSettings.appLogo} alt="Preview Logo" className="w-full h-full object-cover scale-110" />
                  ) : (
                    <Leaf size={32} />
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <p className="text-[10px] text-muted-foreground">Rekomendasi ukuran: 512x512px. Format: PNG, SVG, JPG, WebP. Maks 2MB.</p>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleLogoFileSelect}
                  />
                  <Button variant="outline" size="sm" onClick={handleLogoChange} className="rounded-lg h-8 text-xs font-bold">Ganti Logo</Button>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider">Nama Aplikasi</Label>
              <Input
                value={localSettings.appName}
                onChange={(e) => updateLocal({ appName: e.target.value })}
                className="h-11 rounded-md bg-muted/30 border-none"
              />
            </div>
          </CardContent>
        </Card>

        {/* Threshold Settings */}
        <Card className="border-none shadow-sm shadow-black/5">
          <CardHeader>
            <CardTitle className="text-lg font-bold">
              Threshold & Batas Alert
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider">Batas CO2 (PPM)</Label>
                <Input
                  type="number"
                  value={localSettings.co2Threshold}
                  onChange={(e) => updateLocal({ co2Threshold: e.target.value === '' ? '' : Number(e.target.value) })}
                  className="h-11 rounded-md bg-muted/30 border-none"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider">Suhu Maks (°C)</Label>
                <Input
                  type="number"
                  value={localSettings.tempMax}
                  onChange={(e) => updateLocal({ tempMax: e.target.value === '' ? '' : Number(e.target.value) })}
                  className="h-11 rounded-md bg-muted/30 border-none"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider">Kelembapan Min (%)</Label>
                <Input
                  type="number"
                  value={localSettings.humidityMin}
                  onChange={(e) => updateLocal({ humidityMin: e.target.value === '' ? '' : Number(e.target.value) })}
                  className="h-11 rounded-md bg-muted/30 border-none"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider">Interval Sampling (Detik)</Label>
                <Input
                  type="number"
                  value={localSettings.samplingInterval}
                  onChange={(e) => updateLocal({ samplingInterval: e.target.value === '' ? '' : Number(e.target.value) })}
                  className="h-11 rounded-md bg-muted/30 border-none"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Connectivity & API */}
        <Card className="border-none shadow-sm shadow-black/5">
          <CardHeader>
            <CardTitle className="text-lg font-bold">
              Konektivitas & API
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider">MQTT Broker URL</Label>
              <Input
                value={localSettings.mqttUrl}
                onChange={(e) => updateLocal({ mqttUrl: e.target.value })}
                className="h-11 rounded-md bg-muted/30 border-none"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider">API AI Engine Key</Label>
              <div className="flex gap-2">
                <Input
                  type={showApiKey ? "text" : "password"}
                  value={localSettings.aiEngineKey}
                  onChange={(e) => updateLocal({ aiEngineKey: e.target.value })}
                  className="h-11 rounded-md bg-muted/30 border-none flex-1 font-mono"
                />
                <Button
                  variant="outline"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="h-11 rounded-md gap-2"
                >
                  {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  {showApiKey ? 'Hide' : 'Reveal'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="border-none shadow-sm shadow-black/5">
          <CardHeader>
            <CardTitle className="text-lg font-bold">
              Notifikasi & Alert
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className="flex items-center justify-between p-3 rounded-md bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => updateLocal({ emailAlert: !localSettings.emailAlert })}
            >
              <div className="flex flex-col">
                <span className="text-sm font-bold">Email Alert</span>
                <span className="text-[10px] text-muted-foreground">Kirim notifikasi ke admin saat node offline</span>
              </div>
              <div className={cn(
                "w-10 h-5 rounded-full relative transition-colors",
                localSettings.emailAlert ? "bg-primary" : "bg-slate-300"
              )}>
                <motion.div
                  animate={{ x: localSettings.emailAlert ? 22 : 4 }}
                  className="absolute top-1 w-3 h-3 bg-white rounded-full"
                />
              </div>
            </div>
            <div
              className="flex items-center justify-between p-3 rounded-md bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => updateLocal({ telegramBot: !localSettings.telegramBot })}
            >
              <div className="flex flex-col">
                <span className="text-sm font-bold">Telegram Bot</span>
                <span className="text-[10px] text-muted-foreground">Integrasi laporan harian via Telegram</span>
              </div>
              <div className={cn(
                "w-10 h-5 rounded-full relative transition-colors",
                localSettings.telegramBot ? "bg-primary" : "bg-slate-300"
              )}>
                <motion.div
                  animate={{ x: localSettings.telegramBot ? 22 : 4 }}
                  className="absolute top-1 w-3 h-3 bg-white rounded-full"
                />
              </div>
            </div>

            {/* Telegram Invite Link Input */}
            <div className="space-y-2 pt-2 border-t border-border/40">
              <Label className="text-xs font-bold uppercase tracking-wider">Tautan Undangan Channel Telegram</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="https://t.me/+AbCdEfG"
                  value={localSettings.telegramInviteLink || ''}
                  onChange={(e) => updateLocal({ telegramInviteLink: e.target.value })}
                  className="h-11 rounded-md bg-muted/30 border-none flex-1"
                />
                <Button 
                  variant="outline" 
                  className="h-11 px-4 border-none bg-muted/30 hover:bg-muted/50"
                  onClick={() => {
                    if (localSettings.telegramInviteLink) {
                      navigator.clipboard.writeText(localSettings.telegramInviteLink);
                      toast.success("Tautan disalin ke clipboard!");
                    } else {
                      toast.error("Tautan kosong!");
                    }
                  }}
                  title="Copy Tautan"
                >
                  <Copy size={16} />
                </Button>
                <Button 
                  variant="secondary" 
                  className="h-11 px-4"
                  onClick={() => {
                    if (localSettings.telegramInviteLink) {
                      window.open(localSettings.telegramInviteLink, "_blank");
                    } else {
                      toast.error("Tautan kosong!");
                    }
                  }}
                  title="Buka Tautan"
                >
                  <ExternalLink size={16} />
                </Button>
              </div>
            </div>



            {/* Email Subscriber List */}
            <div className="space-y-2 pt-2 border-t border-border/40">
              <Label className="text-xs font-bold uppercase tracking-wider">Daftar Email Penerima Notifikasi</Label>
              <span className="text-[10px] text-muted-foreground block">Email yang terdaftar akan menerima notifikasi otomatis saat node offline.</span>
              <div className="flex gap-2">
                <Input
                  placeholder="tambah.email@gmail.com"
                  value={newSubscriberEmail}
                  onChange={(e) => setNewSubscriberEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (!newSubscriberEmail || !newSubscriberEmail.includes('@')) return;
                      const current: string[] = localSettings.notificationEmails ? JSON.parse(localSettings.notificationEmails) : [];
                      if (current.includes(newSubscriberEmail)) { toast.error('Email sudah terdaftar.'); return; }
                      const updated = [...current, newSubscriberEmail];
                      updateLocal({ notificationEmails: JSON.stringify(updated) });
                      setNewSubscriberEmail("");
                    }
                  }}
                  className="h-11 rounded-md bg-muted/30 border-none flex-1"
                />
                <Button
                  variant="secondary"
                  className="h-11 rounded-md font-bold px-6"
                  onClick={() => {
                    if (!newSubscriberEmail || !newSubscriberEmail.includes('@')) { toast.error('Masukkan email yang valid.'); return; }
                    const current: string[] = localSettings.notificationEmails ? JSON.parse(localSettings.notificationEmails) : [];
                    if (current.includes(newSubscriberEmail)) { toast.error('Email sudah terdaftar.'); return; }
                    const updated = [...current, newSubscriberEmail];
                    updateLocal({ notificationEmails: JSON.stringify(updated) });
                    setNewSubscriberEmail("");
                  }}
                >
                  <Plus size={16} className="mr-1" /> Tambah
                </Button>
              </div>
              {/* Subscriber list */}
              {(() => {
                const emails: string[] = localSettings.notificationEmails ? JSON.parse(localSettings.notificationEmails) : [];
                if (emails.length === 0) return <p className="text-[10px] text-muted-foreground italic">Belum ada email terdaftar. Notifikasi akan dikirim ke semua admin.</p>;
                return (
                  <div className="space-y-1 mt-1">
                    {emails.map((email, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-md bg-muted/30">
                        <span className="text-xs font-medium">{email}</span>
                        <Button
                          variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => {
                            const updated = emails.filter((_, i) => i !== idx);
                            updateLocal({ notificationEmails: JSON.stringify(updated) });
                          }}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
