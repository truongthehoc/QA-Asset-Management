import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  HardDrive,
  Building2,
  UserCheck,
  MapPin,
  Calendar,
  ShieldCheck,
  ExternalLink,
  AlertCircle,
  Cpu,
  Tag,
} from 'lucide-react';
import axios from 'axios';
import { formatDate } from '../utils/format';

export const AssetQrPublicPage: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const [asset, setAsset] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!code) return;
    setLoading(true);
    setError('');
    axios
      .get(`/api/v1/public/assets/${encodeURIComponent(code)}`)
      .then((res) => setAsset(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Không tìm thấy thông tin tài sản tương ứng với mã QR này.'))
      .finally(() => setLoading(false));
  }, [code]);

  const statusLabel = asset?.statusCatalog?.name || asset?.status || '—';
  const statusBg = asset?.statusCatalog?.bgColor || '#ECFDF5';
  const statusText = asset?.statusCatalog?.textColor || '#047857';
  const qrTitle = asset?.qrConfig?.labelTitle?.trim() || 'THẺ THÔNG TIN TÀI SẢN';
  const fieldSet = new Set<string>(
    asset?.qrConfig?.fields && asset.qrConfig.fields.length > 0
      ? asset.qrConfig.fields
      : ['assetCode', 'name', 'assetType', 'serialNumber', 'department', 'employee', 'location', 'handoverDate', 'warrantyEndDate'],
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#eef8fc] via-slate-50 to-white px-4 py-8 flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-sky-200 text-xs font-semibold text-brand shadow-xs">
            <HardDrive className="w-3.5 h-3.5" />
            <span>{qrTitle}</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-lg overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-sm text-slate-500">Đang tra cứu thông tin tài sản...</div>
          ) : error || !asset ? (
            <div className="p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="font-semibold text-slate-800">Không tìm thấy tài sản</div>
              <p className="text-xs text-slate-500">{error}</p>
              <div className="pt-2">
                <Link to="/login" className="btn-primary text-xs">
                  Đăng nhập hệ thống quản trị
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="bg-gradient-to-r from-[#005B7F] to-[#007BA7] p-5 text-white">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] uppercase tracking-wider text-sky-100/90 font-medium">Mã tài sản</div>
                    <div className="font-mono text-xl font-bold tracking-tight mt-0.5 break-all">{asset.assetCode}</div>
                  </div>
                  <span
                    className="px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 border border-white/25"
                    style={{ backgroundColor: statusBg, color: statusText }}
                  >
                    {statusLabel}
                  </span>
                </div>
                <div className="mt-3 text-sm font-semibold text-white/95">{asset.name}</div>
                {asset.assetType?.name && (
                  <div className="text-xs text-sky-100 mt-0.5 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5" />
                    <span>{asset.category?.name ? `${asset.category.name} · ` : ''}{asset.assetType.name}</span>
                  </div>
                )}
              </div>

              <div className="p-5 space-y-4">
                <div className="grid grid-cols-1 gap-3 text-xs">
                  {(fieldSet.has('department') || fieldSet.has('employee') || fieldSet.has('location')) && (
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/70 space-y-2">
                      {fieldSet.has('department') && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-500 inline-flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-brand" /> Phòng ban sử dụng
                          </span>
                          <span className="font-semibold text-slate-800 text-right">
                            {asset.usingDepartment?.name || 'Kho / Chưa phân bổ'}
                          </span>
                        </div>
                      )}
                      {fieldSet.has('employee') && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-500 inline-flex items-center gap-1.5">
                            <UserCheck className="w-3.5 h-3.5 text-brand" /> Nhân viên sử dụng
                          </span>
                          <span className="font-semibold text-slate-800 text-right">
                            {asset.assignedEmployee
                              ? `${asset.assignedEmployee.code} — ${asset.assignedEmployee.fullName}`
                              : asset.assignedUserName || 'Chưa cấp phát'}
                          </span>
                        </div>
                      )}
                      {fieldSet.has('location') && (asset.location?.name || asset.locationDetail) && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-500 inline-flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-brand" /> Vị trí đặt máy
                          </span>
                          <span className="font-medium text-slate-700 text-right">
                            {[asset.location?.name, asset.locationDetail].filter(Boolean).join(' · ')}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="divide-y divide-slate-100 border border-slate-200/70 rounded-lg px-3">
                    <div className="py-2.5 flex items-center justify-between gap-2">
                      <span className="text-slate-500 inline-flex items-center gap-1.5">
                        <Cpu className="w-3.5 h-3.5 text-slate-400" /> Hãng / Model
                      </span>
                      <span className="font-medium text-slate-800 text-right">
                        {[asset.manufacturer, asset.model].filter(Boolean).join(' ') || '—'}
                      </span>
                    </div>
                    {fieldSet.has('serialNumber') && (
                      <div className="py-2.5 flex items-center justify-between gap-2">
                        <span className="text-slate-500">Số Serial (S/N)</span>
                        <span className="font-mono font-medium text-slate-800 text-right">{asset.serialNumber || '—'}</span>
                      </div>
                    )}
                    {asset.hostname && (
                      <div className="py-2.5 flex items-center justify-between gap-2">
                        <span className="text-slate-500">Hostname</span>
                        <span className="font-mono font-medium text-slate-800 text-right">{asset.hostname}</span>
                      </div>
                    )}
                    {fieldSet.has('handoverDate') && (
                      <div className="py-2.5 flex items-center justify-between gap-2">
                        <span className="text-slate-500 inline-flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" /> Ngày bàn giao
                        </span>
                        <span className="font-medium text-slate-800">{formatDate(asset.handoverDate)}</span>
                      </div>
                    )}
                    {fieldSet.has('warrantyEndDate') && (
                      <div className="py-2.5 flex items-center justify-between gap-2">
                        <span className="text-slate-500 inline-flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-slate-400" /> Hạn bảo hành
                        </span>
                        <span className="font-medium text-slate-800">{formatDate(asset.purchase?.warrantyEndDate)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-1">
                  <Link to={`/assets/${asset.id}`} className="btn-primary w-full justify-center text-xs py-2.5">
                    <ExternalLink className="w-3.5 h-3.5" /> Mở hồ sơ chi tiết trên hệ thống
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
