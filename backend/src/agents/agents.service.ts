import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const ALLOWED_AGENT_COMMANDS = ['SYNC_INVENTORY', 'SYNC_SOFTWARE', 'RELOAD_CONFIG', 'CHECK_UPDATE'];
const INVALID_IDS = new Set([
  '',
  '00000000-0000-0000-0000-000000000000',
  'FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF',
  'To be filled by O.E.M.',
  'Default string',
  'System Serial Number',
  'None',
  'N/A',
]);

function sha256(val: string) {
  return crypto.createHash('sha256').update(val).digest('hex');
}

function cleanPartialKey(key?: string | null): string | null {
  if (!key) return null;
  const trimmed = key.trim().toUpperCase();
  // SRS 4.6 & 11.3: NEVER store full Windows Product Key! Only max 5-char partial key.
  if (trimmed.length > 5) {
    return trimmed.slice(-5);
  }
  return trimmed;
}

export function buildCanonicalSnapshot(snap: {
  processors: any[];
  memoryModules: any[];
  disks: any[];
  graphics: any[];
  operatingSystem: any;
  software: any[];
  mainboardMfg?: string | null;
  mainboardProduct?: string | null;
  mainboardSerial?: string | null;
  biosMfg?: string | null;
  biosVersion?: string | null;
  totalRamGb?: number | null;
}) {
  const cpuStr = snap.processors
    .map((p) => `${p.name} (${p.cores || '?'}C/${p.logicalProcessors || '?'}T)`)
    .sort()
    .join('; ');
  const ramModules = snap.memoryModules
    .map((m) => `${m.slot || 'DIMM'}: ${m.capacityGb} GB ${m.memoryType || ''} ${m.speedMhz || ''}MHz (${m.manufacturer || ''})`.trim())
    .sort();
  const totalRam =
    snap.totalRamGb ?? snap.memoryModules.reduce((acc, m) => acc + (Number(m.capacityGb) || 0), 0);
  const disks = snap.disks.map((d) => `${d.model} (${d.sizeGb} GB)`).sort();
  const gpus = snap.graphics.map((g) => g.name).sort();
  const mainboard = [snap.mainboardMfg, snap.mainboardProduct, snap.mainboardSerial ? `(${snap.mainboardSerial})` : '']
    .filter(Boolean)
    .join(' ');
  const bios = [snap.biosMfg, snap.biosVersion].filter(Boolean).join(' ');
  const os = snap.operatingSystem
    ? `${snap.operatingSystem.productName} ${snap.operatingSystem.version || ''} (${snap.operatingSystem.buildNumber || ''})`.trim()
    : '';
  const activationStatus = snap.operatingSystem?.activationStatus || 'UNKNOWN';
  const software = snap.software
    .map((s) => `${s.displayName}|${s.displayVersion || ''}`)
    .sort();

  return {
    cpu: cpuStr,
    totalRamGb: Math.round(totalRam * 100) / 100,
    memoryModules: ramModules,
    disks,
    mainboard,
    bios,
    gpu: gpus,
    os,
    activationStatus,
    software,
  };
}

@Injectable()
export class AgentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async authenticateAgent(agentUid: string, rawToken: string) {
    if (!agentUid || !rawToken) {
      throw new UnauthorizedException('Thiếu thông tin xác thực Agent (X-Agent-Id / X-Agent-Token).');
    }
    const agent = await this.prisma.deviceAgent.findUnique({ where: { agentUid } });
    if (!agent) {
      throw new UnauthorizedException('Agent không tồn tại trong hệ thống.');
    }
    if (agent.status === 'REVOKED' || agent.revokedAt) {
      throw new UnauthorizedException('Agent credential đã bị thu hồi.');
    }
    if (agent.credentialHash !== sha256(rawToken)) {
      throw new UnauthorizedException('Agent credential không hợp lệ.');
    }
    return agent;
  }

  async enroll(payload: {
    enrollmentToken: string;
    agentUid?: string;
    hostname: string;
    computerName?: string;
    smbiosUuid?: string;
    biosSerial?: string;
    primaryMac?: string;
    ipAddress?: string;
    manufacturer?: string;
    model?: string;
    osSummary?: string;
    agentVersion?: string;
  }) {
    if (!payload.enrollmentToken || !payload.hostname) {
      throw new BadRequestException('Thiếu enrollmentToken hoặc hostname.');
    }

    const tokenHash = sha256(payload.enrollmentToken.trim());
    const token = await this.prisma.enrollmentToken.findUnique({ where: { tokenHash } });
    if (!token || token.isRevoked) {
      throw new UnauthorizedException('Enrollment token không hợp lệ hoặc đã bị thu hồi.');
    }
    if (token.expiresAt < new Date()) {
      throw new UnauthorizedException('Enrollment token đã hết hạn.');
    }
    if (token.maxUses && token.usedCount >= token.maxUses) {
      throw new UnauthorizedException('Enrollment token đã đạt giới hạn số lượt đăng ký.');
    }

    const agentUid = payload.agentUid?.trim() || `AGT-${payload.hostname.toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const rawCredential = `itac_${crypto.randomBytes(32).toString('hex')}`;
    const credentialHash = sha256(rawCredential);

    // SRS 4.3: Check identity conflicts (SMBIOS UUID / BIOS Serial) - DO NOT auto-merge!
    let conflictReason: string | null = null;
    const cleanUuid = payload.smbiosUuid?.trim() || '';
    const cleanSerial = payload.biosSerial?.trim() || '';

    if (cleanUuid && !INVALID_IDS.has(cleanUuid)) {
      const existingByUuid = await this.prisma.deviceAgent.findFirst({
        where: { smbiosUuid: cleanUuid, agentUid: { not: agentUid }, status: { not: 'REVOKED' } },
      });
      if (existingByUuid) {
        conflictReason = `Trùng SMBIOS UUID (${cleanUuid}) với Agent ${existingByUuid.agentUid} (${existingByUuid.hostname})`;
      }
    }
    if (!conflictReason && cleanSerial && !INVALID_IDS.has(cleanSerial)) {
      const existingBySerial = await this.prisma.deviceAgent.findFirst({
        where: { biosSerial: cleanSerial, agentUid: { not: agentUid }, status: { not: 'REVOKED' } },
      });
      if (existingBySerial) {
        conflictReason = `Trùng BIOS Serial (${cleanSerial}) với Agent ${existingBySerial.agentUid} (${existingBySerial.hostname})`;
      }
    }

    const agent = await this.prisma.deviceAgent.upsert({
      where: { agentUid },
      update: {
        credentialHash,
        hostname: payload.hostname,
        computerName: payload.computerName || payload.hostname,
        smbiosUuid: cleanUuid || null,
        biosSerial: cleanSerial || null,
        primaryMac: payload.primaryMac || null,
        lastIpAddress: payload.ipAddress || null,
        manufacturer: payload.manufacturer || null,
        model: payload.model || null,
        osSummary: payload.osSummary || null,
        agentVersion: payload.agentVersion || '1.2.0',
        status: conflictReason ? 'CONFLICT' : 'ONLINE',
        lastHeartbeatAt: new Date(),
      },
      create: {
        agentUid,
        credentialHash,
        hostname: payload.hostname,
        computerName: payload.computerName || payload.hostname,
        smbiosUuid: cleanUuid || null,
        biosSerial: cleanSerial || null,
        primaryMac: payload.primaryMac || null,
        lastIpAddress: payload.ipAddress || null,
        manufacturer: payload.manufacturer || null,
        model: payload.model || null,
        osSummary: payload.osSummary || null,
        agentVersion: payload.agentVersion || '1.2.0',
        status: conflictReason ? 'CONFLICT' : 'ONLINE',
        lastHeartbeatAt: new Date(),
      },
    });

    await this.prisma.enrollmentToken.update({
      where: { id: token.id },
      data: { usedCount: { increment: 1 } },
    });

    // Put device in DiscoveredDevices queue if not already linked to an official Asset (Principle 2)
    if (!agent.assetId) {
      const existingDisc = await this.prisma.discoveredDevice.findFirst({ where: { agentId: agent.id } });
      if (!existingDisc) {
        await this.prisma.discoveredDevice.create({
          data: {
            source: 'AGENT',
            approvalStatus: conflictReason ? 'VERIFY_CONFLICT' : 'PENDING',
            agentId: agent.id,
            hostname: agent.hostname,
            ipAddress: agent.lastIpAddress,
            macAddress: agent.primaryMac,
            smbiosUuid: agent.smbiosUuid,
            serialNumber: agent.biosSerial,
            manufacturer: agent.manufacturer,
            model: agent.model,
            osName: agent.osSummary,
            conflictReason,
          },
        });
      }
    }

    if (conflictReason) {
      const rule = await this.prisma.alertRule.findUnique({ where: { code: 'AGENT_IDENTITY_CONFLICT' } });
      await this.prisma.alertEvent.create({
        data: {
          ruleCode: 'AGENT_IDENTITY_CONFLICT',
          category: 'SECURITY',
          severity: rule?.severity || 'CRITICAL',
          status: 'NEW',
          title: `Mâu thuẫn định danh thiết bị khi đăng ký Agent ${agent.hostname}`,
          message: `${conflictReason}. Thiết bị đã được đưa vào trạng thái cần IT xác minh, không tự động gộp hồ sơ.`,
          agentId: agent.id,
          source: 'AGENT_ENROLLMENT',
        },
      });
    } else {
      const rule = await this.prisma.alertRule.findUnique({ where: { code: 'DEVICE_NEW_DISCOVERED' } });
      if (!rule || rule.isEnabled) {
        await this.prisma.alertEvent.create({
          data: {
            ruleCode: 'DEVICE_NEW_DISCOVERED',
            category: 'DISCOVERY',
            severity: rule?.severity || 'INFO',
            status: 'NEW',
            title: `Agent mới đăng ký: ${agent.hostname} (${agent.agentUid})`,
            message: `Thiết bị ${agent.manufacturer || ''} ${agent.model || ''} (IP ${agent.lastIpAddress || 'N/A'}) đã đăng ký và đang chờ IT kiểm duyệt.`,
            agentId: agent.id,
            source: 'AGENT_ENROLLMENT',
          },
        });
      }
    }

    return {
      agentId: agent.id,
      agentUid: agent.agentUid,
      agentToken: rawCredential,
      status: agent.status,
      conflictReason,
      config: await this.getAgentConfig(),
    };
  }

  async heartbeat(
    agent: any,
    payload: {
      ipAddress?: string;
      agentVersion?: string;
      scriptSha256?: string;
      cpuLoadPercent?: number;
      ramUsedPercent?: number;
      uptimeSeconds?: number;
    },
  ) {
    await this.prisma.deviceAgent.update({
      where: { id: agent.id },
      data: {
        status: agent.status === 'CONFLICT' ? 'CONFLICT' : 'ONLINE',
        lastHeartbeatAt: new Date(),
        lastIpAddress: payload.ipAddress || agent.lastIpAddress,
        agentVersion: payload.agentVersion || agent.agentVersion,
      },
    });

    await this.prisma.deviceHeartbeat.create({
      data: {
        agentId: agent.id,
        ipAddress: payload.ipAddress || agent.lastIpAddress,
        agentVersion: payload.agentVersion || agent.agentVersion,
        cpuLoadPercent: payload.cpuLoadPercent ?? null,
        ramUsedPercent: payload.ramUsedPercent ?? null,
        uptimeSeconds: payload.uptimeSeconds ?? null,
      },
    });

    // Return strictly allowlisted pending commands
    const commands = await this.prisma.agentCommand.findMany({
      where: { agentId: agent.id, status: 'PENDING', commandType: { in: ALLOWED_AGENT_COMMANDS } },
      orderBy: { issuedAt: 'asc' },
    });

    if (commands.length > 0) {
      await this.prisma.agentCommand.updateMany({
        where: { id: { in: commands.map((c) => c.id) } },
        data: { status: 'SENT' },
      });
    }

    // OTA Auto-Update check (compare live ITAssetAgent.ps1 SHA-256 on server vs running client)
    let updateInfo: any = { available: false };
    try {
      const meta = this.getLivePsAgentMeta();
      const clientHash = (payload.scriptSha256 || '').trim().toLowerCase();
      const available = Boolean(clientHash) && clientHash !== meta.agentSha256;
      updateInfo = {
        available,
        version: meta.version,
        scriptSha256: meta.agentSha256,
        traySha256: meta.traySha256,
        bundleUrl: '/api/v1/agent/self-update/bundle',
      };
    } catch {
      // ignore if agent source folder not present
    }

    return {
      status: 'OK',
      serverTime: new Date().toISOString(),
      commands: commands.map((c) => ({ id: c.id, type: c.commandType })),
      update: updateInfo,
    };
  }

  async submitSnapshot(agent: any, payload: any, idempotencyKey?: string) {
    if (idempotencyKey) {
      const existing = await this.prisma.deviceSnapshot.findUnique({ where: { idempotencyKey } });
      if (existing) {
        return { status: 'DUPLICATE_IGNORED', snapshotId: existing.id };
      }
    }

    const processors = Array.isArray(payload.processors) ? payload.processors : [];
    const memoryModules = Array.isArray(payload.memoryModules) ? payload.memoryModules : [];
    const disks = Array.isArray(payload.disks) ? payload.disks : [];
    const networkAdapters = Array.isArray(payload.networkAdapters) ? payload.networkAdapters : [];
    const graphics = Array.isArray(payload.graphics) ? payload.graphics : [];
    const monitors = Array.isArray(payload.monitors) ? payload.monitors : [];
    const software = Array.isArray(payload.software) ? payload.software : [];

    // Load unauthorized software keywords from SystemSettings
    const unauthSetting = await this.prisma.systemSetting.findUnique({
      where: { key: 'software.unauthorized_keywords' },
    });
    const unauthKeywords = (unauthSetting?.value || '')
      .split(',')
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean);

    const totalRamGb =
      payload.totalRamGb ??
      memoryModules.reduce((sum: number, m: any) => sum + (Number(m.capacityGb) || 0), 0);
    const totalDiskGb =
      payload.totalDiskGb ??
      disks.reduce((sum: number, d: any) => sum + (Number(d.sizeGb) || 0), 0);

    const snapshot = await this.prisma.deviceSnapshot.create({
      data: {
        agentId: agent.id,
        idempotencyKey: idempotencyKey || null,
        source: payload.source || 'PERIODIC',
        collectedAt: payload.collectedAt ? new Date(payload.collectedAt) : new Date(),
        computerName: payload.computerName || agent.computerName || agent.hostname,
        hostname: payload.hostname || agent.hostname,
        smbiosUuid: payload.smbiosUuid || agent.smbiosUuid,
        serialNumber: payload.serialNumber || agent.biosSerial,
        manufacturer: payload.manufacturer || agent.manufacturer,
        model: payload.model || agent.model,
        mainboardMfg: payload.mainboard?.manufacturer || payload.mainboardMfg || null,
        mainboardProduct: payload.mainboard?.product || payload.mainboardProduct || null,
        mainboardSerial: payload.mainboard?.serialNumber || payload.mainboardSerial || null,
        biosMfg: payload.bios?.manufacturer || payload.biosMfg || null,
        biosVersion: payload.bios?.version || payload.biosVersion || null,
        biosReleaseDate: payload.bios?.releaseDate || payload.biosReleaseDate || null,
        biosSerial: payload.bios?.serialNumber || payload.biosSerial || null,
        totalRamGb,
        totalDiskGb,
        rawPayloadJson: JSON.stringify({
          logicalDrives: Array.isArray(payload.logicalDrives) ? payload.logicalDrives : [],
          battery: payload.battery && typeof payload.battery === 'object' ? payload.battery : null,
        }),
        processors: {
          create: processors.map((p: any) => ({
            name: p.name || 'Unknown CPU',
            manufacturer: p.manufacturer || null,
            cores: p.cores ? Number(p.cores) : null,
            logicalProcessors: p.logicalProcessors ? Number(p.logicalProcessors) : null,
            maxClockMhz: p.maxClockMhz ? Number(p.maxClockMhz) : null,
          })),
        },
        memoryModules: {
          create: memoryModules.map((m: any) => ({
            slot: m.slot || null,
            capacityGb: Number(m.capacityGb) || 0,
            memoryType: m.memoryType || null,
            speedMhz: m.speedMhz ? Number(m.speedMhz) : null,
            manufacturer: m.manufacturer || null,
            serialNumber: m.serialNumber || null,
          })),
        },
        disks: {
          create: disks.map((d: any) => ({
            model: d.model || 'Unknown Disk',
            serialNumber: d.serialNumber || null,
            mediaType: d.mediaType || null,
            sizeGb: Number(d.sizeGb) || 0,
            freeGb: d.freeGb != null ? Number(d.freeGb) : null,
            partitions: d.partitions || null,
          })),
        },
        networkAdapters: {
          create: networkAdapters.map((n: any) => ({
            name: n.name || 'Network Adapter',
            macAddress: n.macAddress || null,
            ipAddress: n.ipAddress || null,
            speedMbps: n.speedMbps ? Number(n.speedMbps) : null,
            status: n.status || 'UP',
            isVirtual: !!n.isVirtual,
          })),
        },
        graphics: {
          create: graphics.map((g: any) => ({
            name: g.name || 'GPU',
            vramMb: g.vramMb ? Number(g.vramMb) : null,
            driverVersion: g.driverVersion || null,
          })),
        },
        monitors: {
          create: monitors.map((m: any) => ({
            manufacturer: m.manufacturer || null,
            model: m.model || null,
            serialNumber: m.serialNumber || null,
            resolution: m.resolution || null,
          })),
        },
        operatingSystem: payload.operatingSystem
          ? {
              create: {
                productName: payload.operatingSystem.productName || 'Windows',
                edition: payload.operatingSystem.edition || null,
                version: payload.operatingSystem.version || null,
                buildNumber: payload.operatingSystem.buildNumber || null,
                architecture: payload.operatingSystem.architecture || '64-bit',
                installDate: payload.operatingSystem.installDate
                  ? new Date(payload.operatingSystem.installDate)
                  : null,
                lastBootTime: payload.operatingSystem.lastBootTime
                  ? new Date(payload.operatingSystem.lastBootTime)
                  : null,
                activationStatus: payload.operatingSystem.activationStatus || 'UNKNOWN',
                licenseDescription: payload.operatingSystem.licenseDescription || null,
                licenseChannel: payload.operatingSystem.licenseChannel || null,
                partialProductKey: cleanPartialKey(payload.operatingSystem.partialProductKey),
              },
            }
          : undefined,
        software: {
          create: software.map((s: any) => {
            const nameStr = String(s.displayName || '').trim();
            const isUnauthorized = unauthKeywords.some((kw) => nameStr.toLowerCase().includes(kw));
            return {
              displayName: nameStr || 'Unknown App',
              publisher: s.publisher || null,
              displayVersion: s.displayVersion || null,
              installDate: s.installDate || null,
              installLocation: s.installLocation || null,
              architecture: s.architecture || null,
              uninstallEntry: s.uninstallEntry || null,
              isUnauthorized,
            };
          }),
        },
      },
      include: {
        processors: true,
        memoryModules: true,
        disks: true,
        graphics: true,
        operatingSystem: true,
        software: true,
      },
    });

    // Update DeviceAgent metadata (NOT Asset official specs / NOT Baseline!)
    const primaryPhysicalNic = networkAdapters.find((n: any) => !n.isVirtual && n.ipAddress);
    const reportedHostname = (snapshot.hostname || '').trim();
    await this.prisma.deviceAgent.update({
      where: { id: agent.id },
      data: {
        hostname: reportedHostname || agent.hostname,
        computerName: (snapshot.computerName || reportedHostname || agent.computerName),
        lastSnapshotAt: new Date(),
        lastHeartbeatAt: new Date(),
        status: agent.status === 'CONFLICT' ? 'CONFLICT' : 'ONLINE',
        manufacturer: snapshot.manufacturer || agent.manufacturer,
        model: snapshot.model || agent.model,
        osSummary: snapshot.operatingSystem
          ? `${snapshot.operatingSystem.productName} ${snapshot.operatingSystem.version || ''}`.trim()
          : agent.osSummary,
        lastIpAddress: primaryPhysicalNic?.ipAddress || agent.lastIpAddress,
        primaryMac: primaryPhysicalNic?.macAddress || agent.primaryMac,
      },
    });

    // Keep linked Asset hostname synced; only auto-update Asset name if it still matches previous hostname (respect user's custom name)
    if (agent.assetId && reportedHostname) {
      const linkedAsset = await this.prisma.asset.findUnique({
        where: { id: agent.assetId },
        select: { name: true, hostname: true },
      });
      if (linkedAsset) {
        const shouldSyncName = !linkedAsset.name || linkedAsset.name === linkedAsset.hostname;
        await this.prisma.asset.update({
          where: { id: agent.assetId },
          data: {
            hostname: reportedHostname,
            ...(shouldSyncName ? { name: reportedHostname } : {}),
          },
        });
      }
    }

    // Update DiscoveredDevice preview if still pending
    if (!agent.assetId) {
      await this.prisma.discoveredDevice.updateMany({
        where: { agentId: agent.id, approvalStatus: { in: ['PENDING', 'VERIFY_CONFLICT'] } },
        data: {
          hostname: reportedHostname || undefined,
          cpuSummary: processors[0]?.name || undefined,
          ramTotalGb: totalRamGb || undefined,
          diskSummary: disks.map((d: any) => `${d.model} ${d.sizeGb}GB`).join(', ') || undefined,
          osName: snapshot.operatingSystem?.productName || undefined,
          manufacturer: snapshot.manufacturer || undefined,
          model: snapshot.model || undefined,
          lastSeenAt: new Date(),
        },
      });
    }

    // SRS 5.4: Compare Snapshot against confirmed Baseline (NEVER auto-update Baseline!)
    const detectedChanges: any[] = [];
    if (agent.assetId) {
      const activeBaseline = await this.prisma.deviceBaseline.findFirst({
        where: { assetId: agent.assetId, isActive: true },
        orderBy: { version: 'desc' },
      });

      if (activeBaseline) {
        const base = JSON.parse(activeBaseline.baselineJson);
        const curr = buildCanonicalSnapshot(snapshot);
        const rules = await this.prisma.alertRule.findMany();
        const ruleMap = new Map(rules.map((r) => [r.code, r]));

        const recordDiff = async (
          component: string,
          changeType: string,
          prev: string,
          next: string,
          ruleCode: string,
          defaultSeverity: string,
          title: string,
        ) => {
          const rule = ruleMap.get(ruleCode);
          const severity = rule?.severity || defaultSeverity;
          const now = new Date();

          // Chống trùng lặp: nếu đã có bản ghi PENDING giống hệt (cùng thiết bị, thành phần, giá trị Trước -> Sau)
          // thì chỉ cập nhật thời điểm phát hiện mới nhất và dọn các bản ghi trùng cũ hơn.
          const existingPending = await this.prisma.deviceChange.findMany({
            where: {
              assetId: agent.assetId,
              agentId: agent.id,
              component,
              previousValue: prev,
              newValue: next,
              status: 'PENDING',
            },
            orderBy: { detectedAt: 'desc' },
          });

          let change: any;
          if (existingPending.length > 0) {
            const latest = existingPending[0];
            change = await this.prisma.deviceChange.update({
              where: { id: latest.id },
              data: {
                baselineId: activeBaseline.id,
                snapshotId: snapshot.id,
                changeType,
                severity,
                detectedAt: now,
              },
            });
            if (existingPending.length > 1) {
              const dupIds = existingPending.slice(1).map((x) => x.id);
              await this.prisma.deviceChange.deleteMany({ where: { id: { in: dupIds } } });
            }
          } else {
            change = await this.prisma.deviceChange.create({
              data: {
                assetId: agent.assetId,
                agentId: agent.id,
                baselineId: activeBaseline.id,
                snapshotId: snapshot.id,
                component,
                changeType,
                previousValue: prev,
                newValue: next,
                severity,
                status: 'PENDING',
                source: 'BASELINE_DIFF',
                detectedAt: now,
              },
            });
          }

          detectedChanges.push(change);

          if (!rule || rule.isEnabled) {
            const category = component === 'SOFTWARE' ? 'SOFTWARE' : 'CONFIG_CHANGE';
            const message = `Phát hiện thay đổi ${component} trên ${agent.hostname}: "${prev}" -> "${next}". Baseline chưa được cập nhật, cần IT xác minh.`;

            const existingAlerts = await this.prisma.alertEvent.findMany({
              where: {
                assetId: agent.assetId,
                agentId: agent.id,
                component,
                previousValue: prev,
                newValue: next,
                status: { in: ['NEW', 'ACKNOWLEDGED', 'IN_PROGRESS'] },
              },
              orderBy: { detectedAt: 'desc' },
            });

            if (existingAlerts.length > 0) {
              const latestAlert = existingAlerts[0];
              await this.prisma.alertEvent.update({
                where: { id: latestAlert.id },
                data: {
                  ruleCode,
                  category,
                  severity,
                  title,
                  message,
                  deviceChangeId: change.id,
                  detectedAt: now,
                },
              });
              if (existingAlerts.length > 1) {
                const dupAlertIds = existingAlerts.slice(1).map((a) => a.id);
                await this.prisma.alertEvent.deleteMany({ where: { id: { in: dupAlertIds } } });
              }
            } else {
              await this.prisma.alertEvent.create({
                data: {
                  ruleCode,
                  category,
                  severity,
                  status: 'NEW',
                  title,
                  message,
                  assetId: agent.assetId,
                  agentId: agent.id,
                  deviceChangeId: change.id,
                  component,
                  previousValue: prev,
                  newValue: next,
                  source: 'WINDOWS_AGENT',
                  detectedAt: now,
                },
              });
            }
          }
        };

        if (base.cpu && curr.cpu && base.cpu !== curr.cpu) {
          await recordDiff('CPU', 'MODIFIED', base.cpu, curr.cpu, 'HARDWARE_CPU_CHANGE', 'HIGH', `Thay đổi CPU trên ${agent.hostname}`);
        }
        if (base.totalRamGb != null && curr.totalRamGb != null && Number(base.totalRamGb) !== Number(curr.totalRamGb)) {
          await recordDiff(
            'RAM',
            'MODIFIED',
            `${base.totalRamGb} GB`,
            `${curr.totalRamGb} GB`,
            'HARDWARE_RAM_CHANGE',
            'MEDIUM',
            `Thay đổi dung lượng RAM trên ${agent.hostname} (${base.totalRamGb} GB -> ${curr.totalRamGb} GB)`,
          );
        }
        if (JSON.stringify(base.disks || []) !== JSON.stringify(curr.disks || [])) {
          await recordDiff(
            'DISK',
            'MODIFIED',
            (base.disks || []).join(', ') || 'Không có',
            (curr.disks || []).join(', ') || 'Không có',
            'HARDWARE_DISK_CHANGE',
            'HIGH',
            `Thay đổi ổ đĩa lưu trữ trên ${agent.hostname}`,
          );
        }
        if (base.mainboard && curr.mainboard && base.mainboard !== curr.mainboard) {
          await recordDiff('MAINBOARD', 'MODIFIED', base.mainboard, curr.mainboard, 'HARDWARE_MAINBOARD_CHANGE', 'HIGH', `Thay đổi Mainboard trên ${agent.hostname}`);
        }
        if (JSON.stringify(base.gpu || []) !== JSON.stringify(curr.gpu || [])) {
          await recordDiff('GPU', 'MODIFIED', (base.gpu || []).join(', '), (curr.gpu || []).join(', '), 'HARDWARE_GPU_CHANGE', 'MEDIUM', `Thay đổi GPU trên ${agent.hostname}`);
        }
        if (base.activationStatus && curr.activationStatus && base.activationStatus !== curr.activationStatus) {
          await recordDiff(
            'WINDOWS',
            'MODIFIED',
            base.activationStatus,
            curr.activationStatus,
            'WINDOWS_ACTIVATION_CHANGE',
            'HIGH',
            `Thay đổi trạng thái kích hoạt Windows trên ${agent.hostname}`,
          );
        }

        // Software added / removed
        const baseSwSet = new Set<string>(base.software || []);
        const currSwSet = new Set<string>(curr.software || []);
        for (const item of currSwSet) {
          if (!baseSwSet.has(item)) {
            const [name, ver] = item.split('|');
            const isUnauth = unauthKeywords.some((kw) => name.toLowerCase().includes(kw));
            await recordDiff(
              'SOFTWARE',
              'ADDED',
              'Chưa cài đặt',
              `${name} ${ver || ''}`.trim(),
              isUnauth ? 'SOFTWARE_UNAUTHORIZED' : 'SOFTWARE_CHANGE',
              isUnauth ? 'HIGH' : 'INFO',
              isUnauth
                ? `Phát hiện phần mềm không được phép: ${name} trên ${agent.hostname}`
                : `Cài đặt phần mềm mới: ${name} trên ${agent.hostname}`,
            );
          }
        }
        for (const item of baseSwSet) {
          if (!currSwSet.has(item)) {
            const [name, ver] = item.split('|');
            await recordDiff(
              'SOFTWARE',
              'REMOVED',
              `${name} ${ver || ''}`.trim(),
              'Đã gỡ bỏ',
              'SOFTWARE_CHANGE',
              'INFO',
              `Gỡ bỏ phần mềm: ${name} trên ${agent.hostname}`,
            );
          }
        }
      }
    }

    return {
      status: 'ACCEPTED',
      snapshotId: snapshot.id,
      changesDetected: detectedChanges.length,
    };
  }

  async submitEvents(agent: any, events: Array<{ component: string; summary: string; details?: string; occurredAt?: string }>) {
    const created: any[] = [];
    for (const ev of events || []) {
      const alert = await this.prisma.alertEvent.create({
        data: {
          ruleCode: 'EVENT_LOG_TRIGGER',
          category: 'CONFIG_CHANGE',
          severity: 'INFO',
          status: 'NEW',
          title: `Sự kiện từ Agent ${agent.hostname}: ${ev.summary}`,
          message: ev.details || ev.summary,
          assetId: agent.assetId,
          agentId: agent.id,
          component: ev.component || 'SYSTEM',
          source: 'WINDOWS_EVENT_LOG',
          detectedAt: ev.occurredAt ? new Date(ev.occurredAt) : new Date(),
        },
      });
      created.push(alert.id);
    }
    return { received: created.length };
  }

  async getAgentConfig() {
    const settings = await this.prisma.systemSetting.findMany({
      where: { group: 'AGENT_SCHEDULE' },
    });
    const map: Record<string, number> = {};
    for (const s of settings) {
      map[s.key] = Number(s.value) || 0;
    }
    return {
      heartbeatIntervalSec: map['agent.heartbeat_interval_sec'] || 300,
      hardwareIntervalSec: map['agent.hardware_interval_sec'] || 1800,
      softwareIntervalSec: map['agent.software_interval_sec'] || 21600,
      licenseIntervalSec: map['agent.license_interval_sec'] || 86400,
      fullSnapshotIntervalSec: map['agent.full_snapshot_interval_sec'] || 86400,
      jitterMaxSec: map['agent.jitter_max_sec'] || 60,
    };
  }

  async getLatestVersion() {
    const latest = await this.prisma.agentVersion.findFirst({
      where: { isLatest: true },
      orderBy: { releasedAt: 'desc' },
    });
    return latest || { version: '1.2.0', isLatest: true, isMandatory: false };
  }

  // Admin endpoints for Agent management
  async listAgents(query: { status?: string; search?: string }) {
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { hostname: { contains: query.search } },
        { agentUid: { contains: query.search } },
        { lastIpAddress: { contains: query.search } },
        { biosSerial: { contains: query.search } },
      ];
    }
    const agents = await this.prisma.deviceAgent.findMany({
      where,
      include: {
        asset: { select: { id: true, assetCode: true, name: true, status: true } },
        _count: { select: { snapshots: true, changes: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Dynamic offline check based on configured threshold
    const thresholdSetting = await this.prisma.systemSetting.findUnique({ where: { key: 'agent.offline_threshold_min' } });
    const offlineMin = Number(thresholdSetting?.value) || 15;
    const cutoff = Date.now() - offlineMin * 60_000;

    return agents.map((a) => ({
      ...a,
      computedStatus:
        a.status === 'REVOKED' || a.status === 'CONFLICT'
          ? a.status
          : a.lastHeartbeatAt && a.lastHeartbeatAt.getTime() >= cutoff
            ? 'ONLINE'
            : 'OFFLINE',
    }));
  }

  async revokeAgent(id: string, reason: string, actor: { id: string; fullName: string }) {
    const agent = await this.prisma.deviceAgent.findUnique({ where: { id } });
    if (!agent) throw new NotFoundException('Không tìm thấy Agent.');
    const updated = await this.prisma.deviceAgent.update({
      where: { id },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
        revokeReason: reason || 'Thu hồi bởi quản trị viên IT',
      },
    });
    await this.auditService.log({
      userId: actor.id,
      actorName: actor.fullName,
      action: 'AGENT_REVOKED',
      entityType: 'DeviceAgent',
      entityId: id,
      oldValue: agent.status,
      newValue: 'REVOKED',
      reason,
    });
    return updated;
  }

  async issueAllowedCommand(agentId: string, commandType: string, actorName: string) {
    if (!ALLOWED_AGENT_COMMANDS.includes(commandType)) {
      throw new BadRequestException(
        `Lệnh không được phép. Hệ thống chỉ hỗ trợ các lệnh được kiểm soát: ${ALLOWED_AGENT_COMMANDS.join(', ')}`,
      );
    }
    return this.prisma.agentCommand.create({
      data: { agentId, commandType, issuedBy: actorName },
    });
  }

  async listEnrollmentTokens() {
    const now = new Date();
    const list = await this.prisma.enrollmentToken.findMany({
      include: { createdBy: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return list.map((t) => {
      const isExpired = Boolean(t.expiresAt && t.expiresAt < now);
      const isExhausted = Boolean(t.maxUses && t.usedCount >= t.maxUses);
      const isUsable = !t.isRevoked && !isExpired && !isExhausted;
      return {
        ...t,
        isExpired,
        isUsable,
        tokenValue: isUsable ? t.tokenValue : null,
      };
    });
  }

  async createEnrollmentToken(
    data: { name: string; maxUses?: number; expiresDays?: number },
    actor: { id: string; fullName: string },
  ) {
    const rawToken = `ENROLL-ITAM-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
    const expiresAt = new Date(Date.now() + (Number(data.expiresDays) || 30) * 86400_000);
    const token = await this.prisma.enrollmentToken.create({
      data: {
        name: data.name,
        tokenHash: sha256(rawToken),
        tokenPreview: `${rawToken.slice(0, 14)}...${rawToken.slice(-4)}`,
        tokenValue: rawToken,
        maxUses: data.maxUses ? Number(data.maxUses) : null,
        expiresAt,
        createdById: actor.id,
      },
    });
    await this.auditService.log({
      userId: actor.id,
      actorName: actor.fullName,
      action: 'ENROLLMENT_TOKEN_CREATED',
      entityType: 'EnrollmentToken',
      entityId: token.id,
      newValue: token.name,
    });
    return { ...token, rawToken };
  }

  async revokeEnrollmentToken(id: string, actor: { id: string; fullName: string }) {
    const updated = await this.prisma.enrollmentToken.update({
      where: { id },
      data: { isRevoked: true, tokenValue: null },
    });
    await this.auditService.log({
      userId: actor.id,
      actorName: actor.fullName,
      action: 'ENROLLMENT_TOKEN_REVOKED',
      entityType: 'EnrollmentToken',
      entityId: id,
    });
    return updated;
  }

  async listVersions() {
    return this.prisma.agentVersion.findMany({ orderBy: { releasedAt: 'desc' } });
  }

  async createVersion(data: { version: string; releaseNotes?: string; downloadUrl?: string; isLatest?: boolean; isMandatory?: boolean }) {
    if (data.isLatest) {
      await this.prisma.agentVersion.updateMany({ data: { isLatest: false } });
    }
    return this.prisma.agentVersion.create({
      data: {
        version: data.version.trim(),
        releaseNotes: data.releaseNotes || '',
        downloadUrl: data.downloadUrl || `/downloads/ITAssetAgent-${data.version.trim()}.msi`,
        sha256Hash: sha256(`agent-${data.version.trim()}`),
        isLatest: !!data.isLatest,
        isMandatory: !!data.isMandatory,
      },
    });
  }

  private resolveWindowsAgentDir(): string {
    const candidates = [
      path.resolve(process.cwd(), '..', 'agent', 'windows-agent'),
      path.resolve(process.cwd(), 'agent', 'windows-agent'),
      path.resolve(__dirname, '..', '..', '..', '..', 'agent', 'windows-agent'),
    ];
    for (const dir of candidates) {
      if (fs.existsSync(path.join(dir, 'ITAssetAgent.ps1'))) {
        return dir;
      }
    }
    throw new NotFoundException('Không tìm thấy thư mục mã nguồn agent/windows-agent trên máy chủ.');
  }

  private readonly currentPsAgentVersion = '1.5.0-ps';

  private getLivePsAgentMeta() {
    const agentDir = this.resolveWindowsAgentDir();
    const agentBuf = fs.readFileSync(path.join(agentDir, 'ITAssetAgent.ps1'));
    const trayPath = path.join(agentDir, 'ITAssetAgentTray.ps1');
    const trayBuf = fs.existsSync(trayPath) ? fs.readFileSync(trayPath) : null;
    return {
      version: this.currentPsAgentVersion,
      agentBuf,
      agentSha256: crypto.createHash('sha256').update(agentBuf).digest('hex').toLowerCase(),
      trayBuf,
      traySha256: trayBuf ? crypto.createHash('sha256').update(trayBuf).digest('hex').toLowerCase() : null,
    };
  }

  getSelfUpdateBundle() {
    const meta = this.getLivePsAgentMeta();
    return {
      version: meta.version,
      agentPs1Base64: meta.agentBuf.toString('base64'),
      agentSha256: meta.agentSha256,
      trayPs1Base64: meta.trayBuf ? meta.trayBuf.toString('base64') : null,
      traySha256: meta.traySha256,
    };
  }

  async buildOneClickInstaller(data: {
    backendUrl?: string;
    enrollmentToken?: string;
    allowSelfSignedCert?: boolean;
  }): Promise<{ filename: string; content: Buffer }> {
    const backendUrl = (data.backendUrl || 'http://localhost:3001').trim().replace(/\/+$/, '');
    const enrollmentToken = (data.enrollmentToken || '').trim();
    if (!backendUrl) {
      throw new BadRequestException('Vui lòng nhập URL máy chủ Backend.');
    }
    if (!enrollmentToken) {
      throw new BadRequestException('Vui lòng nhập Enrollment Token để nhúng vào bộ cài.');
    }

    const agentDir = this.resolveWindowsAgentDir();
    const agentPs1 = fs.readFileSync(path.join(agentDir, 'ITAssetAgent.ps1'));
    const trayPs1 = fs.readFileSync(path.join(agentDir, 'ITAssetAgentTray.ps1'));
    const uninstallBat = fs.readFileSync(path.join(agentDir, 'uninstall.bat'));

    const configObj = {
      BackendBaseUrl: backendUrl,
      EnrollmentToken: enrollmentToken,
      AgentVersion: this.currentPsAgentVersion,
      AllowSelfSignedCert: Boolean(data.allowSelfSignedCert),
      HeartbeatIntervalSec: 120,
      SnapshotIntervalSec: 1800,
    };
    const configBuf = Buffer.from(JSON.stringify(configObj, null, 2), 'utf8');

    const chunkB64 = (buf: Buffer) =>
      (buf.toString('base64').match(/.{1,120}/g) || []).join('\r\n');

    const bootstrapPs1 = [
      '$ErrorActionPreference = "Stop"',
      '$self = $env:ITAM_SETUP_SELF',
      'if (-not $self -or -not (Test-Path -LiteralPath $self)) { throw "Khong tim thay file cai dat goc." }',
      '$raw = Get-Content -LiteralPath $self -Raw',
      'function Extract-Block([string]$name, [string]$dest) {',
      '    $pattern = "::BEGIN_" + $name + "\\r?\\n([\\s\\S]*?)\\r?\\n::END_" + $name',
      '    $m = [regex]::Match($raw, $pattern)',
      '    if (-not $m.Success) { throw "Khong doc duoc goi du lieu: $name" }',
      '    $b64 = $m.Groups[1].Value -replace "\\s+", ""',
      '    $bytes = [Convert]::FromBase64String($b64)',
      '    for ($i = 1; $i -le 5; $i++) {',
      '        try {',
      '            if (Test-Path -LiteralPath $dest) { Set-ItemProperty -LiteralPath $dest -Name IsReadOnly -Value $false -ErrorAction SilentlyContinue }',
      '            [IO.File]::WriteAllBytes($dest, $bytes)',
      '            return',
      '        } catch {',
      '            if ($i -eq 5) { throw $_ }',
      '            Start-Sleep -Milliseconds 500',
      '        }',
      '    }',
      '}',
      '$installDir = "C:\\Program Files\\ITAssetAgent"',
      '$dataDir = "C:\\ProgramData\\ITAssetAgent"',
      '$hasExisting = (Test-Path -LiteralPath $installDir) -or (Get-ScheduledTask -TaskName "ITAssetManagementAgent" -ErrorAction SilentlyContinue)',
      'if ($hasExisting) {',
      '    Write-Host "[0/3] Phat hien Agent cu -> tu dong dung dich vu va ghi de phien ban moi..."',
      '}',
      'foreach ($tName in @("ITAssetManagementAgent", "ITAssetManagementAgentTray")) {',
      '    try { Stop-ScheduledTask -TaskName $tName -ErrorAction SilentlyContinue } catch {}',
      '    try { Unregister-ScheduledTask -TaskName $tName -Confirm:$false -ErrorAction SilentlyContinue } catch {}',
      '}',
      'foreach ($svcName in @("ITAssetAgent", "ITAssetManagementAgent")) {',
      '    try {',
      '        $svc = Get-Service -Name $svcName -ErrorAction SilentlyContinue',
      '        if ($svc) { Stop-Service -Name $svcName -Force -ErrorAction SilentlyContinue; & sc.exe delete $svcName | Out-Null }',
      '    } catch {}',
      '}',
      'try {',
      '    Get-CimInstance Win32_Process -Filter "Name=\'powershell.exe\' OR Name=\'pwsh.exe\'" -ErrorAction SilentlyContinue | Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -match "ITAssetAgent(\\.ps1|Tray\\.ps1)" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }',
      '} catch {}',
      'if ($hasExisting) { Start-Sleep -Milliseconds 800 }',
      'New-Item -ItemType Directory -Path $installDir -Force | Out-Null',
      'New-Item -ItemType Directory -Path $dataDir -Force | Out-Null',
      'Extract-Block "AGENT_PS1" (Join-Path $installDir "ITAssetAgent.ps1")',
      'Extract-Block "TRAY_PS1" (Join-Path $installDir "ITAssetAgentTray.ps1")',
      'Extract-Block "UNINSTALL_BAT" (Join-Path $installDir "uninstall.bat")',
      'Extract-Block "CONFIG_JSON" (Join-Path $dataDir "config.json")',
      'Remove-Item -Path (Join-Path $dataDir "state.json") -Force -ErrorAction SilentlyContinue',
      'Write-Host "[1/3] Da giai nen va ghi de file Agent + cau hinh thanh cong."',
      'Write-Host "[2/3] Dang dang ky (Enroll) va dong bo cau hinh lan dau ve may chu..."',
      '& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $installDir "ITAssetAgent.ps1") -Mode Once -ConfigPath (Join-Path $dataDir "config.json")',
      'if ($LASTEXITCODE -ne 0) { throw "Dong bo lan dau that bai (ma loi $LASTEXITCODE). Kiem tra URL may chu va Enrollment Token trong config.json." }',
      '$agentArgs = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"C:\\Program Files\\ITAssetAgent\\ITAssetAgent.ps1`" -Mode Daemon -ConfigPath `"C:\\ProgramData\\ITAssetAgent\\config.json`""',
      '$a1 = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $agentArgs',
      '$t1 = New-ScheduledTaskTrigger -AtStartup',
      '$p1 = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest',
      '$s1 = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)',
      'Register-ScheduledTask -TaskName "ITAssetManagementAgent" -Action $a1 -Trigger $t1 -Principal $p1 -Settings $s1 -Force | Out-Null',
      'Start-ScheduledTask -TaskName "ITAssetManagementAgent"',
      '$trayArgs = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"C:\\Program Files\\ITAssetAgent\\ITAssetAgentTray.ps1`""',
      '$a2 = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $trayArgs',
      '$t2 = New-ScheduledTaskTrigger -AtLogOn',
      '$p2 = New-ScheduledTaskPrincipal -GroupId "BUILTIN\\Users" -RunLevel Limited',
      '$s2 = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero)',
      'Register-ScheduledTask -TaskName "ITAssetManagementAgentTray" -Action $a2 -Trigger $t2 -Principal $p2 -Settings $s2 -Force | Out-Null',
      'Start-Process powershell.exe -ArgumentList $trayArgs',
      'Write-Host "[3/3] Da dang ky va khoi dong dich vu chay ngam (SYSTEM) + System Tray."',
    ].join('\r\n');

    const loaderPs1 = [
      '$ErrorActionPreference="Stop"',
      '$r=Get-Content -LiteralPath $env:ITAM_SETUP_SELF -Raw',
      '$m=[regex]::Match($r,"::BEGIN_INSTALL_PS1\\r?\\n([\\s\\S]*?)\\r?\\n::END_INSTALL_PS1")',
      'if(-not $m.Success){throw "Missing INSTALL_PS1"}',
      '$t=Join-Path $env:TEMP "itam-install.ps1"',
      '[IO.File]::WriteAllBytes($t,[Convert]::FromBase64String(($m.Groups[1].Value -replace "\\s+","")))',
      '& $t',
      'exit $LASTEXITCODE',
    ].join(';');

    const encodedLoader = Buffer.from(loaderPs1, 'utf16le').toString('base64');
    const bootstrapBuf = Buffer.from(bootstrapPs1, 'utf8');

    const bat = [
      '@echo off',
      'chcp 65001 >nul',
      'setlocal',
      '',
      ':: Tu dong yeu cau quyen Administrator',
      'net session >nul 2>&1',
      'if %errorLevel% neq 0 (',
      '    echo Dang yeu cau quyen Administrator de cai dat IT Asset Management Agent...',
      '    powershell -NoProfile -Command "Start-Process -FilePath \'%~f0\' -Verb RunAs"',
      '    exit /b',
      ')',
      '',
      'echo ============================================================',
      'echo   IT ASSET MANAGEMENT - CAI DAT WINDOWS AGENT (1-CLICK)',
      `echo   May chu: ${backendUrl}`,
      'echo ============================================================',
      'set "ITAM_SETUP_SELF=%~f0"',
      `powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encodedLoader}`,
      'if %errorLevel% neq 0 (',
      '    echo.',
      '    echo [LOI] Cai dat that bai! Vui long kiem tra thong bao loi o tren.',
      '    pause',
      '    exit /b %errorLevel%',
      ')',
      'echo.',
      'echo ============================================================',
      'echo   HOAN TAT CAI DAT WINDOWS AGENT!',
      'echo   - Thu muc cai dat : C:\\Program Files\\ITAssetAgent',
      'echo   - File cau hinh   : C:\\ProgramData\\ITAssetAgent\\config.json',
      'echo   - Nhat ky dong bo : C:\\ProgramData\\ITAssetAgent\\logs\\agent.log',
      'echo ============================================================',
      'pause',
      'exit /b 0',
      '',
      '::BEGIN_INSTALL_PS1',
      chunkB64(bootstrapBuf),
      '::END_INSTALL_PS1',
      '::BEGIN_AGENT_PS1',
      chunkB64(agentPs1),
      '::END_AGENT_PS1',
      '::BEGIN_TRAY_PS1',
      chunkB64(trayPs1),
      '::END_TRAY_PS1',
      '::BEGIN_UNINSTALL_BAT',
      chunkB64(uninstallBat),
      '::END_UNINSTALL_BAT',
      '::BEGIN_CONFIG_JSON',
      chunkB64(configBuf),
      '::END_CONFIG_JSON',
      '',
    ].join('\r\n');

    return {
      filename: 'ITAssetAgent-Setup.bat',
      content: Buffer.from(bat, 'utf8'),
    };
  }
}
