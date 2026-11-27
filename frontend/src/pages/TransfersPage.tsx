import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, UserCheck, Printer, RotateCcw } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { PageHeader, Modal, Badge } from '../components/UiPrimitives';
import { HandoverReceipt, ReceiptData } from '../components/HandoverReceipt';
import { formatDate } from '../utils/format';

export const TransfersPage: React.FC = () => {
  const { can } = useAuth();
  const [tab, setTab] = useState<'transfers' | 'assignments'>('transfers');
  const [transfers, setTransfers] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [companyTitle, setCompanyTitle] = useState<string>('');
  const [orgInfo, setOrgInfo] = useState<any>(undefined);
  const [docTemplate, setDocTemplate] = useState<any>(undefined);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  const load = async () => {
    const [tr, asg, mRes] = await Promise.all([
      api.get('/transfers'),
      api.get('/transfers/assignments'),
      api.get('/admin/meta'),
    ]);
    setTransfers(tr.data || []);
    setAssignments(asg.data || []);
    setCompanyTitle(mRes.data?.qrConfig?.labelTitle || '');
    setOrgInfo(mRes.data?.orgInfo);
    setDocTemplate(mRes.data?.docTemplate);
  };

  useEffect(() => {
    load();
  }, []);

  const openTransferReceipt = (t: any) => {
    const isReturn = !t.toDepartmentId && (!t.toUserName || t.toUserName === 'Kho IT');
    setReceipt({
      kind: isReturn ? 'RETURN' : 'TRANSFER',
      code: t.transferCode,
      date: t.transferDate || t.createdAt,
      companyName: companyTitle,
      orgInfo,
      docTemplate,
      asset: {
        assetCode: t.asset?.assetCode || '—',
        name: t.asset?.name || '—',
        assetTypeName: t.asset?.assetType?.name,
        serialNumber: t.asset?.serialNumber,
        manufacturer: t.asset?.manufacturer,
        model: t.asset?.model,
      },
      fromDepartment: t.fromDepartment?.name || docTemplate?.departmentSubtitle || 'Phòng Công nghệ Thông tin',
      toDepartment: isReturn ? (docTemplate?.departmentSubtitle || 'Phòng Công nghệ Thông tin') : t.toDepartment?.name || '—',
      handoverBy: t.handoverBy || '',
      receivedBy: t.receivedBy || '',
      reason: t.reason,
      notes: t.notes || undefined,
    });
  };

  const openAssignmentReceipt = (a: any) => {
    setReceipt({
      kind: 'HANDOVER',
      code: a.assignmentCode,
      date: a.handoverDate || a.createdAt,
      companyName: companyTitle,
      orgInfo,
      docTemplate,
      asset: {
        assetCode: a.asset?.assetCode || '—',
        name: a.asset?.name || '—',
        assetTypeName: a.asset?.assetType?.name,
        serialNumber: a.asset?.serialNumber,
        manufacturer: a.asset?.manufacturer,
        model: a.asset?.model,
      },
      fromDepartment: docTemplate?.departmentSubtitle || 'Phòng Công nghệ Thông tin',
      toDepartment: a.department?.name || '—',
      handoverBy: a.handoverBy || '',
      receivedBy: a.receivedBy || '',
      reason: 'Cấp phát / Bàn giao tài sản cho đơn vị sử dụng',
      notes: a.notes || undefined,
    });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Bàn giao & Điều chuyển tài sản"
        subtitle="Quản lý toàn bộ biên bản cấp phát, điều chuyển và thu hồi tài sản về kho kèm lịch sử sử dụng đầy đủ."
        actions={
          can('transfers.manage') && (
            <>
              <Link to="/transfers/new?mode=handover" className="btn-primary !bg-emerald-600 hover:!bg-emerald-700">
                <UserCheck className="w-4 h-4" /> Cấp phát mới
              </Link>
              <Link to="/transfers/new?mode=transfer" className="btn-primary">
                <Plus className="w-4 h-4" /> Điều chuyển
              </Link>
              <Link to="/transfers/new?mode=return" className="btn-primary !bg-red-600 hover:!bg-red-700">
                <RotateCcw className="w-4 h-4" /> Thu hồi về kho
              </Link>
            </>
          )
        }
      />

      <div className="flex gap-1 border-b border-line overflow-x-auto no-scrollbar">
        <button
          onClick={() => setTab('transfers')}
          className={`px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 whitespace-nowrap ${tab === 'transfers' ? 'border-brand text-brand' : 'border-transparent text-ink-secondary'}`}
        >
          Phiếu điều chuyển & Thu hồi ({transfers.length})
        </button>
        <button
          onClick={() => setTab('assignments')}
          className={`px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 whitespace-nowrap ${tab === 'assignments' ? 'border-brand text-brand' : 'border-transparent text-ink-secondary'}`}
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
                  <th className="th-cell">Lý do thực hiện</th>
                  <th className="th-cell">Ngày thực hiện</th>
                  <th className="th-cell text-right">Biên bản</th>
                </tr>
              </thead>
              <tbody>
                {transfers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="td-cell text-center py-8 text-ink-muted">
                      Chưa có phiếu điều chuyển hoặc thu hồi nào.
                    </td>
                  </tr>
                ) : (
                  transfers.map((t, idx) => (
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
                      <td className="td-cell text-right">
                        <button
                          type="button"
                          onClick={() => openTransferReceipt(t)}
                          className="btn-secondary px-2.5 py-1 text-xs"
                          title="Xem & In biên bản"
                        >
                          <Printer className="w-3.5 h-3.5" /> Biên bản
                        </button>
                      </td>
                    </tr>
                  ))
                )}
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
                  <th className="th-cell text-right">Biên bản</th>
                </tr>
              </thead>
              <tbody>
                {assignments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="td-cell text-center py-8 text-ink-muted">
                      Chưa có phiếu bàn giao tài sản nào.
                    </td>
                  </tr>
                ) : (
                  assignments.map((a, idx) => (
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
                      <td className="td-cell text-right">
                        <button
                          type="button"
                          onClick={() => openAssignmentReceipt(a)}
                          className="btn-secondary px-2.5 py-1 text-xs"
                          title="Xem & In biên bản"
                        >
                          <Printer className="w-3.5 h-3.5" /> Biên bản
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Printable Official Receipt Modal */}
      <Modal
        open={!!receipt}
        onClose={() => setReceipt(null)}
        title={receipt ? `Biên bản chứng từ — ${receipt.code}` : 'Biên bản bàn giao / điều chuyển'}
        maxWidth="max-w-4xl"
      >
        {receipt && (
          <div className="space-y-4">
            <div className="no-print flex justify-end gap-2">
              <button type="button" onClick={() => window.print()} className="btn-primary">
                <Printer className="w-4 h-4" /> In biên bản / Lưu PDF
              </button>
              <button type="button" onClick={() => setReceipt(null)} className="btn-secondary">
                Đóng
              </button>
            </div>
            <HandoverReceipt data={receipt} />
          </div>
        )}
      </Modal>
    </div>
  );
};
