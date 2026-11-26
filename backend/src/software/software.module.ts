import { Module, Injectable, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard, PermissionsGuard, RequirePermissions } from '../auth/guards';

@Injectable()
export class SoftwareService {
  constructor(private readonly prisma: PrismaService) {}

  private async getLatestSnapshots() {
    const agents = await this.prisma.deviceAgent.findMany({
      where: { status: { not: 'REVOKED' } },
      include: {
        asset: { select: { id: true, assetCode: true, name: true, usingDepartment: true, assignedUserName: true } },
        snapshots: {
          orderBy: { collectedAt: 'desc' },
          take: 1,
          include: {
            operatingSystem: true,
            software: true,
          },
        },
      },
    });
    return agents.filter((a) => a.snapshots.length > 0);
  }

  async getSoftwareSummary(search?: string) {
    const agents = await this.getLatestSnapshots();
    const map = new Map<
      string,
      {
        displayName: string;
        publisher: string;
        versions: Set<string>;
        installCount: number;
        isUnauthorized: boolean;
        devices: Array<{ assetId: string | null; assetCode: string; hostname: string; version: string; department: string }>;
      }
    >();

    for (const ag of agents) {
      const snap = ag.snapshots[0];
      for (const sw of snap.software) {
        if (search && !sw.displayName.toLowerCase().includes(search.toLowerCase()) && !(sw.publisher || '').toLowerCase().includes(search.toLowerCase())) {
          continue;
        }
        const key = sw.displayName.toLowerCase();
        const entry = map.get(key) || {
          displayName: sw.displayName,
          publisher: sw.publisher || 'Không xác định',
          versions: new Set<string>(),
          installCount: 0,
          isUnauthorized: sw.isUnauthorized,
          devices: [],
        };
        if (sw.displayVersion) entry.versions.add(sw.displayVersion);
        if (sw.isUnauthorized) entry.isUnauthorized = true;
        entry.installCount += 1;
        entry.devices.push({
          assetId: ag.asset?.id || null,
          assetCode: ag.asset?.assetCode || 'Chưa duyệt',
          hostname: ag.hostname,
          version: sw.displayVersion || '-',
          department: ag.asset?.usingDepartment?.name || '-',
        });
        map.set(key, entry);
      }
    }

    return Array.from(map.values())
      .map((e) => ({ ...e, versions: Array.from(e.versions) }))
      .sort((a, b) => Number(b.isUnauthorized) - Number(a.isUnauthorized) || b.installCount - a.installCount);
  }

  async getWindowsStatus() {
    const agents = await this.getLatestSnapshots();
    return agents.map((ag) => {
      const os = ag.snapshots[0].operatingSystem;
      return {
        agentId: ag.id,
        agentUid: ag.agentUid,
        hostname: ag.hostname,
        assetId: ag.asset?.id || null,
        assetCode: ag.asset?.assetCode || 'Chưa duyệt',
        assetName: ag.asset?.name || ag.hostname,
        department: ag.asset?.usingDepartment?.name || '-',
        assignedUser: ag.asset?.assignedUserName || '-',
        productName: os?.productName || 'Không xác định',
        edition: os?.edition || '-',
        version: os?.version || '-',
        buildNumber: os?.buildNumber || '-',
        architecture: os?.architecture || '-',
        activationStatus: os?.activationStatus || 'UNKNOWN',
        licenseChannel: os?.licenseChannel || '-',
        licenseDescription: os?.licenseDescription || '-',
        partialProductKey: os?.partialProductKey || '-',
        checkedAt: os?.checkedAt || ag.snapshots[0].collectedAt,
      };
    });
  }
}

@ApiTags('Software & Windows License')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('api/v1/software')
export class SoftwareController {
  constructor(private readonly service: SoftwareService) {}

  @Get('catalog')
  @RequirePermissions('software.read')
  getCatalog(@Query('search') search?: string) {
    return this.service.getSoftwareSummary(search);
  }

  @Get('windows')
  @RequirePermissions('software.read')
  getWindows() {
    return this.service.getWindowsStatus();
  }
}

@Module({
  providers: [SoftwareService],
  controllers: [SoftwareController],
})
export class SoftwareModule {}
