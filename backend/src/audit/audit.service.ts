import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntryInput {
  userId?: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldValue?: any;
  newValue?: any;
  reason?: string;
  ipAddress?: string;
  requestId?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  private serialize(v: any): string | null {
    if (v === undefined || v === null) return null;
    return typeof v === 'string' ? v : JSON.stringify(v);
  }

  async log(input: AuditEntryInput) {
    return this.prisma.auditLog.create({
      data: {
        userId: input.userId || null,
        actorName: input.actorName,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId || null,
        oldValue: this.serialize(input.oldValue),
        newValue: this.serialize(input.newValue),
        reason: input.reason || null,
        ipAddress: input.ipAddress || null,
        requestId: input.requestId || null,
      },
    });
  }

  async logAsset(params: {
    assetId: string;
    action: string;
    fieldName?: string;
    oldValue?: any;
    newValue?: any;
    reason?: string;
    actorId?: string;
    actorName: string;
    ipAddress?: string;
  }) {
    await this.prisma.assetAuditLog.create({
      data: {
        assetId: params.assetId,
        action: params.action,
        fieldName: params.fieldName || null,
        oldValue: this.serialize(params.oldValue),
        newValue: this.serialize(params.newValue),
        reason: params.reason || null,
        actorId: params.actorId || null,
        actorName: params.actorName,
        ipAddress: params.ipAddress || null,
      },
    });
    await this.log({
      userId: params.actorId,
      actorName: params.actorName,
      action: `ASSET_${params.action}`,
      entityType: 'Asset',
      entityId: params.assetId,
      oldValue: params.oldValue,
      newValue: params.newValue,
      reason: params.reason,
      ipAddress: params.ipAddress,
    });
  }

  async findAll(query: { entityType?: string; action?: string; search?: string; limit?: number }) {
    const where: any = {};
    if (query.entityType) where.entityType = query.entityType;
    if (query.action) where.action = { contains: query.action };
    if (query.search) {
      where.OR = [
        { actorName: { contains: query.search } },
        { action: { contains: query.search } },
        { newValue: { contains: query.search } },
        { reason: { contains: query.search } },
      ];
    }
    return this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Number(query.limit) || 150,
    });
  }
}
