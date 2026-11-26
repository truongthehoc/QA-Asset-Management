import { Module, Injectable, Controller, Get, Post, Patch, Param, Body, Query, UseGuards, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { JwtAuthGuard, PermissionsGuard, RequirePermissions, CurrentUser, AuthUser } from '../auth/guards';

@Injectable()
export class MaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(query: { status?: string; maintenanceType?: string }) {
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.maintenanceType) where.maintenanceType = query.maintenanceType;
    return this.prisma.assetMaintenance.findMany({
      where,
      include: {
        asset: { select: { id: true, assetCode: true, name: true, status: true, usingDepartment: true } },
      },
      orderBy: { receivedDate: 'desc' },
    });
  }

  async create(body: any, actor: AuthUser) {
    const asset = await this.prisma.asset.findUnique({ where: { id: body.assetId } });
    if (!asset) throw new NotFoundException('Không tìm thấy tài sản.');

    const ticketCode = `BT-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`;
    const ticket = await this.prisma.assetMaintenance.create({
      data: {
        ticketCode,
        assetId: asset.id,
        maintenanceType: body.maintenanceType || 'REPAIR',
        issueSummary: body.issueSummary,
        conditionBefore: body.conditionBefore || null,
        receivedDate: body.receivedDate ? new Date(body.receivedDate) : new Date(),
        vendorName: body.vendorName || null,
        workPerformed: body.workPerformed || null,
        replacedParts: body.replacedParts || null,
        cost: body.cost ? Number(body.cost) : 0,
        performedBy: body.performedBy || actor.fullName,
        status: body.status || 'IN_PROGRESS',
        documentRef: body.documentRef || null,
        notes: body.notes || null,
        createdById: actor.id,
      },
      include: { asset: { select: { id: true, assetCode: true, name: true } } },
    });

    if (ticket.status !== 'COMPLETED' && ticket.status !== 'CANCELLED') {
      await this.prisma.asset.update({ where: { id: asset.id }, data: { status: 'MAINTENANCE' } });
    }

    await this.auditService.logAsset({
      assetId: asset.id,
      action: 'MAINTENANCE',
      newValue: `${ticketCode}: ${ticket.issueSummary} (${ticket.cost} VND)`,
      actorId: actor.id,
      actorName: actor.fullName,
    });
    return ticket;
  }

  async update(id: string, body: any, actor: AuthUser) {
    const existing = await this.prisma.assetMaintenance.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Không tìm thấy phiếu bảo trì.');

    const updated = await this.prisma.assetMaintenance.update({
      where: { id },
      data: {
        workPerformed: body.workPerformed ?? existing.workPerformed,
        replacedParts: body.replacedParts ?? existing.replacedParts,
        cost: body.cost !== undefined ? Number(body.cost) : existing.cost,
        vendorName: body.vendorName ?? existing.vendorName,
        performedBy: body.performedBy ?? existing.performedBy,
        status: body.status ?? existing.status,
        completedDate:
          body.status === 'COMPLETED' && !existing.completedDate
            ? new Date()
            : body.completedDate
              ? new Date(body.completedDate)
              : existing.completedDate,
        notes: body.notes ?? existing.notes,
      },
    });

    if (updated.status === 'COMPLETED') {
      await this.prisma.asset.update({ where: { id: existing.assetId }, data: { status: 'IN_USE' } });
    }

    await this.auditService.logAsset({
      assetId: existing.assetId,
      action: 'MAINTENANCE_UPDATED',
      oldValue: existing.status,
      newValue: `${updated.ticketCode}: ${updated.status} (Chi phí: ${updated.cost})`,
      actorId: actor.id,
      actorName: actor.fullName,
    });
    return updated;
  }

  async listDisposals() {
    return this.prisma.assetDisposal.findMany({
      include: { asset: { select: { id: true, assetCode: true, name: true, serialNumber: true } } },
      orderBy: { disposalDate: 'desc' },
    });
  }

  async createDisposal(body: any, actor: AuthUser) {
    const asset = await this.prisma.asset.findUnique({ where: { id: body.assetId } });
    if (!asset) throw new NotFoundException('Không tìm thấy tài sản.');
    const disposalCode = `TL-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`;
    const rec = await this.prisma.$transaction(async (tx) => {
      const d = await tx.assetDisposal.create({
        data: {
          disposalCode,
          assetId: asset.id,
          disposalDate: body.disposalDate ? new Date(body.disposalDate) : new Date(),
          reason: body.reason,
          method: body.method || 'LIQUIDATION',
          salvageValue: body.salvageValue ? Number(body.salvageValue) : 0,
          approvedBy: body.approvedBy || actor.fullName,
          decisionNumber: body.decisionNumber || null,
          notes: body.notes || null,
        },
      });
      await tx.asset.update({ where: { id: asset.id }, data: { status: 'DISPOSED' } });
      return d;
    });

    await this.auditService.logAsset({
      assetId: asset.id,
      action: 'DISPOSED',
      oldValue: asset.status,
      newValue: `DISPOSED (${disposalCode})`,
      reason: body.reason,
      actorId: actor.id,
      actorName: actor.fullName,
    });
    return rec;
  }
}

@ApiTags('Maintenance & Disposal')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('api/v1/maintenance')
export class MaintenanceController {
  constructor(private readonly service: MaintenanceService) {}

  @Get()
  @RequirePermissions('assets.read')
  list(@Query() query: any) {
    return this.service.list(query);
  }

  @Post()
  @RequirePermissions('maintenance.manage')
  create(@Body() body: any, @CurrentUser() user: AuthUser) {
    return this.service.create(body, user);
  }

  @Patch(':id')
  @RequirePermissions('maintenance.manage')
  update(@Param('id') id: string, @Body() body: any, @CurrentUser() user: AuthUser) {
    return this.service.update(id, body, user);
  }

  @Get('disposals')
  @RequirePermissions('assets.read')
  listDisposals() {
    return this.service.listDisposals();
  }

  @Post('disposals')
  @RequirePermissions('maintenance.manage')
  createDisposal(@Body() body: any, @CurrentUser() user: AuthUser) {
    return this.service.createDisposal(body, user);
  }
}

@Module({
  providers: [MaintenanceService],
  controllers: [MaintenanceController],
})
export class MaintenanceModule {}
