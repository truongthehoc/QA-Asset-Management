import { Module, Injectable, Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard, PermissionsGuard, RequirePermissions } from '../auth/guards';

function toCsv(headers: string[], rows: any[][]): string {
  const esc = (v: any) => {
    const s = v === null || v === undefined ? '' : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  return '\uFEFF' + [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\r\n');
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummaryReports() {
    const assets = await this.prisma.asset.findMany({
      include: {
        assetType: true,
        category: true,
        usingDepartment: true,
        location: true,
        purchase: { include: { supplier: true } },
        maintenances: true,
        agents: true,
      },
      orderBy: { assetCode: 'asc' },
    });

    const now = new Date();
    const soon = new Date(now.getTime() + 60 * 86400_000);

    const byDepartment: Record<string, { department: string; count: number; totalValue: number; maintenanceCost: number }> = {};
    const warrantyList: any[] = [];

    for (const a of assets) {
      const dept = a.usingDepartment?.name || 'Kho / Chưa phân bổ';
      const val = a.purchase?.purchasePrice || 0;
      const mCost = a.maintenances.reduce((s, m) => s + (m.cost || 0), 0);
      if (!byDepartment[dept]) {
        byDepartment[dept] = { department: dept, count: 0, totalValue: 0, maintenanceCost: 0 };
      }
      byDepartment[dept].count += 1;
      byDepartment[dept].totalValue += val;
      byDepartment[dept].maintenanceCost += mCost;

      if (a.purchase?.warrantyEndDate) {
        const wEnd = new Date(a.purchase.warrantyEndDate);
        const daysLeft = Math.ceil((wEnd.getTime() - now.getTime()) / 86400_000);
        if (wEnd <= soon) {
          warrantyList.push({
            assetId: a.id,
            assetCode: a.assetCode,
            name: a.name,
            department: dept,
            supplier: a.purchase.supplier?.name || '-',
            warrantyEndDate: wEnd,
            daysLeft,
            status: daysLeft < 0 ? 'EXPIRED' : 'EXPIRING',
          });
        }
      }
    }

    const configChanges = await this.prisma.deviceChange.findMany({
      include: { asset: { select: { assetCode: true, name: true } }, verifiedBy: { select: { fullName: true } } },
      orderBy: { detectedAt: 'desc' },
      take: 100,
    });

    const maintenances = await this.prisma.assetMaintenance.findMany({
      include: { asset: { select: { assetCode: true, name: true, usingDepartment: true } } },
      orderBy: { receivedDate: 'desc' },
    });

    const unrecordedDevices = await this.prisma.discoveredDevice.findMany({
      where: { approvalStatus: { in: ['PENDING', 'VERIFY_CONFLICT'] } },
      orderBy: { lastSeenAt: 'desc' },
    });

    const inventoryDiscrepancies = await this.prisma.inventoryItem.findMany({
      where: { status: { notIn: ['CHECKED', 'NOT_CHECKED'] } },
      include: {
        session: { select: { sessionCode: true, name: true } },
        asset: { select: { assetCode: true, name: true, usingDepartment: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return {
      assets,
      byDepartment: Object.values(byDepartment),
      warrantyList: warrantyList.sort((a, b) => a.daysLeft - b.daysLeft),
      configChanges,
      maintenances,
      unrecordedDevices,
      inventoryDiscrepancies,
    };
  }

  async exportCsv(type: string) {
    const data = await this.getSummaryReports();
    if (type === 'warranty') {
      return toCsv(
        ['Mã tài sản', 'Tên tài sản', 'Phòng ban', 'Nhà cung cấp', 'Hết bảo hành', 'Số ngày còn lại', 'Trạng thái'],
        data.warrantyList.map((w) => [
          w.assetCode,
          w.name,
          w.department,
          w.supplier,
          new Date(w.warrantyEndDate).toLocaleDateString('vi-VN'),
          w.daysLeft,
          w.status === 'EXPIRED' ? 'Đã hết hạn' : 'Sắp hết hạn',
        ]),
      );
    }
    if (type === 'changes') {
      return toCsv(
        ['Mã tài sản', 'Tên tài sản', 'Thành phần', 'Giá trị trước', 'Giá trị sau', 'Mức độ', 'Trạng thái', 'Thời điểm'],
        data.configChanges.map((c) => [
          c.asset?.assetCode || '-',
          c.asset?.name || '-',
          c.component,
          c.previousValue,
          c.newValue,
          c.severity,
          c.status,
          new Date(c.detectedAt).toLocaleString('vi-VN'),
        ]),
      );
    }
    if (type === 'maintenance') {
      return toCsv(
        ['Mã phiếu', 'Mã tài sản', 'Tên tài sản', 'Loại', 'Mô tả', 'Đơn vị sửa chữa', 'Chi phí (VND)', 'Trạng thái'],
        data.maintenances.map((m) => [
          m.ticketCode,
          m.asset?.assetCode,
          m.asset?.name,
          m.maintenanceType,
          m.issueSummary,
          m.vendorName || '-',
          m.cost,
          m.status,
        ]),
      );
    }
    return toCsv(
      ['Mã tài sản', 'Tên tài sản', 'Loại', 'Trạng thái', 'Serial', 'Hostname', 'Phòng ban', 'Người sử dụng', 'Giá mua (VND)', 'Hết bảo hành'],
      data.assets.map((a) => [
        a.assetCode,
        a.name,
        a.assetType?.name || '',
        a.status,
        a.serialNumber || '',
        a.hostname || '',
        a.usingDepartment?.name || '',
        a.assignedUserName || '',
        a.purchase?.purchasePrice || 0,
        a.purchase?.warrantyEndDate ? new Date(a.purchase.warrantyEndDate).toLocaleDateString('vi-VN') : '',
      ]),
    );
  }
}

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('api/v1/reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('summary')
  @RequirePermissions('reports.read')
  getSummary() {
    return this.service.getSummaryReports();
  }

  @Get('export')
  @RequirePermissions('reports.read')
  async export(@Query('type') type: string, @Res() res: Response) {
    const csv = await this.service.exportCsv(type || 'assets');
    const filename = `bao-cao-${type || 'tai-san'}-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(csv);
  }
}

@Module({
  providers: [ReportsService],
  controllers: [ReportsController],
})
export class ReportsModule {}
