import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertCircle,
  Save,
  Send,
  History,
  Wrench,
  Package,
  XCircle,
  PlayCircle,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { AssetStatusBadge, Badge } from '../components/UiPrimitives';
import { CurrencyInput, DateInputVN } from '../components/FormInputs';
import {
  formatDate,
  formatDateTime,
  formatVnd,
  MAINTENANCE_STATUS_META,
  MAINTENANCE_TYPE_META,
} from '../utils/format';

const WORKFLOW_STEPS = [
  { key: 'OPEN', label: 'Chờ tiếp nhận', icon: Clock },
  { key: 'IN_PROGRESS', label: 'Đang sửa chữa', icon: Wrench },
  { key: 'WAITING_PARTS', label: 'Chờ linh kiện', icon: Package },
  { key: 'COMPLETED', label: 'Hoàn thành', icon: CheckCircle2 },
] as const;

const LOG_ACTION_LABELS: Record<string, { label: string; cls: string }> = {
  CREATED: { label: 'Lập phiếu', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  STATUS_CHANGED: { label: 'Chuyển trạng thái', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  UPDATED: { label: 'Cập nhật phiếu', cls: 'bg-slate-100 text-slate-700 border-slate-200' },
  NOTE: { label: 'Ghi chú nhật ký', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

export const MaintenanceDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const canManage = can('maintenance.manage');

  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addingLog, setAddingLog] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [form, setForm] = useState({
    status: 'OPEN',
    vendorName: '',
    performedBy: '',
    cost: '',
    receivedDate: '',
    completedDate: '',
    workPerformed: '',
    replacedParts: '',
    documentRef: '',
    notes: '',
    logNote: '',
  });

  const [newLogNote, setNewLogNote] = useState('');
  const [newLogCost, setNewLogCost] = useState('');

  const showNotice = (type: 'success' | 'error', text: string) => {
    setNotice({ type, text });
  };

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(t);
  }, [notice]);

  const syncForm = (data: any) => {
    setForm({
      status: data.status || 'OPEN',
      vendorName: data.vendorName || '',
      performedBy: data.performedBy || '',
      cost: data.cost != null ? String(data.cost) : '0',
      receivedDate: data.receivedDate ? new Date(data.receivedDate).toISOString().slice(0, 10) : '',
      completedDate: data.completedDate ? new Date(data.completedDate).toISOString().slice(0, 10) : '',
      workPerformed: data.workPerformed || '',
      replacedParts: data.replacedParts || '',
      documentRef: data.documentRef || '',
      notes: data.notes || '',
      logNote: '',
    });
  };

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.get(`/maintenance/${id}`);
      setTicket(res.data);
      syncForm(res.data);
    } catch (err: any) {
      showNotice('error', err.response?.data?.message || 'Không tải được chi tiết phiếu bảo trì.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setSaving(true);
    try {
      const res = await api.patch(`/maintenance/${id}`, {
        status: form.status,
        vendorName: form.vendorName,
        performedBy: form.performedBy,
        cost: form.cost ? Number(form.cost) : 0,
        receivedDate: form.receivedDate || undefined,
        completedDate: form.completedDate || undefined,
        workPerformed: form.workPerformed,
        replacedParts: form.replacedParts,
        documentRef: form.documentRef,
        notes: form.notes,
        logNote: form.logNote,
      });
      setTicket(res.data);
      syncForm(res.data);
      showNotice('success', 'Đã cập nhật phiếu bảo trì và ghi vào nhật ký.');
    } catch (err: any) {
      showNotice('error', err.response?.data?.message || 'Không thể cập nhật phiếu bảo trì.');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickStatus = async (targetStatus: string) => {
    if (!id || !ticket || ticket.status === targetStatus) return;
    setSaving(true);
    try {
      const targetLabel = MAINTENANCE_STATUS_META[targetStatus]?.label || targetStatus;
      const res = await api.patch(`/maintenance/${id}`, {
        status: targetStatus,
        logNote: form.logNote.trim() || `Chuyển nhanh trạng thái sang "${targetLabel}"`,
      });
      setTicket(res.data);
      syncForm(res.data);
      showNotice(
        targetStatus === 'CANCELLED' ? 'error' : 'success',
        `Đã chuyển trạng thái phiếu sang "${targetLabel}".`,
      );
    } catch (err: any) {
      showNotice('error', err.response?.data?.message || 'Không thể chuyển trạng thái phiếu.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !newLogNote.trim()) return;
    setAddingLog(true);
    try {
      const res = await api.post(`/maintenance/${id}/logs`, {
        note: newLogNote.trim(),
        cost: newLogCost ? Number(newLogCost) : undefined,
      });
      setTicket((prev: any) => (prev ? { ...prev, logs: [res.data, ...(prev.logs || [])] } : prev));
      setNewLogNote('');
      setNewLogCost('');
      showNotice('success', 'Đã thêm ghi chú vào nhật ký xử lý.');
    } catch (err: any) {
      showNotice('error', err.response?.data?.message || 'Không thể thêm nhật ký.');
    } finally {
      setAddingLog(false);
    }
  };

  if (loading) {
    return (
      <div className="panel p-8 text-center text-sm text-ink-secondary">
        Đang tải thông tin phiếu bảo trì...
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="panel p-8 text-center space-y-3">
        <p className="text-sm text-ink-secondary">Không tìm thấy phiếu bảo trì này.</p>
        <Link to="/maintenance" className="btn-secondary inline-flex">
          <ArrowLeft className="w-4 h-4" /> Quay lại danh sách
        </Link>
      </div>
    );
  }

  const statusMeta = MAINTENANCE_STATUS_META[ticket.status] || MAINTENANCE_STATUS_META.OPEN;
  const typeMeta = MAINTENANCE_TYPE_META[ticket.maintenanceType] || MAINTENANCE_TYPE_META.REPAIR;
  const currentStepIdx = WORKFLOW_STEPS.findIndex((s) => s.key === ticket.status);
  const isCancelled = ticket.status === 'CANCELLED';

  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <Link to="/maintenance" className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-secondary hover:text-brand mb-1.5">
            <ArrowLeft className="w-3.5 h-3.5" /> Quay lại danh sách phiếu bảo trì
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm sm:text-base font-bold px-2.5 py-0.5 rounded bg-ink-primary text-white">
              {ticket.ticketCode}
            </span>
            <Badge label={typeMeta.label} cls={typeMeta.cls} />
            <Badge label={statusMeta.label} cls={statusMeta.cls} />
          </div>
          <p className="text-sm font-medium text-ink-primary mt-1.5">{ticket.issueSummary}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {ticket.asset?.id && (
            <Link to={`/assets/${ticket.asset.id}`} className="btn-secondary text-xs">
              <ExternalLink className="w-3.5 h-3.5" /> Xem hồ sơ tài sản
            </Link>
          )}
        </div>
      </div>

      {/* NOTICE BANNER (3s auto-dismiss) */}
      {notice && (
        <div
          className={`p-3 rounded-lg border text-sm flex items-center gap-2 ${
            notice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {notice.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      {/* TIẾN TRÌNH TRẠNG THÁI */}
      <div className="panel p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="text-sm font-semibold text-ink-primary">Trạng thái & Tiến trình xử lý</div>
          <div className="text-xs text-ink-muted">
            Tiếp nhận: <strong className="text-ink-primary">{formatDate(ticket.receivedDate)}</strong>
            {ticket.completedDate && (
              <> · Hoàn thành: <strong className="text-emerald-700">{formatDate(ticket.completedDate)}</strong></>
            )}
          </div>
        </div>

        {isCancelled ? (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <XCircle className="w-4 h-4 shrink-0" />
            <span>Phiếu bảo trì này đã bị hủy. Bạn vẫn có thể mở lại nếu cần xử lý tiếp.</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {WORKFLOW_STEPS.map((step, idx) => {
              const Icon = step.icon;
              const isCurrent = step.key === ticket.status;
              const isPassed = currentStepIdx >= 0 && idx < currentStepIdx;
              return (
                <div
                  key={step.key}
                  className={`p-3 rounded-lg border flex items-center gap-2.5 transition-colors ${
                    isCurrent
                      ? 'border-brand bg-brand/5 text-brand'
                      : isPassed
                        ? 'border-emerald-200 bg-emerald-50/70 text-emerald-700'
                        : 'border-line bg-slate-50/60 text-ink-muted'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wider opacity-75">Bước {idx + 1}</div>
                    <div className="text-xs font-semibold truncate">{step.label}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* CHUYỂN TRẠNG THÁI NHANH */}
        {canManage && (
          <div className="pt-3 border-t border-line flex flex-wrap items-center gap-2">
            <span className="text-xs text-ink-muted mr-1">Chuyển nhanh:</span>
            {ticket.status !== 'IN_PROGRESS' && ticket.status !== 'COMPLETED' && (
              <button
                type="button"
                disabled={saving}
                onClick={() => handleQuickStatus('IN_PROGRESS')}
                className="btn-secondary px-2.5 py-1.5 text-xs"
              >
                <PlayCircle className="w-3.5 h-3.5 text-amber-600" /> Bắt đầu sửa chữa
              </button>
            )}
            {ticket.status !== 'WAITING_PARTS' && ticket.status !== 'COMPLETED' && ticket.status !== 'CANCELLED' && (
              <button
                type="button"
                disabled={saving}
                onClick={() => handleQuickStatus('WAITING_PARTS')}
                className="btn-secondary px-2.5 py-1.5 text-xs"
              >
                <Package className="w-3.5 h-3.5 text-violet-600" /> Chờ linh kiện
              </button>
            )}
            {ticket.status !== 'COMPLETED' && (
              <button
                type="button"
                disabled={saving}
                onClick={() => handleQuickStatus('COMPLETED')}
                className="btn-primary px-2.5 py-1.5 text-xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Hoàn thành phiếu
              </button>
            )}
            {ticket.status !== 'CANCELLED' && ticket.status !== 'COMPLETED' && (
              <button
                type="button"
                disabled={saving}
                onClick={() => handleQuickStatus('CANCELLED')}
                className="btn-danger px-2.5 py-1.5 text-xs"
              >
                <XCircle className="w-3.5 h-3.5" /> Hủy phiếu
              </button>
            )}
            {(ticket.status === 'COMPLETED' || ticket.status === 'CANCELLED') && (
              <button
                type="button"
                disabled={saving}
                onClick={() => handleQuickStatus('IN_PROGRESS')}
                className="btn-secondary px-2.5 py-1.5 text-xs"
              >
                <Wrench className="w-3.5 h-3.5" /> Mở lại xử lý
              </button>
            )}
          </div>
        )}
      </div>

      {/* 2 CỘT CHÍNH */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* CỘT TRÁI: THÔNG TIN TÀI SẢN + CẬP NHẬT PHIẾU */}
        <div className="lg:col-span-7 space-y-5">
          {/* Thông tin tài sản */}
          <div className="panel p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-line">
              <span className="text-sm font-semibold text-ink-primary">Thông tin tài sản</span>
              {ticket.asset?.status && <AssetStatusBadge status={ticket.asset.status} />}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-ink-muted block">Mã tài sản</span>
                <Link to={`/assets/${ticket.asset?.id}`} className="font-mono font-semibold text-brand hover:underline">
                  {ticket.asset?.assetCode}
                </Link>
              </div>
              <div>
                <span className="text-ink-muted block">Tên thiết bị</span>
                <span className="font-medium text-ink-primary">{ticket.asset?.name}</span>
              </div>
              <div>
                <span className="text-ink-muted block">Loại / Số Serial</span>
                <span className="text-ink-primary">
                  {ticket.asset?.assetType?.name || '—'}
                  {ticket.asset?.serialNumber ? ` · SN: ${ticket.asset.serialNumber}` : ''}
                </span>
              </div>
              <div>
                <span className="text-ink-muted block">Phòng ban / Người sử dụng</span>
                <span className="text-ink-primary">
                  {ticket.asset?.usingDepartment?.name || 'Kho IT'}
                  {(ticket.asset?.assignedEmployee?.fullName || ticket.asset?.assignedUserName) &&
                    ` · ${ticket.asset?.assignedEmployee?.fullName || ticket.asset?.assignedUserName}`}
                </span>
              </div>
              {ticket.conditionBefore && (
                <div className="sm:col-span-2 pt-2 border-t border-line">
                  <span className="text-ink-muted block">Tình trạng khi tiếp nhận</span>
                  <span className="text-ink-primary">{ticket.conditionBefore}</span>
                </div>
              )}
            </div>
          </div>

          {/* Chi tiết & Cập nhật phiếu */}
          <form onSubmit={handleSave} className="panel p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-line">
              <span className="text-sm font-semibold text-ink-primary">Chi tiết xử lý & Chi phí</span>
              <span className="font-mono text-sm font-bold text-brand tabular-nums">
                {formatVnd(form.cost ? Number(form.cost) : 0)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="label-field">Trạng thái phiếu</label>
                <select
                  disabled={!canManage}
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="input-field"
                >
                  <option value="OPEN">Chờ tiếp nhận</option>
                  <option value="IN_PROGRESS">Đang sửa chữa</option>
                  <option value="WAITING_PARTS">Chờ linh kiện</option>
                  <option value="COMPLETED">Hoàn thành</option>
                  <option value="CANCELLED">Đã hủy</option>
                </select>
              </div>
              <div>
                <label className="label-field">Chi phí thực tế (VND)</label>
                <CurrencyInput
                  disabled={!canManage}
                  value={form.cost}
                  onChange={(raw) => setForm({ ...form, cost: raw })}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="label-field">Đơn vị sửa chữa / Bảo hành</label>
                <input
                  disabled={!canManage}
                  value={form.vendorName}
                  onChange={(e) => setForm({ ...form, vendorName: e.target.value })}
                  className="input-field"
                  placeholder="Nội bộ IT hoặc tên đơn vị sửa chữa"
                />
              </div>
              <div>
                <label className="label-field">Người phụ trách</label>
                <input
                  disabled={!canManage}
                  value={form.performedBy}
                  onChange={(e) => setForm({ ...form, performedBy: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="label-field">Ngày tiếp nhận</label>
                <DateInputVN
                  disabled={!canManage}
                  value={form.receivedDate}
                  onChange={(iso) => setForm({ ...form, receivedDate: iso })}
                />
              </div>
              <div>
                <label className="label-field">Ngày hoàn thành</label>
                <DateInputVN
                  disabled={!canManage}
                  value={form.completedDate}
                  onChange={(iso) => setForm({ ...form, completedDate: iso })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label-field">Nội dung công việc đã thực hiện</label>
                <textarea
                  disabled={!canManage}
                  rows={3}
                  value={form.workPerformed}
                  onChange={(e) => setForm({ ...form, workPerformed: e.target.value })}
                  className="input-field"
                  placeholder="Ghi nhận kết quả kiểm tra, sửa chữa, cài đặt..."
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label-field">Linh kiện đã thay thế</label>
                <input
                  disabled={!canManage}
                  value={form.replacedParts}
                  onChange={(e) => setForm({ ...form, replacedParts: e.target.value })}
                  className="input-field"
                  placeholder="Danh sách linh kiện đã thay thế"
                />
              </div>
              <div>
                <label className="label-field">Số chứng từ / Hóa đơn</label>
                <input
                  disabled={!canManage}
                  value={form.documentRef}
                  onChange={(e) => setForm({ ...form, documentRef: e.target.value })}
                  className="input-field font-mono"
                />
              </div>
              <div>
                <label className="label-field">Ghi chú phiếu</label>
                <input
                  disabled={!canManage}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="input-field"
                />
              </div>

              {canManage && (
                <div className="sm:col-span-2 pt-2 border-t border-line">
                  <label className="label-field">Ghi chú cho dòng nhật ký lần cập nhật này (tuỳ chọn)</label>
                  <input
                    value={form.logNote}
                    onChange={(e) => setForm({ ...form, logNote: e.target.value })}
                    className="input-field"
                    placeholder="Để trống để hệ thống tự tóm tắt các thay đổi"
                  />
                </div>
              )}
            </div>

            {canManage && (
              <div className="flex justify-end pt-2 border-t border-line">
                <button type="submit" disabled={saving} className="btn-primary">
                  <Save className="w-4 h-4" />
                  {saving ? 'Đang lưu...' : 'Lưu cập nhật & Ghi nhật ký'}
                </button>
              </div>
            )}
          </form>
        </div>

        {/* CỘT PHẢI: NHẬT KÝ XỬ LÝ PHIẾU (TIMELINE) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="panel p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-line">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-brand" />
                <span className="text-sm font-semibold text-ink-primary">
                  Nhật ký xử lý ({ticket.logs?.length || 0})
                </span>
              </div>
            </div>

            {/* Form thêm ghi chú nhanh */}
            {canManage && (
              <form onSubmit={handleAddLog} className="space-y-2.5 p-3 rounded-lg bg-slate-50 border border-line">
                <label className="text-xs font-semibold text-ink-primary block">Thêm ghi chú tiến độ</label>
                <textarea
                  required
                  rows={2}
                  value={newLogNote}
                  onChange={(e) => setNewLogNote(e.target.value)}
                  className="input-field text-xs"
                  placeholder="Ghi nhận kết quả kiểm tra, báo giá hãng, tình trạng đặt linh kiện..."
                />
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="flex-1">
                    <CurrencyInput
                      value={newLogCost}
                      onChange={setNewLogCost}
                      placeholder="Chi phí phát sinh (nếu có)"
                      className="input-field text-xs"
                    />
                  </div>
                  <button type="submit" disabled={addingLog || !newLogNote.trim()} className="btn-primary text-xs px-3 py-2 justify-center">
                    <Send className="w-3.5 h-3.5" />
                    {addingLog ? 'Đang ghi...' : 'Ghi nhật ký'}
                  </button>
                </div>
              </form>
            )}

            {/* Danh sách dòng nhật ký */}
            <div className="relative pl-5 space-y-4 before:content-[''] before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-px before:bg-line">
              {(!ticket.logs || ticket.logs.length === 0) ? (
                <p className="text-xs text-ink-muted py-4">Chưa có dòng nhật ký nào cho phiếu này.</p>
              ) : (
                ticket.logs.map((log: any) => {
                  const actMeta = LOG_ACTION_LABELS[log.action] || {
                    label: log.action,
                    cls: 'bg-slate-100 text-slate-700 border-slate-200',
                  };
                  const fromMeta = log.fromStatus ? MAINTENANCE_STATUS_META[log.fromStatus] : null;
                  const toMeta = log.toStatus ? MAINTENANCE_STATUS_META[log.toStatus] : null;
                  const statusChanged = log.fromStatus && log.toStatus && log.fromStatus !== log.toStatus;

                  return (
                    <div key={log.id} className="relative">
                      <span
                        className={`w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm absolute -left-5 top-1 ${
                          toMeta?.dot || 'bg-brand'
                        }`}
                      />
                      <div className="p-3 rounded-lg border border-line bg-white space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <Badge label={actMeta.label} cls={actMeta.cls} />
                          <span className="text-[11px] font-mono text-ink-muted">
                            {formatDateTime(log.createdAt)}
                          </span>
                        </div>

                        {statusChanged && fromMeta && toMeta && (
                          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                            <Badge label={fromMeta.label} cls={fromMeta.cls} />
                            <ArrowRight className="w-3 h-3 text-ink-muted" />
                            <Badge label={toMeta.label} cls={toMeta.cls} />
                          </div>
                        )}

                        {log.note && (
                          <p className="text-xs text-ink-primary whitespace-pre-wrap leading-relaxed">
                            {log.note}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-ink-muted">
                          <span>Người thực hiện: <strong className="text-ink-secondary">{log.actorName || 'Hệ thống'}</strong></span>
                          {log.cost != null && log.cost > 0 && (
                            <span className="font-mono font-semibold text-brand tabular-nums">
                              {formatVnd(log.cost)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
