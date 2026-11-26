import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftRight, Plus, UserCheck } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { PageHeader, Modal, Badge } from '../components/UiPrimitives';
import { formatDate } from '../utils/format';

export const TransfersPage: React.FC = () => {
  const { can } = useAuth();
  const [tab, setTab] = useState<'transfers' | 'assignments'>('transfers');
  const [transfers, setTransfers] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>({ departments: [], locations: [] });
  const [modalMode, setModalMode] = useState<'transfer' | 'handover' | null>(null);
  const [msg, setMsg] = useState('');

  const [form, setForm] = useState({
    assetId: '',
    toDepartmentId: '',
    toUserName: '',
    toLocation: '',
    reason: '',
    handoverBy: '',
    receivedBy: '',
    notes: '',
  });

  const load = async () => {
    const [tr, asg, aRes, mRes] = await Promise.all([
      api.get('/transfers'),
      api.get('/transfers/assignments'),
      api.get('/assets'),
      api.get('/admin/meta'),
    ]);
    setTransfers(tr.data);
    setAssignments(asg.data);
    setAssets(aRes.data);
    setMeta(mRes.data);
  };

  useEffect(() => {
    load();
  }, []);

  const selectedAsset = assets.find((a) => a.id === form.assetId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    if (modalMode === 'transfer') {
      await api.post('/transfers', {
        assetId: form.assetId,
        toDepartmentId: form.toDepartmentId || undefined,
        toUserName: form.toUserName || undefined,
        toLocation: form.toLocation || undefined,
        reason: form.reason,
        handoverBy: form.handoverBy || undefined,
        receivedBy: form.receivedBy || form.toUserName || undefined,
        notes: form.notes || undefined,
      });
      setMsg('Đã lập phiếu điều chuyển, lưu lịch sử nghiệp vụ và cập nhật đơn vị sử dụng mới.');
    } else {
      await api.post('/transfers/handover', {
        assetId: form.assetId,
        departmentId: form.toDepartmentId || undefined,
        assigneeName: form.toUserName,
        locationDetail: form.toLocation || undefined,
        handoverBy: form.handoverBy || undefined,
        receivedBy: form.receivedBy || form.toUserName,
        notes: form.notes || undefined,
      });
      setMsg('Đã lập phiếu bàn giao và ghi nhận lịch sử sử dụng.');
    }
    setModalMode(null);
    setForm({ assetId: '', toDepartmentId: '', toUserName: '', toLocation: '', reason: '', handoverBy: '', receivedBy: '', notes: '' });
    load();
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Bàn giao & Điều chuyển tài sản"
        subtitle="Mọi thay đổi phòng ban hoặc người sử dụng đều phải thực hiện qua phiếu nghiệp vụ và lưu lịch sử đầy đủ."
        actions={
          can('transfers.manage') && (
            <>
              <button onClick={() => setModalMode('handover')} className="btn-secondary">
                <UserCheck className="w-4 h-4" /> Lập phiếu bàn giao
              </button>
              <button onClick={() => setModalMode('transfer')} className="btn-primary">
                <Plus className="w-4 h-4" /> Tạo phiếu điều chuyển
              </button>
            </>
          )
        }
      />

      {msg && <div className="p-3 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">{msg}</div>}

      <div className="flex gap-1 border-b border-line">
        <button
          onClick={() => setTab('transfers')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 ${tab === 'transfers' ? 'border-brand text-brand' : 'border-transparent text-ink-secondary'}`}
        >
          Phiếu điều chuyển ({transfers.length})
        </button>
        <button
          onClick={() => setTab('assignments')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 ${tab === 'assignments' ? 'border-brand text-brand' : 'border-transparent text-ink-secondary'}`}
        >
          Phiếu bàn giao & Lịch sử sử dụng ({assignments.length})
        </button>
      </div>

      {tab === 'transfers' && (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th-cell w-12 text-center">STT</th>
                  <th className="th-cell">Mã phiếu</th>
                  <th className="th-cell">Tài sản</th>
                  <th className="th-cell">Từ phòng ban / Người dùng</th>
                  <th className="th-cell">Đến phòng ban / Người dùng</th>
                  <th className="th-cell">Lý do điều chuyển</th>
                  <th className="th-cell">Ngày thực hiện</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((t, idx) => (
                  <tr key={t.id} className="hover:bg-slate-50/70">
                    <td className="td-cell text-center font-mono text-xs text-ink-muted tabular-nums">{idx + 1}</td>
                    <td className="td-cell font-mono text-xs font-semibold">{t.transferCode}</td>
                    <td className="td-cell">
                      <Link to={`/assets/${t.asset?.id}`} className="font-mono text-xs font-semibold text-brand hover:underline block">
                        {t.asset?.assetCode}
                      </Link>
                      <span className="text-xs text-ink-secondary">{t.asset?.name}</span>
                    </td>
                    <td className="td-cell text-xs">
                      <div>{t.fromDepartment?.name || 'Kho thiết bị'}</div>
                      <div className="text-ink-muted">{t.fromUserName || '—'}</div>
                    </td>
                    <td className="td-cell text-xs">
                      <div className="font-medium text-ink-primary">{t.toDepartment?.name || 'Kho thiết bị'}</div>
                      <div className="text-ink-secondary">{t.toUserName || '—'}</div>
                    </td>
                    <td className="td-cell text-xs max-w-xs">{t.reason}</td>
                    <td className="td-cell text-xs">{formatDate(t.transferDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'assignments' && (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th-cell w-12 text-center">STT</th>
                  <th className="th-cell">Mã bàn giao</th>
                  <th className="th-cell">Tài sản</th>
                  <th className="th-cell">Phòng ban / Người sử dụng</th>
                  <th className="th-cell">Bàn giao → Tiếp nhận</th>
                  <th className="th-cell">Ngày bàn giao</th>
                  <th className="th-cell">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((a, idx) => (
                  <tr key={a.id} className="hover:bg-slate-50/70">
                    <td className="td-cell text-center font-mono text-xs text-ink-muted tabular-nums">{idx + 1}</td>
                    <td className="td-cell font-mono text-xs font-semibold">{a.assignmentCode}</td>
                    <td className="td-cell">
                      <Link to={`/assets/${a.asset?.id}`} className="font-mono text-xs font-semibold text-brand hover:underline block">
                        {a.asset?.assetCode}
                      </Link>
                      <span className="text-xs text-ink-secondary">{a.asset?.name}</span>
                    </td>
                    <td className="td-cell text-xs">
                      <div className="font-medium">{a.department?.name || '—'}</div>
                      <div className="text-ink-secondary">{a.assigneeName}</div>
                    </td>
                    <td className="td-cell text-xs">{a.handoverBy} → {a.receivedBy}</td>
                    <td className="td-cell text-xs">{formatDate(a.handoverDate)}</td>
                    <td className="td-cell">
                      <Badge
                        label={a.status === 'ACTIVE' ? 'Đang nắm giữ' : 'Đã thu hồi / Chuyển'}
                        cls={a.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={!!modalMode}
        onClose={() => setModalMode(null)}
        title={modalMode === 'transfer' ? 'Tạo phiếu điều chuyển tài sản' : 'Lập phiếu bàn giao tài sản'}
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label-field">Chọn tài sản <span className="text-red-500">*</span></label>
            <select required value={form.assetId} onChange={(e) => setForm({ ...form, assetId: e.target.value })} className="input-field">
              <option value="">-- Chọn tài sản --</option>
              {assets.filter((a) => a.status !== 'DISPOSED').map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          {selectedAsset && (
            <div className="p-3 rounded bg-slate-50 border border-line text-xs flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 text-slate-400 shrink-0" />
              <span>
                Hiện tại: <strong>{selectedAsset.usingDepartment?.name || 'Kho / Chưa phân bổ'}</strong> — Người dùng:{' '}
                <strong>{selectedAsset.assignedUserName || 'Chưa gán'}</strong>
              </span>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label-field">Phòng ban tiếp nhận</label>
              <select value={form.toDepartmentId} onChange={(e) => setForm({ ...form, toDepartmentId: e.target.value })} className="input-field">
                <option value="">-- Trả về Kho IT --</option>
                {meta.departments.map((d: any) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-field">Người sử dụng mới <span className="text-red-500">*</span></label>
              <input required value={form.toUserName} onChange={(e) => setForm({ ...form, toUserName: e.target.value })} className="input-field" placeholder="Nhập họ tên người sử dụng" />
            </div>
            <div>
              <label className="label-field">Vị trí đặt thiết bị mới</label>
              <input value={form.toLocation} onChange={(e) => setForm({ ...form, toLocation: e.target.value })} className="input-field" placeholder="Nhập vị trí đặt thiết bị" />
            </div>
            <div>
              <label className="label-field">Người ký tiếp nhận</label>
              <input value={form.receivedBy} onChange={(e) => setForm({ ...form, receivedBy: e.target.value })} className="input-field" placeholder="Nhập người ký tiếp nhận" />
            </div>
          </div>

          {modalMode === 'transfer' && (
            <div>
              <label className="label-field">Lý do điều chuyển <span className="text-red-500">*</span></label>
              <textarea required rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="input-field" placeholder="Nhập lý do điều chuyển" />
            </div>
          )}

          <div>
            <label className="label-field">Ghi chú bổ sung</label>
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input-field" />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-line">
            <button type="button" onClick={() => setModalMode(null)} className="btn-secondary">Hủy</button>
            <button type="submit" className="btn-primary">Xác nhận & Lưu lịch sử</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
