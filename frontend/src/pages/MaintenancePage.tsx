import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, CheckCircle, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { PageHeader, Modal, Badge } from '../components/UiPrimitives';
import { formatDate, formatVnd } from '../utils/format';

export const MaintenancePage: React.FC = () => {
  const { can } = useAuth();
  const [tab, setTab] = useState<'maintenance' | 'disposals'>('maintenance');
  const [tickets, setTickets] = useState<any[]>([]);
  const [disposals, setDisposals] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [disposeOpen, setDisposeOpen] = useState(false);

  const [form, setForm] = useState({
    assetId: '',
    maintenanceType: 'REPAIR',
    issueSummary: '',
    conditionBefore: '',
    vendorName: '',
    workPerformed: '',
    replacedParts: '',
    cost: '',
    performedBy: '',
  });

  const [dispForm, setDispForm] = useState({
    assetId: '',
    reason: '',
    method: 'LIQUIDATION',
    salvageValue: '',
    decisionNumber: '',
  });

  const load = async () => {
    const [mRes, dRes, aRes] = await Promise.all([
      api.get('/maintenance'),
      api.get('/maintenance/disposals'),
      api.get('/assets'),
    ]);
    setTickets(mRes.data);
    setDisposals(dRes.data);
    setAssets(aRes.data);
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post('/maintenance', { ...form, cost: form.cost ? Number(form.cost) : 0 });
    setCreateOpen(false);
    setForm({ assetId: '', maintenanceType: 'REPAIR', issueSummary: '', conditionBefore: '', vendorName: '', workPerformed: '', replacedParts: '', cost: '', performedBy: '' });
    load();
  };

  const handleComplete = async (ticket: any) => {
    const costStr = window.prompt('Chi phí sửa chữa thực tế (VND):', String(ticket.cost || 0));
    if (costStr === null) return;
    const work = window.prompt('Nội dung đã hoàn tất:', ticket.workPerformed || 'Đã sửa chữa, kiểm tra hoạt động ổn định');
    await api.patch(`/maintenance/${ticket.id}`, {
      status: 'COMPLETED',
      cost: Number(costStr) || 0,
      workPerformed: work || ticket.workPerformed,
    });
    load();
  };

  const handleDispose = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post('/maintenance/disposals', { ...dispForm, salvageValue: dispForm.salvageValue ? Number(dispForm.salvageValue) : 0 });
    setDisposeOpen(false);
    setDispForm({ assetId: '', reason: '', method: 'LIQUIDATION', salvageValue: '', decisionNumber: '' });
    load();
  };

  const totalCost = tickets.reduce((s, t) => s + (t.cost || 0), 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Bảo trì, Sửa chữa & Thanh lý"
        subtitle={`Theo dõi phiếu sửa chữa, linh kiện thay thế, chi phí vòng đời (Tổng chi phí: ${formatVnd(totalCost)}) và hồ sơ thanh lý.`}
        actions={
          can('maintenance.manage') && (
            <>
              <button onClick={() => setDisposeOpen(true)} className="btn-secondary">
                <Trash2 className="w-4 h-4" /> Lập biên bản thanh lý
              </button>
              <button onClick={() => setCreateOpen(true)} className="btn-primary">
                <Plus className="w-4 h-4" /> Tạo phiếu sửa chữa
              </button>
            </>
          )
        }
      />

      <div className="flex gap-1 border-b border-line">
        <button onClick={() => setTab('maintenance')} className={`px-4 py-2.5 text-sm font-medium border-b-2 ${tab === 'maintenance' ? 'border-brand text-brand' : 'border-transparent text-ink-secondary'}`}>
          Phiếu bảo trì & sửa chữa ({tickets.length})
        </button>
        <button onClick={() => setTab('disposals')} className={`px-4 py-2.5 text-sm font-medium border-b-2 ${tab === 'disposals' ? 'border-brand text-brand' : 'border-transparent text-ink-secondary'}`}>
          Hồ sơ thanh lý ({disposals.length})
        </button>
      </div>

      {tab === 'maintenance' && (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th-cell w-12 text-center">STT</th>
                  <th className="th-cell">Mã phiếu</th>
                  <th className="th-cell">Tài sản</th>
                  <th className="th-cell">Nội dung & Linh kiện</th>
                  <th className="th-cell">Đơn vị / Thực hiện</th>
                  <th className="th-cell">Chi phí</th>
                  <th className="th-cell">Trạng thái</th>
                  <th className="th-cell text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t, idx) => (
                  <tr key={t.id} className="hover:bg-slate-50/70">
                    <td className="td-cell text-center font-mono text-xs text-ink-muted tabular-nums">{idx + 1}</td>
                    <td className="td-cell font-mono text-xs font-semibold">
                      <div>{t.ticketCode}</div>
                      <div className="text-[11px] font-normal text-ink-muted">{formatDate(t.receivedDate)}</div>
                    </td>
                    <td className="td-cell">
                      <Link to={`/assets/${t.asset?.id}`} className="font-mono text-xs font-semibold text-brand hover:underline block">
                        {t.asset?.assetCode}
                      </Link>
                      <span className="text-xs text-ink-secondary">{t.asset?.name}</span>
                    </td>
                    <td className="td-cell text-xs max-w-sm">
                      <div className="font-medium text-ink-primary">{t.issueSummary}</div>
                      {t.replacedParts && <div className="text-ink-secondary mt-0.5">Linh kiện: {t.replacedParts}</div>}
                    </td>
                    <td className="td-cell text-xs">
                      <div>{t.vendorName || 'Nội bộ IT'}</div>
                      <div className="text-ink-muted">{t.performedBy || '—'}</div>
                    </td>
                    <td className="td-cell font-mono text-xs font-medium tabular-nums">{formatVnd(t.cost)}</td>
                    <td className="td-cell">
                      <Badge
                        label={t.status === 'COMPLETED' ? 'Hoàn thành' : t.status === 'IN_PROGRESS' ? 'Đang sửa chữa' : t.status}
                        cls={t.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'}
                      />
                    </td>
                    <td className="td-cell text-right">
                      {t.status !== 'COMPLETED' && can('maintenance.manage') && (
                        <button onClick={() => handleComplete(t)} className="btn-primary px-2.5 py-1 text-xs">
                          <CheckCircle className="w-3.5 h-3.5" /> Hoàn thành
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'disposals' && (
        <div className="panel overflow-hidden">
          <table className="w-full">
            <thead><tr><th className="th-cell w-12 text-center">STT</th><th className="th-cell">Mã thanh lý</th><th className="th-cell">Tài sản</th><th className="th-cell">Số quyết định</th><th className="th-cell">Lý do</th><th className="th-cell">Giá trị thu hồi</th><th className="th-cell">Ngày thanh lý</th></tr></thead>
            <tbody>
              {disposals.length === 0 ? (
                <tr><td colSpan={7} className="td-cell text-center text-ink-muted py-8">Chưa có hồ sơ thanh lý.</td></tr>
              ) : (
                disposals.map((d, idx) => (
                  <tr key={d.id}>
                    <td className="td-cell text-center font-mono text-xs text-ink-muted tabular-nums">{idx + 1}</td>
                    <td className="td-cell font-mono text-xs font-semibold">{d.disposalCode}</td>
                    <td className="td-cell text-xs font-medium">{d.asset?.assetCode} — {d.asset?.name}</td>
                    <td className="td-cell font-mono text-xs">{d.decisionNumber || '—'}</td>
                    <td className="td-cell text-xs">{d.reason}</td>
                    <td className="td-cell font-mono text-xs tabular-nums">{formatVnd(d.salvageValue)}</td>
                    <td className="td-cell text-xs">{formatDate(d.disposalDate)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Tạo phiếu bảo trì / sửa chữa" maxWidth="max-w-xl">
        <form onSubmit={handleCreate} className="space-y-3.5">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label-field">Tài sản <span className="text-red-500">*</span></label>
              <select required value={form.assetId} onChange={(e) => setForm({ ...form, assetId: e.target.value })} className="input-field">
                <option value="">-- Chọn tài sản --</option>
                {assets.filter((a) => a.status !== 'DISPOSED').map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-field">Loại phiếu</label>
              <select value={form.maintenanceType} onChange={(e) => setForm({ ...form, maintenanceType: e.target.value })} className="input-field">
                <option value="REPAIR">Sửa chữa sự cố</option>
                <option value="UPGRADE">Nâng cấp phần cứng</option>
                <option value="PREVENTIVE">Bảo trì định kỳ</option>
                <option value="WARRANTY_CLAIM">Gửi bảo hành hãng</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label-field">Mô tả sự cố / Nội dung cần xử lý <span className="text-red-500">*</span></label>
            <input required value={form.issueSummary} onChange={(e) => setForm({ ...form, issueSummary: e.target.value })} className="input-field" placeholder="Nhập nội dung cần xử lý" />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label-field">Đơn vị sửa chữa</label>
              <input value={form.vendorName} onChange={(e) => setForm({ ...form, vendorName: e.target.value })} className="input-field" placeholder="Nhập đơn vị sửa chữa" />
            </div>
            <div>
              <label className="label-field">Chi phí dự kiến (VND)</label>
              <input type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="label-field">Linh kiện thay thế</label>
              <input value={form.replacedParts} onChange={(e) => setForm({ ...form, replacedParts: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="label-field">Người phụ trách</label>
              <input value={form.performedBy} onChange={(e) => setForm({ ...form, performedBy: e.target.value })} className="input-field" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-line">
            <button type="button" onClick={() => setCreateOpen(false)} className="btn-secondary">Hủy</button>
            <button type="submit" className="btn-primary">Tạo phiếu</button>
          </div>
        </form>
      </Modal>

      <Modal open={disposeOpen} onClose={() => setDisposeOpen(false)} title="Lập biên bản thanh lý tài sản" maxWidth="max-w-lg">
        <form onSubmit={handleDispose} className="space-y-3.5">
          <div>
            <label className="label-field">Tài sản thanh lý <span className="text-red-500">*</span></label>
            <select required value={dispForm.assetId} onChange={(e) => setDispForm({ ...dispForm, assetId: e.target.value })} className="input-field">
              <option value="">-- Chọn tài sản --</option>
              {assets.filter((a) => a.status !== 'DISPOSED').map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">Số quyết định</label>
              <input value={dispForm.decisionNumber} onChange={(e) => setDispForm({ ...dispForm, decisionNumber: e.target.value })} className="input-field font-mono" placeholder="Nhập số quyết định" />
            </div>
            <div>
              <label className="label-field">Giá trị thu hồi (VND)</label>
              <input type="number" value={dispForm.salvageValue} onChange={(e) => setDispForm({ ...dispForm, salvageValue: e.target.value })} className="input-field" />
            </div>
          </div>
          <div>
            <label className="label-field">Lý do thanh lý <span className="text-red-500">*</span></label>
            <textarea required rows={2} value={dispForm.reason} onChange={(e) => setDispForm({ ...dispForm, reason: e.target.value })} className="input-field" placeholder="Nhập lý do thanh lý" />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-line">
            <button type="button" onClick={() => setDisposeOpen(false)} className="btn-secondary">Hủy</button>
            <button type="submit" className="btn-danger">Xác nhận thanh lý</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
