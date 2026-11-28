import { Module, Injectable, Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard, PermissionsGuard, RequirePermissions, CurrentUser, AuthUser, buildAssetScopeWhere } from '../auth/guards';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(user: AuthUser) {
    const scopeWhere = buildAssetScopeWhere(user);
    const [assets, licenses, contracts, pendingApproval, offlineSetting, allAgents, alerts, recentChanges] =
      await Promise.all([
        this.prisma.asset.findMany({
          where: scopeWhere,
          include: {
            assetType: true,
            usingDepartment: true,
            purchase: true,
            agents: true,
          },
        }),
        this.prisma.softwareLicense.findMany({
          where: { status: { not: 'CANCELLED' } },
          include: {
            allocations: { where: { status: 'ACTIVE' }, select: { seatCount: true } },
          },
          orderBy: { expirationDate: 'asc' },
        }),
        this.prisma.contract.findMany({
          where: { status: { notIn: ['TERMINATED', 'DRAFT'] }, endDate: { not: null } },
          orderBy: { endDate: 'asc' },
        }),
        this.prisma.discoveredDevice.count({
          where: { approvalStatus: { in: ['PENDING', 'VERIFY_CONFLICT'] } },
        }),
        this.prisma.systemSetting.findUnique({ where: { key: 'agent.offline_threshold_min' } }),
        this.prisma.deviceAgent.findMany({
          where: { status: { not: 'REVOKED' } },
          include: {
            snapshots: {
              orderBy: { collectedAt: 'desc' },
              take: 1,
              include: { software: { select: { displayName: true, publisher: true } } },
            },
          },
        }),
        this.prisma.alertEvent.findMany({
          orderBy: { detectedAt: 'desc' },
          take: 100,
          include: { asset: { select: { id: true, assetCode: true, name: true } } },
        }),
        this.prisma.deviceChange.findMany({
          include: {
            asset: { select: { id: true, assetCode: true, name: true, hostname: true } },
            agent: { select: { agentUid: true, hostname: true } },
          },
          orderBy: { detectedAt: 'desc' },
          take: 8,
        }),
      ]);

    const now = new Date();
    const soonDate = new Date(now.getTime() + 60 * 86400_000);

    // 1. Asset KPIs
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

    const offlineCutoff = new Date(Date.now() - (Number(offlineSetting?.value) || 15) * 60_000);
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

    // 2. Software License KPIs & Expiry Analytics
    let totalLicenses = 0;
    let activeLicenses = 0;
    let expiringLicenses = 0;
    let expiredLicenses = 0;
    let totalLicenseValue = 0;

    // Next 5 months buckets for "License sắp hết hạn theo tháng"
    const expMonthBuckets: Array<{ key: string; month: string; count: number }> = [];
    const expMonthIdx = new Map<string, number>();
    for (let i = 0; i < 5; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const yyyy = d.getFullYear();
      const mmNum = d.getMonth() + 1;
      const mm = String(mmNum).padStart(2, '0');
      const key = `${yyyy}-${mm}`;
      expMonthIdx.set(key, expMonthBuckets.length);
      expMonthBuckets.push({
        key,
        month: i === 0 ? `Th${mm}` : `T${mm}`,
        count: 0,
      });
    }

    const expiringLicenseList: Array<{
      id: string;
      licenseCode: string;
      name: string;
      totalSeats: number;
      usedSeats: number;
      expirationDate: Date | null;
      daysRemaining: number | null;
      effectiveStatus: string;
      contractNumber: string | null;
    }> = [];

    const licenseAlerts: Array<{
      id: string;
      scope: 'LICENSE';
      severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'INFO';
      title: string;
      message: string;
      detectedAt: string;
      link: string;
      badgeLabel: string;
    }> = [];

    for (const lic of licenses) {
      const seats = Math.max(1, lic.totalSeats || 1);
      const usedSeats = lic.allocations.reduce((s, a) => s + (a.seatCount || 1), 0);
      totalLicenses += seats;
      totalLicenseValue += lic.purchasePrice || 0;

      let effectiveStatus = lic.status || 'ACTIVE';
      let daysRemaining: number | null = null;
      if (effectiveStatus !== 'REVOKED' && lic.expirationDate) {
        daysRemaining = Math.ceil((new Date(lic.expirationDate).getTime() - now.getTime()) / 86_400_000);
        if (daysRemaining < 0) effectiveStatus = 'EXPIRED';
        else if (daysRemaining <= 30) effectiveStatus = 'EXPIRING_SOON';
        else effectiveStatus = 'ACTIVE';
      }

      if (effectiveStatus === 'ACTIVE') activeLicenses += seats;
      else if (effectiveStatus === 'EXPIRING_SOON') expiringLicenses += seats;
      else if (effectiveStatus === 'EXPIRED') expiredLicenses += seats;

      if (lic.expirationDate) {
        const expDt = new Date(lic.expirationDate);
        const key = `${expDt.getFullYear()}-${String(expDt.getMonth() + 1).padStart(2, '0')}`;
        const bIdx = expMonthIdx.get(key);
        if (bIdx !== undefined) {
          expMonthBuckets[bIdx].count += seats;
        }

        if (daysRemaining !== null && daysRemaining <= 90) {
          expiringLicenseList.push({
            id: lic.id,
            licenseCode: lic.licenseCode,
            name: lic.name,
            totalSeats: seats,
            usedSeats,
            expirationDate: lic.expirationDate,
            daysRemaining,
            effectiveStatus,
            contractNumber: lic.contractNumber,
          });
        }

        if (effectiveStatus === 'EXPIRED' || effectiveStatus === 'EXPIRING_SOON') {
          const isUrgent = effectiveStatus === 'EXPIRED' || (daysRemaining !== null && daysRemaining <= 7);
          licenseAlerts.push({
            id: `lic-${lic.id}`,
            scope: 'LICENSE',
            severity: isUrgent ? 'CRITICAL' : 'HIGH',
            title:
              effectiveStatus === 'EXPIRED'
                ? `License ${lic.name} đã hết hạn (${Math.abs(daysRemaining || 0)} ngày)`
                : `License ${lic.name} sắp hết hạn (còn ${daysRemaining} ngày)`,
            message: `Mã: ${lic.licenseCode} • ${seats} suất${lic.contractNumber ? ` • HĐ: ${lic.contractNumber}` : ''}`,
            detectedAt: (lic.updatedAt || lic.createdAt).toISOString(),
            link: `/software/licenses/${lic.id}`,
            badgeLabel: isUrgent ? 'Ưu tiên' : 'Cảnh báo',
          });
        }
      }
    }

    // 3. Installed Software by Publisher (from latest agent snapshots)
    const uniqueSwNames = new Set<string>();
    const pubCounts = new Map<string, number>();
    for (const ag of allAgents) {
      const snap = ag.snapshots[0];
      if (!snap) continue;
      for (const sw of snap.software) {
        uniqueSwNames.add(sw.displayName.toLowerCase());
        const rawPub = (sw.publisher || '').toLowerCase();
        let bucket = 'Khác';
        if (rawPub.includes('microsoft')) bucket = 'Microsoft';
        else if (rawPub.includes('adobe')) bucket = 'Adobe';
        else if (rawPub.includes('google')) bucket = 'Google';
        else if (rawPub.includes('autodesk')) bucket = 'Autodesk';
        pubCounts.set(bucket, (pubCounts.get(bucket) || 0) + 1);
      }
    }
    const softwareByPublisher = Array.from(pubCounts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => (a.name === 'Khác' ? 1 : b.name === 'Khác' ? -1 : b.value - a.value));

    // 4. Asset Charts
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
      const tName = a.assetType?.name || 'Thiết bị khác';
      byTypeMap.set(tName, (byTypeMap.get(tName) || 0) + 1);

      const dName = a.usingDepartment?.name || 'Kho IT';
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

    const sortedTypes = Array.from(byTypeMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    const byType =
      sortedTypes.length > 4
        ? [
            ...sortedTypes.slice(0, 3),
            { name: 'Thiết bị khác', value: sortedTypes.slice(3).reduce((s, x) => s + x.value, 0) },
          ]
        : sortedTypes;

    const sortedDepts = Array.from(byDeptMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    const byDepartment =
      sortedDepts.length > 5
        ? [
            ...sortedDepts.slice(0, 4),
            { name: 'Khác', value: sortedDepts.slice(4).reduce((s, x) => s + x.value, 0) },
          ]
        : sortedDepts;

    const sevCounts = { INFO: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
    const openAssetAlerts: Array<{
      id: string;
      scope: 'ASSET';
      severity: string;
      title: string;
      message: string;
      detectedAt: string;
      link: string;
      badgeLabel: string;
    }> = [];

    for (const al of alerts) {
      if (al.status === 'CLOSED' || al.status === 'IGNORED') continue;
      if (al.severity in sevCounts) sevCounts[al.severity as keyof typeof sevCounts]++;
      openAssetAlerts.push({
        id: al.id,
        scope: 'ASSET',
        severity: al.severity,
        title: al.title,
        message: al.message,
        detectedAt: al.detectedAt.toISOString(),
        link: `/alerts?tab=alerts&alertId=${al.id}`,
        badgeLabel:
          al.severity === 'CRITICAL'
            ? 'Ưu tiên'
            : al.severity === 'HIGH' || al.severity === 'MEDIUM'
              ? 'Cảnh báo'
              : 'Thông tin',
      });
    }

    // 6-month movement trend (real DB data)
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

    const contractAlerts: Array<{
      id: string;
      scope: 'CONTRACT';
      severity: 'CRITICAL' | 'HIGH';
      title: string;
      message: string;
      detectedAt: string;
      link: string;
      badgeLabel: string;
    }> = [];

    for (const c of contracts) {
      if (!c.endDate) continue;
      const diffDays = Math.ceil((new Date(c.endDate).getTime() - now.getTime()) / 86_400_000);
      const remindDays = Math.max(1, c.remindDaysBefore ?? 30);
      if (diffDays <= remindDays) {
        const isExpired = diffDays < 0;
        const isUrgent = isExpired || diffDays <= 7;
        contractAlerts.push({
          id: `contract-${c.id}`,
          scope: 'CONTRACT',
          severity: isUrgent ? 'CRITICAL' : 'HIGH',
          title: isExpired
            ? `Hợp đồng ${c.contractCode} đã hết hạn (${Math.abs(diffDays)} ngày)`
            : `Nhắc hẹn hợp đồng ${c.contractCode} sắp hết hạn (còn ${diffDays} ngày)`,
          message: `${c.title}${c.supplierName ? ` • NCC: ${c.supplierName}` : ''}`,
          detectedAt: (c.updatedAt || c.createdAt).toISOString(),
          link: `/contracts/${c.id}`,
          badgeLabel: isUrgent ? 'Ưu tiên' : 'Nhắc hẹn',
        });
      }
    }

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
        totalLicenses,
        activeLicenses,
        expiringLicenses,
        expiredLicenses,
        totalLicenseValue,
        licenseRecordsCount: licenses.length,
        totalUniqueSoftware: uniqueSwNames.size,
      },
      charts: {
        byType,
        byDepartment,
        byStatus: Array.from(byStatusMap.entries()).map(([name, value]) => ({ name, value })),
        byYear: Array.from(byYearMap.values()).sort((a, b) => a.year.localeCompare(b.year)),
        movement,
        softwareByPublisher,
        licenseByStatus: [
          { name: 'Đang hoạt động', key: 'ACTIVE', value: activeLicenses },
          { name: 'Sắp hết hạn', key: 'EXPIRING_SOON', value: expiringLicenses },
          { name: 'Đã hết hạn', key: 'EXPIRED', value: expiredLicenses },
        ].filter((x) => x.value > 0),
        licenseExpiringByMonth: expMonthBuckets.map(({ month, count }) => ({ month, count })),
        alertsBySeverity: [
          { name: 'Thông tin', key: 'INFO', value: sevCounts.INFO },
          { name: 'Trung bình', key: 'MEDIUM', value: sevCounts.MEDIUM },
          { name: 'Cao', key: 'HIGH', value: sevCounts.HIGH },
          { name: 'Nghiêm trọng', key: 'CRITICAL', value: sevCounts.CRITICAL },
        ],
      },
      alertCenter: [...contractAlerts, ...licenseAlerts, ...openAssetAlerts].slice(0, 25),
      expiringLicenseList: expiringLicenseList.slice(0, 8),
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
