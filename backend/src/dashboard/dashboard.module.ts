import { Module, Injectable, Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard, PermissionsGuard, RequirePermissions, CurrentUser, AuthUser, buildAssetScopeWhere } from '../auth/guards';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(user: AuthUser) {
    const scopeWhere = buildAssetScopeWhere(user);
    const assets = await this.prisma.asset.findMany({
      where: scopeWhere,
      include: {
        assetType: true,
        usingDepartment: true,
        purchase: true,
        agents: true,
      },
    });

    const now = new Date();
    const soonDate = new Date(now.getTime() + 60 * 86400_000);

    const totalAssets = assets.length;
    const inUse = assets.filter((a) => a.status === 'IN_USE').length;
    const unallocated = assets.filter((a) => a.status === 'UNALLOCATED').length;
    const maintenance = assets.filter((a) => a.status === 'MAINTENANCE').length;

    let warrantyExpiring = 0;
    let warrantyExpired = 0;
    let totalValue = 0;
    for (const a of assets) {
      if (a.purchase?.purchasePrice) totalValue += a.purchase.purchasePrice;
      const wEnd = a.purchase?.warrantyEndDate;
      if (wEnd) {
        if (wEnd < now) warrantyExpired++;
        else if (wEnd <= soonDate) warrantyExpiring++;
      }
    }

    const pendingApproval = await this.prisma.discoveredDevice.count({
      where: { approvalStatus: { in: ['PENDING', 'VERIFY_CONFLICT'] } },
    });

    const offlineSetting = await this.prisma.systemSetting.findUnique({ where: { key: 'agent.offline_threshold_min' } });
    const offlineCutoff = new Date(Date.now() - (Number(offlineSetting?.value) || 15) * 60_000);
    const allAgents = await this.prisma.deviceAgent.findMany({ where: { status: { not: 'REVOKED' } } });
    const agentsOffline = allAgents.filter(
      (ag) => !ag.lastHeartbeatAt || ag.lastHeartbeatAt < offlineCutoff || ag.status === 'OFFLINE',
    ).length;
    const agentsOnline = allAgents.length - agentsOffline;

    const unresolvedConfigAlerts = await this.prisma.alertEvent.count({
      where: {
        category: { in: ['CONFIG_CHANGE', 'SOFTWARE'] },
        status: { in: ['NEW', 'ACKNOWLEDGED', 'IN_PROGRESS'] },
      },
    });

    // Charts
    const byTypeMap = new Map<string, number>();
    const byDeptMap = new Map<string, number>();
    const byStatusMap = new Map<string, number>();
    const byYearMap = new Map<string, { year: string; count: number; value: number }>();

    const statusLabels: Record<string, string> = {
      IN_USE: 'Đang sử dụng',
      UNALLOCATED: 'Chưa phân bổ',
      MAINTENANCE: 'Đang sửa chữa',
      BROKEN: 'Hư hỏng',
      DISPOSED: 'Đã thanh lý',
      LOST: 'Thất lạc',
    };

    for (const a of assets) {
      const tName = a.assetType?.name || 'Khác';
      byTypeMap.set(tName, (byTypeMap.get(tName) || 0) + 1);

      const dName = a.usingDepartment?.name || 'Kho / Chưa phân bổ';
      byDeptMap.set(dName, (byDeptMap.get(dName) || 0) + 1);

      const sName = statusLabels[a.status] || a.status;
      byStatusMap.set(sName, (byStatusMap.get(sName) || 0) + 1);

      const y = a.purchase?.purchaseDate
        ? String(new Date(a.purchase.purchaseDate).getFullYear())
        : String(new Date(a.createdAt).getFullYear());
      const prev = byYearMap.get(y) || { year: y, count: 0, value: 0 };
      prev.count += 1;
      prev.value += a.purchase?.purchasePrice || 0;
      byYearMap.set(y, prev);
    }

    const alerts = await this.prisma.alertEvent.findMany({
      orderBy: { detectedAt: 'desc' },
      take: 100,
      include: { asset: { select: { id: true, assetCode: true, name: true } } },
    });

    const sevCounts = { INFO: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
    for (const al of alerts) {
      if (al.status === 'CLOSED' || al.status === 'IGNORED') continue;
      if (al.severity in sevCounts) sevCounts[al.severity as keyof typeof sevCounts]++;
    }

    const recentChanges = await this.prisma.deviceChange.findMany({
      include: {
        asset: { select: { id: true, assetCode: true, name: true, hostname: true } },
        agent: { select: { agentUid: true, hostname: true } },
      },
      orderBy: { detectedAt: 'desc' },
      take: 8,
    });

    // Build real 6-month movement trend from database (no hardcoded mock data)
    const monthBuckets: Array<{ key: string; month: string; added: number; transfers: number; repairs: number }> = [];
    const monthIndex = new Map<string, number>();
    const startOf6Months = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const key = `${yyyy}-${mm}`;
      monthIndex.set(key, monthBuckets.length);
      monthBuckets.push({ key, month: `${mm}/${yyyy}`, added: 0, transfers: 0, repairs: 0 });
    }

    const toMonthKey = (dt: Date) =>
      `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;

    for (const a of assets) {
      const idx = monthIndex.get(toMonthKey(new Date(a.createdAt)));
      if (idx !== undefined) monthBuckets[idx].added += 1;
    }

    const [recentTransfers, recentMaintenances] = await Promise.all([
      this.prisma.assetTransfer.findMany({
        where: { transferDate: { gte: startOf6Months } },
        select: { transferDate: true },
      }),
      this.prisma.assetMaintenance.findMany({
        where: { receivedDate: { gte: startOf6Months } },
        select: { receivedDate: true },
      }),
    ]);

    for (const tr of recentTransfers) {
      const idx = monthIndex.get(toMonthKey(new Date(tr.transferDate)));
      if (idx !== undefined) monthBuckets[idx].transfers += 1;
    }
    for (const m of recentMaintenances) {
      const idx = monthIndex.get(toMonthKey(new Date(m.receivedDate)));
      if (idx !== undefined) monthBuckets[idx].repairs += 1;
    }

    const movement = monthBuckets.map(({ month, added, transfers, repairs }) => ({
      month,
      added,
      transfers,
      repairs,
    }));

    return {
      kpis: {
        totalAssets,
        inUse,
        unallocated,
        pendingApproval,
        maintenance,
        warrantyExpiring,
        warrantyExpired,
        agentsOnline,
        agentsOffline,
        unresolvedConfigAlerts,
        totalValue,
      },
      charts: {
        byType: Array.from(byTypeMap.entries()).map(([name, value]) => ({ name, value })),
        byDepartment: Array.from(byDeptMap.entries()).map(([name, value]) => ({ name, value })),
        byStatus: Array.from(byStatusMap.entries()).map(([name, value]) => ({ name, value })),
        byYear: Array.from(byYearMap.values()).sort((a, b) => a.year.localeCompare(b.year)),
        movement,
        alertsBySeverity: [
          { name: 'Thông tin', key: 'INFO', value: sevCounts.INFO },
          { name: 'Trung bình', key: 'MEDIUM', value: sevCounts.MEDIUM },
          { name: 'Cao', key: 'HIGH', value: sevCounts.HIGH },
          { name: 'Nghiêm trọng', key: 'CRITICAL', value: sevCounts.CRITICAL },
        ],
      },
      recentAlerts: alerts.slice(0, 8),
      recentChanges,
    };
  }
}

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('api/v1/dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get()
  @RequirePermissions('dashboard.read')
  getOverview(@CurrentUser() user: AuthUser) {
    return this.service.getOverview(user);
  }
}

@Module({
  providers: [DashboardService],
  controllers: [DashboardController],
})
export class DashboardModule {}
