import React from 'react';
import { formatDate, formatDateTime } from '../utils/format';

export interface OrgInfoConfig {
  name?: string;
  address?: string;
  taxCode?: string;
  logoUrl?: string;
}

export interface DocTemplateConfig {
  departmentSubtitle?: string;
  headerFields?: string[];
}

export interface ReceiptData {
  kind: 'HANDOVER' | 'TRANSFER' | 'RETURN';
  code: string;
  date: string;
  companyName?: string;
  orgInfo?: OrgInfoConfig;
  docTemplate?: DocTemplateConfig;
  asset: {
    assetCode: string;
    name: string;
    assetTypeName?: string;
    serialNumber?: string | null;
    manufacturer?: string | null;
    model?: string | null;
  };
  fromDepartment?: string;
  fromUser?: string;
  fromLocation?: string;
  toDepartment?: string;
  toUser?: string;
  toLocation?: string;
  handoverBy: string;
  receivedBy: string;
  reason?: string;
  notes?: string;
}

export const HandoverReceipt: React.FC<{ data: ReceiptData }> = ({ data }) => {
  const titleMap = {
    HANDOVER: 'BIÊN BẢN BÀN GIAO TÀI SẢN',
    TRANSFER: 'BIÊN BẢN ĐIỀU CHUYỂN TÀI SẢN',
    RETURN: 'BIÊN BẢN THU HỒI TÀI SẢN VỀ KHO',
  };

  const subtitleMap = {
    HANDOVER: 'Ghi nhận việc cấp phát, bàn giao tài sản cho đơn vị / nhân viên sử dụng',
    TRANSFER: 'Ghi nhận việc điều chuyển quyền sử dụng tài sản giữa các đơn vị / nhân sự',
    RETURN: 'Ghi nhận việc thu hồi tài sản đang sử dụng trả về Kho thiết bị CNTT',
  };

  const d = data.date ? new Date(data.date) : new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const MM = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const dateText = `Ngày ${dd} tháng ${MM} năm ${yyyy}`;
  const locationDept =
    data.kind === 'RETURN'
      ? data.fromDepartment || '................................'
      : data.toDepartment || '................................';
  const specText = [data.asset.manufacturer, data.asset.model].filter(Boolean).join(' ') || '—';
  const cleanName = (v?: string | null) => {
    const t = (v || '').trim();
    return t && t !== '—' ? t : '';
  };
  const handoverName = cleanName(data.handoverBy);
  const receivedName = cleanName(data.receivedBy);

  const headerFields = new Set<string>(
    data.docTemplate?.headerFields && data.docTemplate.headerFields.length > 0
      ? data.docTemplate.headerFields
      : ['logo', 'name', 'address', 'taxCode', 'departmentSubtitle', 'nationalMotto'],
  );
  const orgName = data.orgInfo?.name?.trim() || data.companyName?.trim() || 'HỆ THỐNG QUẢN LÝ TÀI SẢN CNTT';
  const orgAddress = data.orgInfo?.address?.trim() || '';
  const orgTaxCode = data.orgInfo?.taxCode?.trim() || '';
  const orgLogoUrl = data.orgInfo?.logoUrl?.trim() || '';
  const deptSubtitle = data.docTemplate?.departmentSubtitle?.trim() || 'Phòng Công nghệ Thông tin';

  return (
    <div className="receipt-printable bg-white border border-slate-300 rounded-xl p-6 sm:p-8 text-slate-900 shadow-xs max-w-4xl mx-auto print:border-0 print:shadow-none print:p-0 print:rounded-none">
      {/* Header: Organization & National Motto */}
      <div className="grid grid-cols-2 gap-4 pb-2">
        <div className="flex items-start gap-3">
          {headerFields.has('logo') && orgLogoUrl && (
            <img src={orgLogoUrl} alt="Logo đơn vị" className="h-14 w-20 object-contain shrink-0" />
          )}
          <div className="text-left min-w-0">
            {headerFields.has('name') && (
              <div className="text-xs font-bold uppercase tracking-wide text-slate-900">{orgName}</div>
            )}
            {headerFields.has('departmentSubtitle') && deptSubtitle && (
              <div className="text-[11px] text-slate-600 mt-0.5">{deptSubtitle}</div>
            )}
            {headerFields.has('address') && orgAddress && (
              <div className="text-[11px] text-slate-600 mt-0.5">Địa chỉ: {orgAddress}</div>
            )}
            {headerFields.has('taxCode') && orgTaxCode && (
              <div className="text-[11px] font-mono text-slate-600 mt-0.5">MST: {orgTaxCode}</div>
            )}
            <div className="text-[11px] font-mono text-slate-700 mt-1.5">
              Số biên bản: <strong className="text-slate-900">{data.code}</strong>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <div className="text-center">
            {headerFields.has('nationalMotto') && (
              <>
                <div className="text-xs font-bold uppercase text-slate-800">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                <div className="text-[11px] font-semibold text-slate-700 mt-0.5">Độc lập - Tự do - Hạnh phúc</div>
                <div className="w-28 border-b border-slate-700 mx-auto mt-1" />
              </>
            )}
            <div className="text-[11px] italic text-slate-600 mt-1.5">{dateText}</div>
          </div>
        </div>
      </div>

      {/* Document Title */}
      <div className="text-center my-5">
        <h1 className="text-lg sm:text-xl font-bold tracking-wide text-slate-900 uppercase">{titleMap[data.kind]}</h1>
        <p className="text-xs text-slate-500 mt-1">{subtitleMap[data.kind]}</p>
      </div>

      {/* Opening line */}
      <div className="mb-3 space-y-1 text-xs text-slate-800">
        <p>
          Hôm nay, <strong>{hh}</strong> giờ <strong>{mm}</strong> phút, ngày <strong>{dd}</strong> tháng <strong>{MM}</strong> năm <strong>{yyyy}</strong>, tại:{' '}
          <strong>{locationDept}</strong>.
        </p>
        <p className="font-semibold">Chúng tôi bao gồm:</p>
      </div>

      {/* Party A & Party B */}
      <div className="grid sm:grid-cols-2 gap-4 mb-5 text-xs">
        <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/60 print:bg-white">
          <div className="font-bold uppercase text-[11px] text-brand mb-2">
            Bên giao (Bên A)
          </div>
          <div className="space-y-1.5">
            <div><span className="text-slate-500">Họ tên người giao:</span> <strong>{handoverName}</strong></div>
            <div><span className="text-slate-500">Phòng ban:</span> <strong>{data.fromDepartment || ''}</strong></div>
          </div>
        </div>

        <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/60 print:bg-white">
          <div className="font-bold uppercase text-[11px] text-emerald-700 mb-2">
            Bên tiếp nhận (Bên B)
          </div>
          <div className="space-y-1.5">
            <div><span className="text-slate-500">Họ tên người tiếp nhận:</span> <strong>{receivedName}</strong></div>
            <div><span className="text-slate-500">Phòng ban:</span> <strong>{data.toDepartment || ''}</strong></div>
          </div>
        </div>
      </div>

      {/* Asset Table */}
      <div className="mb-5">
        <div className="text-xs font-bold uppercase text-slate-700 mb-2">I. Thông tin tài sản bàn giao</div>
        <table className="w-full border-collapse border border-slate-300 text-xs">
          <thead>
            <tr className="bg-slate-100 print:bg-slate-100">
              <th className="border border-slate-300 px-2.5 py-2 text-center w-10 font-semibold">STT</th>
              <th className="border border-slate-300 px-2.5 py-2 text-left font-semibold">Mã tài sản</th>
              <th className="border border-slate-300 px-2.5 py-2 text-left font-semibold">Tên tài sản / Thiết bị</th>
              <th className="border border-slate-300 px-2.5 py-2 text-left font-semibold">Loại</th>
              <th className="border border-slate-300 px-2.5 py-2 text-left font-semibold">Hãng / Model</th>
              <th className="border border-slate-300 px-2.5 py-2 text-left font-semibold">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-slate-300 px-2.5 py-2.5 text-center font-mono">1</td>
              <td className="border border-slate-300 px-2.5 py-2.5 font-mono font-bold text-slate-900">{data.asset.assetCode}</td>
              <td className="border border-slate-300 px-2.5 py-2.5 font-medium">{data.asset.name}</td>
              <td className="border border-slate-300 px-2.5 py-2.5">{data.asset.assetTypeName || '—'}</td>
              <td className="border border-slate-300 px-2.5 py-2.5">{specText}</td>
              <td className="border border-slate-300 px-2.5 py-2.5">{data.notes || '—'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Reason & Notes */}
      <div className="mb-6 space-y-2 text-xs">
        <div className="text-xs font-bold uppercase text-slate-700">II. Nội dung & Cam kết</div>
        {data.reason && (
          <div>
            <span className="text-slate-600 font-medium">Lý do thực hiện:</span>{' '}
            <span className="text-slate-900">{data.reason}</span>
          </div>
        )}
        <div>
          <span className="text-slate-600 font-medium">Tình trạng / Ghi chú kèm theo:</span>{' '}
          <span className="text-slate-900">{data.notes || 'Thiết bị đầy đủ phụ kiện, hoạt động bình thường tại thời điểm bàn giao.'}</span>
        </div>
        <p className="text-[11px] text-slate-600 leading-relaxed pt-1">
          Hai bên thống nhất xác nhận thông tin tài sản nêu trên. Bên tiếp nhận có trách nhiệm bảo quản, sử dụng đúng mục đích công việc,
          không tự ý tháo lắp hoặc thay đổi cấu hình phần cứng khi chưa có sự đồng ý của Bộ phận Công nghệ Thông tin.
          Biên bản được lập thành 02 bản có giá trị như nhau, mỗi bên giữ 01 bản (và lưu bản điện tử trên hệ thống quản lý tài sản).
        </p>
      </div>

      {/* Signatures */}
      <div className={`grid ${data.kind === 'TRANSFER' ? 'grid-cols-4' : 'grid-cols-3'} gap-4 pt-4 text-center text-xs`}>
        <div>
          <div className="font-bold uppercase text-slate-800">Bên bàn giao</div>
          <div className="text-[11px] italic text-slate-500 mt-0.5">(Ký, ghi rõ họ tên)</div>
          <div className="h-20" />
          <div className="font-semibold text-slate-900 min-h-[1rem]">{handoverName}</div>
        </div>
        <div>
          <div className="font-bold uppercase text-slate-800">Bên tiếp nhận</div>
          <div className="text-[11px] italic text-slate-500 mt-0.5">(Ký, ghi rõ họ tên)</div>
          <div className="h-20" />
          <div className="font-semibold text-slate-900 min-h-[1rem]">{receivedName}</div>
        </div>
        {data.kind === 'TRANSFER' && (
          <div>
            <div className="font-bold uppercase text-slate-800">Phòng CNTT</div>
            <div className="text-[11px] italic text-slate-500 mt-0.5">(Ký, ghi rõ họ tên)</div>
            <div className="h-20" />
            <div className="font-semibold text-slate-900 min-h-[1rem]" />
          </div>
        )}
        <div>
          <div className="font-bold uppercase text-slate-800">Tài chính Kế toán</div>
          <div className="text-[11px] italic text-slate-500 mt-0.5">(Ký, ghi rõ họ tên)</div>
          <div className="h-20" />
          <div className="font-semibold text-slate-900 min-h-[1rem]" />
        </div>
      </div>

      <div className="mt-6 pt-3 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-400">
        <span>Mã chứng từ: {data.code}</span>
        <span>Thời gian ghi nhận: {formatDateTime(data.date)} ({formatDate(data.date)})</span>
      </div>
    </div>
  );
};
