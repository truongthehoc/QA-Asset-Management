import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Radar,
  HardDrive,
  ArrowLeftRight,
  Wrench,
  ClipboardCheck,
  Package,
  Bell,
  BarChart3,
  Settings,
  LogOut,
  Search,
  ShieldCheck,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  UserCircle,
  KeyRound,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  Building2,
  Layers,
  Tags,
  CircleDot,
  MapPin,
  Truck,
  Users,
  UserCheck,
  Shield,
  Sliders,
  Cpu,
  FileClock,
  FileText,
  Info,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useBranding } from '../contexts/BrandingContext';
import { api } from '../api/client';
import { Modal, Badge } from './UiPrimitives';
import { formatRelativeTime } from '../utils/format';

function getInitials(name?: string | null): string {
  if (!name) return 'IT';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatLiveClock(d: Date): { time: string; date: string } {
  const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return {
    time: `${hh}:${mm}:${ss}`,
    date: `${days[d.getDay()]}, ${dd}/${mo}/${yyyy}`,
  };
}

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout, can } = useAuth();
  const branding = useBranding();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('itam_sidebar_collapsed') === 'true';
  });
  const [openAdminGroup, setOpenAdminGroup] = useState<string | null>(null);
  const [quickSearch, setQuickSearch] = useState('');
  const [nowClock, setNowClock] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNowClock(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Tự động đăng xuất sau mốc thời gian không thao tác cấu hình trong Tham số hệ thống
  useEffect(() => {
    const timeoutMin = branding.idleTimeoutMin;
    if (!user || !timeoutMin || timeoutMin <= 0) return;

    const timeoutMs = timeoutMin * 60_000;
    const ACTIVITY_KEY = 'itam_last_activity';
    let lastWrite = Date.now();
    localStorage.setItem(ACTIVITY_KEY, String(lastWrite));

    const recordActivity = () => {
      const now = Date.now();
      if (now - lastWrite >= 5000) {
        lastWrite = now;
        localStorage.setItem(ACTIVITY_KEY, String(now));
      }
    };

    const events: Array<keyof WindowEventMap> = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach((ev) => window.addEventListener(ev, recordActivity, { passive: true }));

    const checkInterval = window.setInterval(() => {
      const stored = Number(localStorage.getItem(ACTIVITY_KEY) || lastWrite);
      if (Date.now() - stored >= timeoutMs) {
        window.clearInterval(checkInterval);
        localStorage.removeItem(ACTIVITY_KEY);
        logout();
        navigate('/login?reason=timeout', { replace: true });
      }
    }, 10_000);

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, recordActivity));
      window.clearInterval(checkInterval);
    };
  }, [user, branding.idleTimeoutMin, logout, navigate]);
  const [badges, setBadges] = useState({ pendingApproval: 0, unresolvedAlerts: 0 });
  const [toasts, setToasts] = useState<Array<{ id: string; title: string; desc: string; to: string; kind: 'discovery' | 'alert' }>>([]);
  const prevSnapshotRef = useRef<{
    initialized: boolean;
    pendingApproval: number;
    unresolvedAlerts: number;
    totalAssets: number;
    agentsOnline: number;
  }>({
    initialized: false,
    pendingApproval: 0,
    unresolvedAlerts: 0,
    totalAssets: 0,
    agentsOnline: 0,
  });

  // Account & Notification Dropdowns
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const readStorageKey = `itam_read_notifs_${user?.id || 'guest'}`;
  const [readNotifIds, setReadNotifIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(`itam_read_notifs_${user?.id || 'guest'}`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [profileOpen, setProfileOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(readStorageKey);
      setReadNotifIds(raw ? JSON.parse(raw) : []);
    } catch {
      setReadNotifIds([]);
    }
  }, [readStorageKey]);

  const markNotifRead = (id: string) => {
    setReadNotifIds((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev.slice(-199), id];
      try {
        localStorage.setItem(readStorageKey, JSON.stringify(next));
      } catch {
        // ignore storage quota errors
      }
      return next;
    });
  };

  const markAllNotifsRead = (ids: string[]) => {
    setReadNotifIds((prev) => {
      const set = new Set([...prev, ...ids]);
      const next = Array.from(set).slice(-200);
      try {
        localStorage.setItem(readStorageKey, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Change Password Form State
  const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwdStatus, setPwdStatus] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [pwdSaving, setPwdSaving] = useState(false);

  useEffect(() => {
    let active = true;

    const pushToast = (item: { title: string; desc: string; to: string; kind: 'discovery' | 'alert' }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-2), { ...item, id }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3000);
    };

    const pollStatus = async () => {
      if (!active || document.visibilityState === 'hidden') return;
      try {
        const res = await api.get('/dashboard');
        if (!active) return;
        const kpis = res.data?.kpis || {};
        const nextPending = Number(kpis.pendingApproval || 0);
        const nextAlerts = Number(kpis.unresolvedConfigAlerts || 0);
        const nextAssets = Number(kpis.totalAssets || 0);
        const nextAgentsOnline = Number(kpis.agentsOnline || 0);

        setBadges({
          pendingApproval: nextPending,
          unresolvedAlerts: nextAlerts,
        });
        setNotifications(Array.isArray(res.data?.alertCenter) ? res.data.alertCenter : []);

        const prev = prevSnapshotRef.current;
        if (prev.initialized) {
          const pendingDelta = nextPending - prev.pendingApproval;
          const alertsDelta = nextAlerts - prev.unresolvedAlerts;
          const anyChanged =
            pendingDelta !== 0 ||
            alertsDelta !== 0 ||
            nextAssets !== prev.totalAssets ||
            nextAgentsOnline !== prev.agentsOnline;

          if (pendingDelta > 0) {
            pushToast({
              kind: 'discovery',
              title: `Phát hiện +${pendingDelta} thiết bị mới chờ duyệt`,
              desc: `Hiện có ${nextPending} thiết bị đang chờ IT kiểm duyệt.`,
              to: '/discovery',
            });
          }
          if (alertsDelta > 0) {
            pushToast({
              kind: 'alert',
              title: `Có +${alertsDelta} cảnh báo cấu hình mới`,
              desc: `Hiện có ${nextAlerts} cảnh báo / thay đổi chưa xác minh.`,
              to: '/alerts',
            });
          }
          if (anyChanged) {
            window.dispatchEvent(
              new CustomEvent('itam:realtime-update', {
                detail: {
                  pendingApproval: nextPending,
                  unresolvedAlerts: nextAlerts,
                  totalAssets: nextAssets,
                  agentsOnline: nextAgentsOnline,
                },
              }),
            );
          }
        }

        prevSnapshotRef.current = {
          initialized: true,
          pendingApproval: nextPending,
          unresolvedAlerts: nextAlerts,
          totalAssets: nextAssets,
          agentsOnline: nextAgentsOnline,
        };
      } catch {
        // ignore transient network errors
      }
    };

    pollStatus();
    const timer = window.setInterval(pollStatus, 5000);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') pollStatus();
    };
    const onManualRefresh = () => pollStatus();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('itam:refresh-badges', onManualRefresh);

    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('itam:refresh-badges', onManualRefresh);
    };
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('itam_sidebar_collapsed', String(next));
      return next;
    });
  };

  // Standalone top item
  const topNavItems = [{ to: '/', label: 'Tổng quan', icon: LayoutDashboard, show: true }];

  // 4 dedicated workflow groups (accordion auto-collapse)
  const assetGroup = {
    id: 'assets',
    label: 'Quản lý tài sản',
    icon: HardDrive,
    groupBadge: badges.unresolvedAlerts || 0,
    items: [
      { to: '/assets', label: 'Danh sách tài sản', icon: HardDrive, badge: 0, show: can('assets.read') },
      { to: '/software', label: 'Phần mềm & License', icon: Package, badge: 0, show: can('software.read') },
      { to: '/contracts', label: 'Quản lý hợp đồng', icon: FileText, badge: 0, show: can('assets.read') },
      { to: '/transfers', label: 'Bàn giao & điều chuyển', icon: ArrowLeftRight, badge: 0, show: can('assets.read') },
      { to: '/maintenance', label: 'Bảo trì & sửa chữa', icon: Wrench, badge: 0, show: can('assets.read') },
      { to: '/inventory', label: 'Kiểm kê tài sản', icon: ClipboardCheck, badge: 0, show: can('assets.read') },
      { to: '/alerts', label: 'Cảnh báo & Thay đổi', icon: Bell, badge: badges.unresolvedAlerts, show: can('alerts.read') },
      { to: '/reports', label: 'Báo cáo', icon: BarChart3, badge: 0, show: can('reports.read') },
    ].filter((item) => item.show),
  };

  const discoveryNavItem = {
    to: '/discovery',
    label: 'Khám phá thiết bị',
    icon: Radar,
    badge: badges.pendingApproval,
    show: can('discovery.read'),
  };

  const adminNavGroups = [
    {
      id: 'catalogs',
      label: 'Danh mục tài sản',
      icon: Layers,
      groupBadge: 0,
      items: [
        { to: '/admin/asset-categories', label: 'Nhóm tài sản', icon: Layers, badge: 0, show: can('admin.catalogs') },
        { to: '/admin/asset-types', label: 'Loại tài sản', icon: Tags, badge: 0, show: can('admin.catalogs') },
        { to: '/admin/asset-statuses', label: 'Trạng thái tài sản', icon: CircleDot, badge: 0, show: can('admin.catalogs') },
        { to: '/admin/suppliers', label: 'Nhà cung cấp', icon: Truck, badge: 0, show: can('admin.catalogs') },
      ].filter((item) => item.show),
    },
    {
      id: 'org',
      label: 'Tổ chức & Nhân sự',
      icon: Building2,
      groupBadge: 0,
      items: [
        { to: '/admin/departments', label: 'Phòng ban', icon: Building2, badge: 0, show: can('admin.catalogs') },
        { to: '/admin/locations', label: 'Vị trí', icon: MapPin, badge: 0, show: can('admin.catalogs') },
        { to: '/admin/employees', label: 'Nhân viên', icon: UserCheck, badge: 0, show: can('admin.catalogs') },
        { to: '/admin/users', label: 'Người dùng', icon: Users, badge: 0, show: can('admin.users') },
        { to: '/admin/roles', label: 'Phân quyền', icon: Shield, badge: 0, show: can('admin.users') || can('admin.settings') },
      ].filter((item) => item.show),
    },
    {
      id: 'system',
      label: 'Cấu hình & Hệ thống',
      icon: Settings,
      groupBadge: 0,
      items: [
        { to: '/admin/settings', label: 'Cấu hình hệ thống', icon: Sliders, badge: 0, show: can('admin.settings') },
        { to: '/admin/agent-management', label: 'Quản lý phiên bản Agent', icon: Cpu, badge: 0, show: can('admin.settings') },
        { to: '/admin/audit-logs', label: 'Nhật ký hệ thống', icon: FileClock, badge: 0, show: can('admin.audit') },
      ].filter((item) => item.show),
    },
  ].filter((g) => g.items.length > 0);

  const navGroups = [...(assetGroup.items.length > 0 ? [assetGroup] : []), ...adminNavGroups];

  useEffect(() => {
    const matched = navGroups.find((g) =>
      g.items.some((sub) => location.pathname === sub.to || location.pathname.startsWith(`${sub.to}/`)),
    );
    setOpenAdminGroup(matched ? matched.id : null);
  }, [location.pathname]);

  const handleQuickSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickSearch.trim()) {
      navigate(`/assets?search=${encodeURIComponent(quickSearch.trim())}`);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdStatus(null);
    if (pwdForm.newPassword.length < 6) {
      setPwdStatus({ type: 'err', text: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
      return;
    }
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      setPwdStatus({ type: 'err', text: 'Mật khẩu xác nhận không khớp.' });
      return;
    }
    setPwdSaving(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword: pwdForm.currentPassword,
        newPassword: pwdForm.newPassword,
      });
      setPwdStatus({ type: 'ok', text: 'Đổi mật khẩu thành công.' });
      setPwdForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      setPwdStatus({
        type: 'err',
        text: err.response?.data?.message || 'Không thể đổi mật khẩu. Vui lòng kiểm tra lại.',
      });
    } finally {
      setPwdSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-canvas">
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
        />
      )}

      {/* Collapsible Fixed Blue Sidebar (#006E96, white regular text) */}
      <aside
        className={`no-print fixed inset-y-0 left-0 z-40 h-screen bg-rail text-white flex flex-col border-r border-white/15 transition-all duration-200 shrink-0 ${
          collapsed ? 'lg:w-[68px]' : 'lg:w-64'
        } w-64 ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Brand Header */}
        <div
          className={`h-14 flex items-center border-b border-white/15 ${
            collapsed ? 'justify-center px-2' : 'justify-between px-4'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {branding.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt="Logo"
                className="h-8 w-auto max-w-[40px] object-contain shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-md bg-white/15 border border-white/20 flex items-center justify-center text-white shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
            )}
            {!collapsed && (
              <div className="min-w-0">
                <div className="text-sm font-normal text-white leading-tight truncate">
                  {branding.appName || 'Quản lý tài sản'}
                </div>
                {branding.name && (
                  <div className="text-[11px] font-normal text-white/75 truncate">{branding.name}</div>
                )}
              </div>
            )}
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden text-white/80 hover:text-white p-1"
            aria-label="Đóng menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links - White regular non-bold text */}
        <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
          {topNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                title={collapsed ? item.label : undefined}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `relative flex items-center rounded-md text-sm font-normal text-white transition-colors ${
                    collapsed ? 'justify-center px-2 py-2.5' : 'justify-between px-3 py-2'
                  } ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'text-white/90 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-white" />
                    )}
                    <span className={`flex items-center min-w-0 ${collapsed ? '' : 'gap-2.5'}`}>
                      <Icon className="w-[18px] h-[18px] shrink-0 text-white" />
                      {!collapsed && <span className="truncate font-normal">{item.label}</span>}
                    </span>
                  </>
                )}
              </NavLink>
            );
          })}

          {/* Standalone Khám phá thiết bị right below Tổng quan */}
          {discoveryNavItem.show && (
            <div className="pt-2 mt-2 border-t border-white/15">
              <NavLink
                to={discoveryNavItem.to}
                title={collapsed ? discoveryNavItem.label : undefined}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `relative flex items-center rounded-md text-sm font-normal text-white transition-colors ${
                    collapsed ? 'justify-center px-2 py-2.5' : 'justify-between px-3 py-2'
                  } ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'text-white/90 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-white" />
                    )}
                    <span className={`flex items-center min-w-0 ${collapsed ? '' : 'gap-2.5'}`}>
                      <Radar className="w-[18px] h-[18px] shrink-0 text-white" />
                      {!collapsed && <span className="truncate font-normal">{discoveryNavItem.label}</span>}
                    </span>
                    {!collapsed && discoveryNavItem.badge ? (
                      <span className="ml-2 min-w-[20px] h-5 px-1 inline-flex items-center justify-center text-[11px] font-medium leading-none rounded-full bg-amber-400 text-slate-950 tabular-nums shrink-0">
                        {discoveryNavItem.badge}
                      </span>
                    ) : null}
                    {collapsed && discoveryNavItem.badge ? (
                      <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-400" />
                    ) : null}
                  </>
                )}
              </NavLink>
            </div>
          )}

          {/* Dedicated Expandable Groups: Quản lý tài sản | Danh mục tài sản | Tổ chức & Nhân sự | Cấu hình & Hệ thống */}
          {navGroups.length > 0 && (
            <div className="space-y-0">
              {navGroups.map((grp) => {
                const GroupIcon = grp.icon;
                const isGroupOpen = openAdminGroup === grp.id;
                const isGroupActive = grp.items.some(
                  (sub) => location.pathname === sub.to || location.pathname.startsWith(`${sub.to}/`),
                );
                return (
                  <div key={grp.id} className="pt-2 mt-2 border-t border-white/15">
                    <button
                      type="button"
                      title={collapsed ? grp.label : undefined}
                      onClick={() => {
                        if (collapsed) {
                          setCollapsed(false);
                          localStorage.setItem('itam_sidebar_collapsed', 'false');
                          setOpenAdminGroup(grp.id);
                        } else {
                          setOpenAdminGroup((prev) => (prev === grp.id ? null : grp.id));
                        }
                      }}
                      className={`relative w-full flex items-center rounded-md text-sm font-normal text-white transition-colors ${
                        collapsed ? 'justify-center px-2 py-2.5' : 'justify-between px-3 py-2'
                      } ${isGroupActive ? 'bg-white/15 text-white' : 'text-white/90 hover:bg-white/10 hover:text-white'}`}
                    >
                      <span className={`flex items-center min-w-0 ${collapsed ? '' : 'gap-2.5'}`}>
                        <GroupIcon className="w-[18px] h-[18px] shrink-0 text-white" />
                        {!collapsed && <span className="truncate font-normal">{grp.label}</span>}
                      </span>
                      {!collapsed && (
                        <span className="flex items-center gap-1.5 shrink-0">
                          {!isGroupOpen && grp.groupBadge > 0 && (
                            <span className="min-w-[20px] h-5 px-1 inline-flex items-center justify-center text-[11px] font-medium leading-none rounded-full bg-amber-400 text-slate-950 tabular-nums">
                              {grp.groupBadge}
                            </span>
                          )}
                          <ChevronDown
                            className={`w-4 h-4 shrink-0 text-white/80 transition-transform ${
                              isGroupOpen ? 'rotate-180' : ''
                            }`}
                          />
                        </span>
                      )}
                      {collapsed && grp.groupBadge > 0 && (
                        <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-400" />
                      )}
                    </button>

                    {!collapsed && isGroupOpen && (
                      <div className="mt-1 ml-3 pl-2.5 border-l border-white/20 space-y-0.5">
                        {grp.items.map((sub) => {
                          const SubIcon = sub.icon;
                          return (
                            <NavLink
                              key={sub.to}
                              to={sub.to}
                              onClick={() => setMobileOpen(false)}
                              className={({ isActive }) =>
                                `relative flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-[13px] font-normal transition-colors ${
                                  isActive
                                    ? 'bg-white/20 text-white'
                                    : 'text-white/85 hover:bg-white/10 hover:text-white'
                                }`
                              }
                            >
                              {({ isActive }) => (
                                <>
                                  {isActive && (
                                    <span className="absolute left-0 top-1.5 bottom-1.5 w-[2.5px] rounded-r bg-white" />
                                  )}
                                  <span className="flex items-center gap-2.5 min-w-0">
                                    <SubIcon className="w-4 h-4 shrink-0 text-white/90" />
                                    <span className="truncate font-normal">{sub.label}</span>
                                  </span>
                                  {sub.badge ? (
                                    <span className="ml-1 min-w-[20px] h-5 px-1 inline-flex items-center justify-center text-[11px] font-medium leading-none rounded-full bg-amber-400 text-slate-950 tabular-nums shrink-0">
                                      {sub.badge}
                                    </span>
                                  ) : null}
                                </>
                              )}
                            </NavLink>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Thông tin phần mềm — cuối Sidebar, ngay dưới Cấu hình & Hệ thống */}
          <div className="pt-2 mt-2 border-t border-white/15">
            <NavLink
              to="/about"
              title={collapsed ? 'Thông tin phần mềm' : undefined}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `relative flex items-center rounded-md text-sm font-normal text-white transition-colors ${
                  collapsed ? 'justify-center px-2 py-2.5' : 'justify-between px-3 py-2'
                } ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'text-white/90 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-white" />
                  )}
                  <span className={`flex items-center min-w-0 ${collapsed ? '' : 'gap-2.5'}`}>
                    <Info className="w-[18px] h-[18px] shrink-0 text-white" />
                    {!collapsed && <span className="truncate font-normal">Thông tin phần mềm</span>}
                  </span>
                </>
              )}
            </NavLink>
          </div>
        </nav>

        {/* Bottom Collapse / Expand Toggle Button */}
        <div className="hidden lg:flex p-2 border-t border-white/15">
          <button
            type="button"
            onClick={toggleCollapsed}
            title={collapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
            className={`w-full flex items-center rounded-md py-2 text-xs font-normal text-white/90 hover:text-white hover:bg-white/10 transition-colors ${
              collapsed ? 'justify-center px-2' : 'gap-2.5 px-3'
            }`}
          >
            {collapsed ? (
              <PanelLeftOpen className="w-4 h-4 shrink-0" />
            ) : (
              <>
                <PanelLeftClose className="w-4 h-4 shrink-0" />
                <span>Thu gọn menu</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ${
          collapsed ? 'lg:pl-[68px]' : 'lg:pl-64'
        }`}
      >
        <header className="no-print h-14 bg-white border-b border-line px-3 sm:px-4 lg:px-6 flex items-center justify-between gap-2 sm:gap-4 sticky top-0 z-30">
          {/* Left: Sidebar toggle */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 -ml-1 text-ink-secondary hover:bg-slate-100 rounded-md shrink-0"
              aria-label="Mở menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={toggleCollapsed}
              className="hidden lg:inline-flex p-1.5 text-ink-secondary hover:text-ink-primary hover:bg-slate-100 rounded transition-colors shrink-0"
              title={collapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
              aria-label={collapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
            >
              {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>
          </div>

          {/* Center: Quick Search */}
          <div className="flex-1 flex justify-center min-w-0 px-0.5 sm:px-3">
            <form onSubmit={handleQuickSearch} className="relative w-full max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={quickSearch}
                onChange={(e) => setQuickSearch(e.target.value)}
                placeholder="Tìm mã TS, serial..."
                className="w-full pl-8 sm:pl-9 pr-2.5 sm:pr-3 py-1.5 text-xs sm:text-sm bg-slate-50 border border-line rounded-md focus:outline-none focus:bg-white focus:border-brand"
              />
            </form>
          </div>

          {/* Right Header: Notification Bell + Borderless Account Dropdown */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Notification Bell Dropdown */}
            <div className="relative" ref={notifRef}>
              {(() => {
                const discoveryNotifId = badges.pendingApproval > 0 ? `discovery-pending-${badges.pendingApproval}` : null;
                const allNotifIds = [
                  ...(discoveryNotifId ? [discoveryNotifId] : []),
                  ...notifications.map((n: any) => String(n.id)),
                ];
                const unreadCount = allNotifIds.filter((id) => !readNotifIds.includes(id)).length;
                const isDiscoveryUnread = discoveryNotifId ? !readNotifIds.includes(discoveryNotifId) : false;

                return (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setNotifOpen((o) => !o);
                        setMenuOpen(false);
                      }}
                      className="relative p-2 rounded-lg text-ink-secondary hover:text-ink-primary hover:bg-slate-100/80 transition-colors"
                      title="Thông báo"
                      aria-label="Thông báo"
                      aria-expanded={notifOpen}
                    >
                      <Bell className="w-[18px] h-[18px]" />
                      {unreadCount > 0 && (
                        <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold leading-none flex items-center justify-center tabular-nums">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </button>

                    {notifOpen && (
                      <div className="fixed sm:absolute left-2 right-2 sm:left-auto sm:right-0 top-14 sm:top-auto sm:mt-2 sm:w-96 bg-white border border-line rounded-xl shadow-xl z-50 overflow-hidden">
                        <div className="px-4 py-3 border-b border-line flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-ink-primary">Thông báo</span>
                            {unreadCount > 0 && (
                              <span className="px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200 text-[10px] font-semibold tabular-nums">
                                {unreadCount} chưa đọc
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2.5">
                            {unreadCount > 0 && (
                              <button
                                type="button"
                                onClick={() => markAllNotifsRead(allNotifIds)}
                                className="text-[11px] font-medium text-ink-secondary hover:text-brand"
                              >
                                Đã đọc tất cả
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setNotifOpen(false);
                                navigate('/alerts?tab=alerts');
                              }}
                              className="text-xs font-medium text-brand hover:underline"
                            >
                              Xem tất cả
                            </button>
                          </div>
                        </div>

                        <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
                          {discoveryNotifId && (
                            <button
                              type="button"
                              onClick={() => {
                                markNotifRead(discoveryNotifId);
                                setNotifOpen(false);
                                navigate('/discovery');
                              }}
                              className={`w-full text-left px-4 py-3 hover:bg-slate-50 flex items-start gap-3 transition-colors ${
                                isDiscoveryUnread ? 'bg-sky-50/50' : 'bg-white opacity-80'
                              }`}
                            >
                              <div className="w-8 h-8 rounded-full bg-sky-100 text-brand flex items-center justify-center shrink-0 mt-0.5">
                                <Radar className="w-4 h-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="text-xs font-semibold text-ink-primary">
                                    Có {badges.pendingApproval} thiết bị mới chờ kiểm duyệt
                                  </div>
                                  {isDiscoveryUnread && <span className="w-2 h-2 rounded-full bg-brand shrink-0" />}
                                </div>
                                <div className="text-[11px] text-ink-muted mt-0.5">
                                  Phát hiện từ Windows Agent / mạng nội bộ
                                </div>
                              </div>
                            </button>
                          )}

                          {notifications.length === 0 && !discoveryNotifId ? (
                            <div className="py-8 px-4 text-center text-xs text-ink-muted">
                              Không có thông báo mới. Hệ thống đang hoạt động bình thường.
                            </div>
                          ) : (
                            notifications.slice(0, 10).map((n: any) => {
                              const nid = String(n.id);
                              const isUnread = !readNotifIds.includes(nid);
                              const isCritical = n.severity === 'CRITICAL';
                              const isWarn = n.severity === 'HIGH' || n.severity === 'MEDIUM';
                              const targetLink =
                                n.scope === 'LICENSE'
                                  ? n.link || '/software'
                                  : n.scope === 'CONTRACT'
                                    ? n.link || '/contracts'
                                    : `/alerts?tab=alerts&alertId=${encodeURIComponent(nid)}`;

                              return (
                                <button
                                  key={nid}
                                  type="button"
                                  onClick={() => {
                                    markNotifRead(nid);
                                    setNotifOpen(false);
                                    navigate(targetLink);
                                  }}
                                  className={`w-full text-left px-4 py-3 hover:bg-slate-50 flex items-start gap-3 transition-colors ${
                                    isUnread ? 'bg-sky-50/40' : 'bg-white opacity-75'
                                  }`}
                                >
                                  <div
                                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                                      isCritical
                                        ? 'bg-rose-100 text-rose-600'
                                        : isWarn
                                          ? 'bg-amber-100 text-amber-600'
                                          : 'bg-sky-100 text-sky-600'
                                    }`}
                                  >
                                    <AlertCircle className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className={`text-xs line-clamp-2 ${isUnread ? 'font-semibold text-ink-primary' : 'font-medium text-ink-secondary'}`}>
                                        {n.title}
                                      </div>
                                      {isUnread && <span className="w-2 h-2 rounded-full bg-brand shrink-0 mt-1" />}
                                    </div>
                                    <div className="text-[11px] text-ink-muted truncate mt-0.5">{n.message}</div>
                                    <div className="text-[10px] text-ink-muted mt-1">{formatRelativeTime(n.detectedAt)}</div>
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Account Avatar Dropdown (không khung viền) */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-2 px-1.5 py-1 rounded-lg hover:bg-slate-100/80 transition-colors"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
              >
                {user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.fullName}
                    className="w-8 h-8 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-rail text-white text-xs font-semibold flex items-center justify-center shrink-0">
                    {getInitials(user?.fullName)}
                  </div>
                )}
                <div className="hidden sm:block text-left leading-tight">
                  <div className="text-xs font-semibold text-ink-primary max-w-[130px] truncate">
                    {user?.fullName}
                  </div>
                  <div className="text-[11px] text-ink-muted max-w-[130px] truncate">
                    {user?.roles?.[0] || 'User'}
                  </div>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-ink-muted transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-1rem)] bg-white border border-line rounded-lg shadow-xl py-1.5 z-50"
                >
                  <div className="px-3.5 py-2.5 border-b border-line">
                    <div className="text-sm font-semibold text-ink-primary truncate">{user?.fullName}</div>
                    <div className="text-xs text-ink-muted truncate">{user?.email || user?.username}</div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {(user?.roles || []).map((r) => (
                        <span
                          key={r}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-brand-soft text-brand font-medium"
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="py-1">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        navigate('/profile');
                      }}
                      className="w-full px-3.5 py-2 text-left text-sm text-ink-primary hover:bg-slate-50 flex items-center gap-2.5"
                    >
                      <UserCircle className="w-4 h-4 text-ink-secondary" />
                      <span>Thông tin tài khoản</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        setPwdStatus(null);
                        setPwdForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                        setPasswordOpen(true);
                      }}
                      className="w-full px-3.5 py-2 text-left text-sm text-ink-primary hover:bg-slate-50 flex items-center gap-2.5"
                    >
                      <KeyRound className="w-4 h-4 text-ink-secondary" />
                      <span>Đổi mật khẩu</span>
                    </button>
                  </div>

                  <div className="border-t border-line pt-1">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        logout();
                        navigate('/login');
                      }}
                      className="w-full px-3.5 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2.5"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Đăng xuất</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-3 sm:p-4 lg:p-6 pb-14 sm:pb-14 lg:pb-14 w-full min-w-0 transition-all duration-200">{children}</main>

        {/* Fixed Footer — luôn hiển thị, không bị cuộn trang */}
        <footer
          className={`no-print fixed bottom-0 right-0 left-0 z-20 min-h-[36px] bg-white/95 backdrop-blur-sm border-t border-line px-3 sm:px-4 lg:px-6 py-1.5 flex items-center justify-between gap-2 text-[11px] text-ink-muted transition-all duration-200 ${
            collapsed ? 'lg:left-[68px]' : 'lg:left-64'
          }`}
          style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom))' }}
        >
          <div className="truncate">
            © {new Date().getFullYear()} <span className="font-medium text-ink-secondary">{branding.name || branding.appName}</span>
            <span className="hidden sm:inline">. All rights reserved.</span>
          </div>
          {(() => {
            const clk = formatLiveClock(nowClock);
            return (
              <div className="flex items-center gap-2 shrink-0 truncate">
                <span className="hidden lg:inline-flex items-center gap-1.5 text-ink-secondary select-none">
                  <span className="font-mono font-semibold tabular-nums text-ink-primary">{clk.time}</span>
                  <span>{clk.date}</span>
                </span>
                <span className="hidden lg:inline text-slate-300">|</span>
                <span className="hidden sm:inline truncate">
                  Phát triển bởi <span className="font-medium text-ink-secondary">{branding.developedBy}</span>
                </span>
                <span className="hidden sm:inline text-slate-300">|</span>
                <span className="font-mono text-[11px] text-ink-secondary">
                  Phiên bản <span className="font-semibold text-brand">v{branding.version}</span>
                </span>
              </div>
            );
          })()}
        </footer>
      </div>

      {/* Floating Live Notifications Toast */}
      {toasts.length > 0 && (
        <div className="no-print fixed bottom-3 inset-x-3 sm:inset-x-auto sm:bottom-5 sm:right-5 z-50 flex flex-col gap-2.5 sm:max-w-sm sm:w-full pointer-events-none">
          {toasts.map((t) => (
            <div
              key={t.id}
              className="pointer-events-auto bg-white border border-sky-200 rounded-lg shadow-lg p-3.5 flex items-start gap-3 animate-fade-in"
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  t.kind === 'discovery' ? 'bg-sky-100 text-brand' : 'bg-amber-100 text-amber-700'
                }`}
              >
                {t.kind === 'discovery' ? <Radar className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-ink-primary">{t.title}</div>
                <div className="text-[11px] text-ink-secondary mt-0.5">{t.desc}</div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setToasts((prev) => prev.filter((x) => x.id !== t.id));
                      navigate(t.to);
                    }}
                    className="text-xs font-semibold text-brand hover:underline"
                  >
                    Xem ngay →
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
                className="p-0.5 text-slate-400 hover:text-slate-600 rounded"
                aria-label="Đóng thông báo"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Thông tin tài khoản */}
      <Modal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        title="Thông tin tài khoản"
        subtitle="Chi tiết hồ sơ người dùng và phân quyền truy cập hiện tại"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3.5 pb-4 border-b border-line">
            <div className="w-12 h-12 rounded-full bg-rail text-white text-base font-semibold flex items-center justify-center shrink-0">
              {getInitials(user?.fullName)}
            </div>
            <div className="min-w-0">
              <div className="text-base font-semibold text-ink-primary truncate">{user?.fullName}</div>
              <div className="text-xs text-ink-secondary truncate">{user?.title || user?.email}</div>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-ink-muted">Tên đăng nhập</dt>
              <dd className="font-mono text-xs font-medium mt-0.5">{user?.username}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Email</dt>
              <dd className="text-xs font-medium mt-0.5 truncate">{user?.email || '—'}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs text-ink-muted">Phòng ban</dt>
              <dd className="text-xs font-medium mt-0.5">{user?.departmentName || 'Toàn công ty'}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs text-ink-muted mb-1">Vai trò RBAC</dt>
              <dd className="flex flex-wrap gap-1.5">
                {(user?.roles || []).map((r) => (
                  <Badge key={r} label={r} cls="bg-brand-soft text-brand border-sky-200" />
                ))}
              </dd>
            </div>
          </dl>

          <div className="flex justify-end pt-2 border-t border-line">
            <button type="button" onClick={() => setProfileOpen(false)} className="btn-secondary">
              Đóng
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Đổi mật khẩu */}
      <Modal
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        title="Đổi mật khẩu"
        subtitle="Cập nhật mật khẩu đăng nhập cho tài khoản hiện tại"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleChangePassword} className="space-y-4">
          {pwdStatus && (
            <div
              className={`p-3 rounded-md border text-sm flex items-center gap-2 ${
                pwdStatus.type === 'ok'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}
            >
              {pwdStatus.type === 'ok' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{pwdStatus.text}</span>
            </div>
          )}

          <div>
            <label className="label-field">Mật khẩu hiện tại <span className="text-red-500">*</span></label>
            <input
              type="password"
              required
              value={pwdForm.currentPassword}
              onChange={(e) => setPwdForm({ ...pwdForm, currentPassword: e.target.value })}
              className="input-field"
              placeholder="Nhập mật khẩu hiện tại"
            />
          </div>
          <div>
            <label className="label-field">Mật khẩu mới <span className="text-red-500">*</span></label>
            <input
              type="password"
              required
              minLength={6}
              value={pwdForm.newPassword}
              onChange={(e) => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
              className="input-field"
              placeholder="Nhập mật khẩu mới"
            />
          </div>
          <div>
            <label className="label-field">Xác nhận mật khẩu mới <span className="text-red-500">*</span></label>
            <input
              type="password"
              required
              minLength={6}
              value={pwdForm.confirmPassword}
              onChange={(e) => setPwdForm({ ...pwdForm, confirmPassword: e.target.value })}
              className="input-field"
              placeholder="Nhập lại mật khẩu mới"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-line">
            <button type="button" onClick={() => setPasswordOpen(false)} className="btn-secondary">
              Hủy
            </button>
            <button type="submit" disabled={pwdSaving} className="btn-primary">
              {pwdSaving ? 'Đang lưu...' : 'Cập nhật mật khẩu'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
