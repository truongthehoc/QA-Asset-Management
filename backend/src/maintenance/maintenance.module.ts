import {
  Module,
  Injectable,
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { JwtAuthGuard, PermissionsGuard, RequirePermissions, CurrentUser, AuthUser } from '../auth/guards';

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Chờ tiếp nhận',
  IN_PROGRESS: 'Đang sửa chữa',
  WAITING_PARTS: 'Chờ linh kiện',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
};

const ACTIVE_TICKET_STATUSES = new Set(['OPEN', 'IN_PROGRESS', 'WAITING_PARTS']);

@Injectable()
export class MaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(query: { status?: string; maintenanceType?: string; search?: string }) {
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.maintenanceType) where.maintenanceType = query.maintenanceType;
    if (query.search?.trim()) {
      const q = query.search.trim();
      where.OR = [
        { ticketCode: { contains: q } },
        { issueSummary: { contains: q } },
        { vendorName: { contains: q } },
        { performedBy: { contains: q } },
        { asset: { assetCode: { contains: q } } },
        { asset: { name: { contains: q } } },
      ];
    }
    return this.prisma.assetMaintenance.findMany({
      where,
      include: {
        asset: {
          select: {
            id: true,
            assetCode: true,
            name: true,
            status: true,
            usingDepartment: { select: { id: true, name: true } },
            assignedEmployee: { select: { id: true, fullName: true } },
          },
        },
        _count: { select: { logs: true } },
      },
      orderBy: [{ receivedDate: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(id: string) {
    const ticket = await this.prisma.assetMaintenance.findUnique({
      where: { id },
      include: {
        asset: {
          select: {
            id: true,
            assetCode: true,
            name: true,
            status: true,
            serialNumber: true,
            manufacturer: true,
            model: true,
            assignedUserName: true,
            assetType: { select: { id: true, name: true, code: true } },
            usingDepartment: { select: { id: true, name: true } },
            assignedEmployee: { select: { id: true, fullName: true } },
            location: { select: { id: true, name: true } },
          },
        },
        logs: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!ticket) throw new NotFoundException('Không tìm thấy phiếu bảo trì.');
    return ticket;
  }

  async create(body: any, actor: AuthUser) {
    if (!body.assetId) throw new BadRequestException('Vui lòng chọn tài sản cần bảo trì.');
    if (!body.issueSummary?.trim()) throw new BadRequestException('Vui lòng nhập mô tả sự cố / nội dung cần xử lý.');

    const asset = await this.prisma.asset.findUnique({ where: { id: body.assetId } });
    if (!asset) throw new NotFoundException('Không tìm thấy tài sản.');

    const ticketCode = `BT-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`;
    const initialStatus = body.status && STATUS_LABELS[body.status] ? body.status : 'OPEN';
    const costNum = body.cost ? Number(body.cost) : 0;

    const ticket = await this.prisma.$transaction(async (tx) => {
      const created = await tx.assetMaintenance.create({
        data: {
          ticketCode,
          assetId: asset.id,
          maintenanceType: body.maintenanceType || 'REPAIR',
          issueSummary: body.issueSummary.trim(),
          conditionBefore: body.conditionBefore?.trim() || null,
          receivedDate: body.receivedDate ? new Date(body.receivedDate) : new Date(),
          completedDate: initialStatus === 'COMPLETED' ? new Date() : null,
          vendorName: body.vendorName?.trim() || null,
          workPerformed: body.workPerformed?.trim() || null,
          replacedParts: body.replacedParts?.trim() || null,
          cost: costNum,
          performedBy: body.performedBy?.trim() || actor.fullName,
          status: initialStatus,
          documentRef: body.documentRef?.trim() || null,
          notes: body.notes?.trim() || null,
          createdById: actor.id,
        },
        include: { asset: { select: { id: true, assetCode: true, name: true } } },
      });

      await tx.assetMaintenanceLog.create({
        data: {
          maintenanceId: created.id,
          action: 'CREATED',
          fromStatus: null,
          toStatus: initialStatus,
          note:
            body.initialNote?.trim() ||
            `Lập phiếu bảo trì (${STATUS_LABELS[initialStatus] || initialStatus}) — ${created.issueSummary}`,
          cost: costNum > 0 ? costNum : null,
          actorId: actor.id,
          actorName: actor.fullName,
        },
      });

      if (ACTIVE_TICKET_STATUSES.has(initialStatus)) {
        await tx.asset.update({ where: { id: asset.id }, data: { status: 'MAINTENANCE' } });
      }

      return created;
    });

    await this.auditService.logAsset({
      assetId: asset.id,
      action: 'MAINTENANCE_CREATED',
      newValue: `${ticketCode}: ${ticket.issueSummary} (${STATUS_LABELS[initialStatus] || initialStatus})`,
      actorId: actor.id,
      actorName: actor.fullName,
    });
    return ticket;
  }

  async update(id: string, body: any, actor: AuthUser) {
    const existing = await this.prisma.assetMaintenance.findUnique({
      where: { id },
      include: { asset: true },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy phiếu bảo trì.');

    const nextStatus = body.status && STATUS_LABELS[body.status] ? body.status : existing.status;
    const statusChanged = nextStatus !== existing.status;
    const nextCost = body.cost !== undefined && body.cost !== '' ? Number(body.cost) : existing.cost;

    const changeParts: string[] = [];
    if (statusChanged) {
      changeParts.push(
        `Chuyển trạng thái: ${STATUS_LABELS[existing.status] || existing.status} → ${STATUS_LABELS[nextStatus] || nextStatus}`,
      );
    }
    if (body.workPerformed !== undefined && body.workPerformed !== existing.workPerformed && body.workPerformed?.trim()) {
      changeParts.push(`Nội dung xử lý: ${body.workPerformed.trim()}`);
    }
    if (body.replacedParts !== undefined && body.replacedParts !== existing.replacedParts && body.replacedParts?.trim()) {
      changeParts.push(`Linh kiện thay thế: ${body.replacedParts.trim()}`);
    }
    if (nextCost !== existing.cost) {
      changeParts.push(`Chi phí: ${existing.cost.toLocaleString('vi-VN')} → ${nextCost.toLocaleString('vi-VN')} ₫`);
    }
    if (body.vendorName !== undefined && body.vendorName !== existing.vendorName && body.vendorName?.trim()) {
      changeParts.push(`Đơn vị xử lý: ${body.vendorName.trim()}`);
    }

    const logNote = body.logNote?.trim() || changeParts.join(' • ') || 'Cập nhật thông tin phiếu bảo trì';

    const updated = await this.prisma.$transaction(async (tx) => {
      const rec = await tx.assetMaintenance.update({
        where: { id },
        data: {
          maintenanceType: body.maintenanceType ?? existing.maintenanceType,
          issueSummary: body.issueSummary !== undefined ? body.issueSummary.trim() : existing.issueSummary,
          conditionBefore: body.conditionBefore !== undefined ? (body.conditionBefore?.trim() || null) : existing.conditionBefore,
          receivedDate: body.receivedDate ? new Date(body.receivedDate) : existing.receivedDate,
          workPerformed: body.workPerformed !== undefined ? (body.workPerformed?.trim() || null) : existing.workPerformed,
          replacedParts: body.replacedParts !== undefined ? (body.replacedParts?.trim() || null) : existing.replacedParts,
          cost: nextCost,
          vendorName: body.vendorName !== undefined ? (body.vendorName?.trim() || null) : existing.vendorName,
          performedBy: body.performedBy !== undefined ? (body.performedBy?.trim() || null) : existing.performedBy,
          documentRef: body.documentRef !== undefined ? (body.documentRef?.trim() || null) : existing.documentRef,
          status: nextStatus,
          completedDate:
            nextStatus === 'COMPLETED'
              ? body.completedDate
                ? new Date(body.completedDate)
                : existing.completedDate || new Date()
              : body.completedDate
                ? new Date(body.completedDate)
                : nextStatus !== 'COMPLETED' && statusChanged
                  ? null
                  : existing.completedDate,
          notes: body.notes !== undefined ? (body.notes?.trim() || null) : existing.notes,
        },
      });

      await tx.assetMaintenanceLog.create({
        data: {
          maintenanceId: id,
          action: statusChanged ? 'STATUS_CHANGED' : 'UPDATED',
          fromStatus: existing.status,
          toStatus: nextStatus,
          note: logNote,
          cost: nextCost !== existing.cost ? nextCost : null,
          actorId: actor.id,
          actorName: actor.fullName,
        },
      });

      if (statusChanged && existing.asset) {
        if (nextStatus === 'COMPLETED' || nextStatus === 'CANCELLED') {
          const hasHolder = Boolean(
            existing.asset.usingDepartmentId || existing.asset.assignedEmployeeId || existing.asset.assignedUserName,
          );
          await tx.asset.update({
            where: { id: existing.assetId },
            data: { status: hasHolder ? 'IN_USE' : 'UNALLOCATED' },
          });
        } else if (ACTIVE_TICKET_STATUSES.has(nextStatus)) {
          await tx.asset.update({
            where: { id: existing.assetId },
            data: { status: 'MAINTENANCE' },
          });
        }
      }

      return rec;
    });

    await this.auditService.logAsset({
      assetId: existing.assetId,
      action: nextStatus === 'COMPLETED' && statusChanged ? 'MAINTENANCE_COMPLETED' : 'MAINTENANCE_UPDATED',
      oldValue: STATUS_LABELS[existing.status] || existing.status,
      newValue: `${updated.ticketCode}: ${STATUS_LABELS[updated.status] || updated.status} (Chi phí: ${updated.cost.toLocaleString('vi-VN')} ₫)`,
      reason: body.logNote?.trim() || undefined,
      actorId: actor.id,
      actorName: actor.fullName,
    });

    return this.findOne(id);
  }

  async addLog(id: string, body: any, actor: AuthUser) {
    const existing = await this.prisma.assetMaintenance.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Không tìm thấy phiếu bảo trì.');
    if (!body.note?.trim()) throw new BadRequestException('Vui lòng nhập nội dung nhật ký.');

    const log = await this.prisma.assetMaintenanceLog.create({
      data: {
        maintenanceId: id,
        action: 'NOTE',
        fromStatus: existing.status,
        toStatus: existing.status,
        note: body.note.trim(),
        cost: body.cost !== undefined && body.cost !== '' && Number(body.cost) > 0 ? Number(body.cost) : null,
        actorId: actor.id,
        actorName: actor.fullName,
      },
    });
    return log;
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

  @Get(':id')
  @RequirePermissions('assets.read')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('maintenance.manage')
  update(@Param('id') id: string, @Body() body: any, @CurrentUser() user: AuthUser) {
    return this.service.update(id, body, user);
  }

  @Post(':id/logs')
  @RequirePermissions('maintenance.manage')
  addLog(@Param('id') id: string, @Body() body: any, @CurrentUser() user: AuthUser) {
    return this.service.addLog(id, body, user);
  }
}

@Module({
  providers: [MaintenanceService],
  controllers: [MaintenanceController],
})
export class MaintenanceModule {}
