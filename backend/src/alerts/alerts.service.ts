import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { buildCanonicalSnapshot } from '../agents/agents.service';
import { AuthUser } from '../auth/guards';

@Injectable()
export class AlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listAlerts(query: { category?: string; severity?: string; status?: string; search?: string }) {
    const where: any = {};
    if (query.category) where.category = query.category;
    if (query.severity) where.severity = query.severity;
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search } },
        { message: { contains: query.search } },
        { component: { contains: query.search } },
      ];
    }
    return this.prisma.alertEvent.findMany({
      where,
      include: {
        asset: { select: { id: true, assetCode: true, name: true, hostname: true } },
        agent: { select: { id: true, agentUid: true, hostname: true, status: true } },
        deviceChange: {
          include: { verifiedBy: { select: { fullName: true } } },
        },
        acknowledgements: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { detectedAt: 'desc' },
      take: 200,
    });
  }

  async updateAlertStatus(id: string, toStatus: string, notes: string, actor: AuthUser) {
    const valid = ['NEW', 'ACKNOWLEDGED', 'IN_PROGRESS', 'CONFIRMED', 'CLOSED', 'IGNORED'];
    if (!valid.includes(toStatus)) {
      throw new BadRequestException('Trạng thái cảnh báo không hợp lệ.');
    }
    const alert = await this.prisma.alertEvent.findUnique({ where: { id } });
    if (!alert) throw new NotFoundException('Không tìm thấy cảnh báo.');

    const updated = await this.prisma.alertEvent.update({
      where: { id },
      data: {
        status: toStatus,
        resolvedAt: ['CONFIRMED', 'CLOSED', 'IGNORED'].includes(toStatus) ? new Date() : null,
      },
    });

    await this.prisma.alertAcknowledgement.create({
      data: {
        alertId: id,
        userId: actor.id,
        actorName: actor.fullName,
        fromStatus: alert.status,
        toStatus,
        notes: notes || null,
      },
    });

    await this.auditService.log({
      userId: actor.id,
      actorName: actor.fullName,
      action: 'ALERT_STATUS_UPDATED',
      entityType: 'AlertEvent',
      entityId: id,
      oldValue: alert.status,
      newValue: toStatus,
      reason: notes,
    });

    return updated;
  }

  async listDeviceChanges(query: { status?: string; component?: string; assetId?: string }) {
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.component) where.component = query.component;
    if (query.assetId) where.assetId = query.assetId;
    return this.prisma.deviceChange.findMany({
      where,
      include: {
        asset: { select: { id: true, assetCode: true, name: true, hostname: true } },
        agent: { select: { id: true, agentUid: true, hostname: true } },
        verifiedBy: { select: { fullName: true } },
      },
      orderBy: { detectedAt: 'desc' },
      take: 150,
    });
  }

  /**
   * SRS 5.4: Verify a detected configuration drift.
   * Only when IT explicitly approves does the Baseline advance to a new version!
   */
  async verifyDeviceChange(
    changeId: string,
    decision: 'APPROVED' | 'REJECTED' | 'IGNORED',
    notes: string,
    updateBaseline: boolean,
    actor: AuthUser,
  ) {
    const change = await this.prisma.deviceChange.findUnique({
      where: { id: changeId },
      include: {
        snapshot: {
          include: {
            processors: true,
            memoryModules: true,
            disks: true,
            graphics: true,
            operatingSystem: true,
            software: true,
          },
        },
      },
    });
    if (!change) throw new NotFoundException('Không tìm thấy thay đổi cấu hình.');

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedChange = await tx.deviceChange.update({
        where: { id: changeId },
        data: {
          status: decision,
          verifiedById: actor.id,
          verifiedAt: new Date(),
          verifyNotes: notes || null,
        },
      });

      let newBaseline: any = null;
      if (decision === 'APPROVED' && updateBaseline && change.assetId && change.snapshot) {
        const latestBase = await tx.deviceBaseline.findFirst({
          where: { assetId: change.assetId },
          orderBy: { version: 'desc' },
        });
        await tx.deviceBaseline.updateMany({
          where: { assetId: change.assetId, isActive: true },
          data: { isActive: false },
        });
        const canonical = buildCanonicalSnapshot(change.snapshot);
        newBaseline = await tx.deviceBaseline.create({
          data: {
            assetId: change.assetId,
            agentId: change.agentId,
            snapshotId: change.snapshotId,
            version: (latestBase?.version || 0) + 1,
            isActive: true,
            baselineJson: JSON.stringify(canonical),
            confirmedById: actor.id,
            notes: notes || `Cập nhật Baseline sau khi xác minh thay đổi ${change.component}`,
          },
        });
        await tx.asset.update({
          where: { id: change.assetId },
          data: { officialSpecsJson: JSON.stringify(canonical) },
        });
      }

      // Close related alert events
      const targetAlertStatus = decision === 'APPROVED' ? 'CONFIRMED' : decision === 'IGNORED' ? 'IGNORED' : 'CLOSED';
      const relatedAlerts = await tx.alertEvent.findMany({ where: { deviceChangeId: changeId } });
      for (const a of relatedAlerts) {
        await tx.alertEvent.update({
          where: { id: a.id },
          data: { status: targetAlertStatus, resolvedAt: new Date() },
        });
        await tx.alertAcknowledgement.create({
          data: {
            alertId: a.id,
            userId: actor.id,
            actorName: actor.fullName,
            fromStatus: a.status,
            toStatus: targetAlertStatus,
            notes: notes || `IT ${decision} thay đổi ${change.component}`,
          },
        });
      }

      return { updatedChange, newBaseline };
    });

    if (change.assetId) {
      await this.auditService.logAsset({
        assetId: change.assetId,
        action: decision === 'APPROVED' ? 'BASELINE_UPDATED' : 'CHANGE_REJECTED',
        fieldName: change.component,
        oldValue: change.previousValue,
        newValue: change.newValue,
        reason: notes || `Xác minh thay đổi: ${decision}`,
        actorId: actor.id,
        actorName: actor.fullName,
      });
    }

    return result;
  }

  async listRules() {
    return this.prisma.alertRule.findMany({ orderBy: { category: 'asc' } });
  }

  async updateRule(id: string, body: { severity?: string; isEnabled?: boolean; threshold?: string }, actor: AuthUser) {
    const existing = await this.prisma.alertRule.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Không tìm thấy quy tắc cảnh báo.');
    const updated = await this.prisma.alertRule.update({
      where: { id },
      data: {
        severity: body.severity || existing.severity,
        isEnabled: body.isEnabled !== undefined ? body.isEnabled : existing.isEnabled,
        threshold: body.threshold !== undefined ? body.threshold : existing.threshold,
      },
    });
    await this.auditService.log({
      userId: actor.id,
      actorName: actor.fullName,
      action: 'ALERT_RULE_UPDATED',
      entityType: 'AlertRule',
      entityId: id,
      oldValue: { severity: existing.severity, isEnabled: existing.isEnabled, threshold: existing.threshold },
      newValue: { severity: updated.severity, isEnabled: updated.isEnabled, threshold: updated.threshold },
    });
    return updated;
  }
}
