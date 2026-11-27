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
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api/client';
import { Modal, Badge } from './UiPrimitives';

function getInitials(name?: string | null): string {
  if (!name) return 'IT';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout, can } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('itam_sidebar_collapsed') === 'true';
  });
  const [openAdminGroup, setOpenAdminGroup] = useState<string | null>(null);
  const [quickSearch, setQuickSearch] = useState('');
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

  // Account Dropdown & Modals
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
      }, 8000);
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
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
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
      { to: '/transfers', label: 'Bàn giao & điều chuyển', icon: ArrowLeftRight, badge: 0, show: can('assets.read') },
      { to: '/maintenance', label: 'Bảo trì & sửa chữa', icon: Wrench, badge: 0, show: can('assets.read') },
      { to: '/inventory', label: 'Kiểm kê tài sản', icon: ClipboardCheck, badge: 0, show: can('assets.read') },
      { to: '/software', label: 'Phần mềm & License', icon: Package, badge: 0, show: can('software.read') },
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
        className={`no-print fixed inset-y-0 left-0 z-40 h-screen bg-rail text-white flex flex-col border-r border-white/15 transition-all duration-200 shrink-0 lg:sticky lg:top-0 ${
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
            <div className="w-8 h-8 rounded-md bg-white/15 border border-white/20 flex items-center justify-center text-white shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="text-sm font-normal text-white leading-tight truncate">IT Asset Mgmt</div>
                <div className="text-[11px] font-normal text-white/75 truncate">Quản lý tài sản CNTT</div>
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
      <div className="flex-1 flex flex-col min-w-0">
        <header className="no-print h-14 bg-white border-b border-line px-4 lg:px-6 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-2.5 flex-1 max-w-md">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-1.5 text-ink-secondary hover:bg-slate-100 rounded"
              aria-label="Mở menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={toggleCollapsed}
              className="hidden lg:inline-flex p-1.5 text-ink-secondary hover:text-ink-primary hover:bg-slate-100 rounded transition-colors"
              title={collapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
              aria-label={collapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
            >
              {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>
            <form onSubmit={handleQuickSearch} className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={quickSearch}
                onChange={(e) => setQuickSearch(e.target.value)}
                placeholder="Tìm nhanh mã tài sản, serial, hostname..."
                className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-50 border border-line rounded-md focus:outline-none focus:bg-white focus:border-brand"
              />
            </form>
          </div>

          {/* Right Header: LAN status + Account Avatar Dropdown */}
          <div className="flex items-center gap-3">
            <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Mạng nội bộ (LAN)
            </span>

            {/* Account Avatar Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-2.5 pl-1.5 pr-2.5 py-1 rounded-full border border-line hover:bg-slate-50 transition-colors"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
              >
                <div className="w-8 h-8 rounded-full bg-rail text-white text-xs font-semibold flex items-center justify-center shrink-0">
                  {getInitials(user?.fullName)}
                </div>
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
                  className="absolute right-0 mt-2 w-64 bg-white border border-line rounded-lg shadow-lg py-1.5 z-50"
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
                        setProfileOpen(true);
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

        <main className="flex-1 p-4 lg:p-6 w-full transition-all duration-200">{children}</main>
      </div>

      {/* Floating Live Notifications Toast */}
      {toasts.length > 0 && (
        <div className="no-print fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
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
