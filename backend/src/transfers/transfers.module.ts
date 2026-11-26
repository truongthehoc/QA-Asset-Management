import { Module, Injectable, Controller, Get, Post, Body, Query, Req, UseGuards, NotFoundException, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { JwtAuthGuard, PermissionsGuard, RequirePermissions, CurrentUser, AuthUser } from '../auth/guards';

@Injectable()
export class TransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listAssignments() {
    return this.prisma.assetAssignment.findMany({
      include: {
        asset: { select: { id: true, assetCode: true, name: true, status: true } },
        department: true,
      },
      orderBy: { handoverDate: 'desc' },
    });
  }

  async listTransfers() {
    return this.prisma.assetTransfer.findMany({
      include: {
        asset: { select: { id: true, assetCode: true, name: true, status: true } },
        fromDepartment: true,
        toDepartment: true,
      },
      orderBy: { transferDate: 'desc' },
    });
  }

  async createHandover(body: any, actor: AuthUser, ip?: string) {
    const asset = await this.prisma.asset.findUnique({ where: { id: body.assetId } });
    if (!asset) throw new NotFoundException('Không tìm thấy tài sản.');
    if (!body.assigneeName) throw new BadRequestException('Vui lòng nhập người tiếp nhận.');

    const assignmentCode = `BG-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`;
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.assetAssignment.updateMany({
        where: { assetId: asset.id, status: 'ACTIVE' },
        data: { status: 'RETURNED', returnDate: new Date() },
      });

      const rec = await tx.assetAssignment.create({
        data: {
          assetId: asset.id,
          assignmentCode,
          departmentId: body.departmentId || null,
          assigneeName: body.assigneeName,
          assigneeUserId: body.assigneeUserId || null,
          handoverBy: body.handoverBy || actor.fullName,
          receivedBy: body.receivedBy || body.assigneeName,
          locationDetail: body.locationDetail || null,
          handoverDate: body.handoverDate ? new Date(body.handoverDate) : new Date(),
          notes: body.notes || null,
        },
      });

      await tx.asset.update({
        where: { id: asset.id },
        data: {
          status: 'IN_USE',
          usingDepartmentId: body.departmentId || asset.usingDepartmentId,
          assignedUserId: body.assigneeUserId || null,
          assignedUserName: body.assigneeName,
          locationId: body.locationId || asset.locationId,
          locationDetail: body.locationDetail || asset.locationDetail,
          handoverDate: rec.handoverDate,
          handoverBy: rec.handoverBy,
          receivedBy: rec.receivedBy,
        },
      });
      return rec;
    });

    await this.auditService.logAsset({
      assetId: asset.id,
      action: 'HANDOVER',
      oldValue: asset.assignedUserName || 'Chưa phân bổ',
      newValue: `${body.assigneeName} (${assignmentCode})`,
      reason: body.notes || 'Lập phiếu bàn giao tài sản',
      actorId: actor.id,
      actorName: actor.fullName,
      ipAddress: ip,
    });

    return result;
  }

  /**
   * SRS 8.4: Asset Transfer - ALWAYS records full transfer history before updating current holder/dept.
   */
  async createTransfer(body: any, actor: AuthUser, ip?: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id: body.assetId },
      include: { usingDepartment: true, location: true },
    });
    if (!asset) throw new NotFoundException('Không tìm thấy tài sản.');
    if (!body.reason || !body.reason.trim()) throw new BadRequestException('Vui lòng nhập lý do điều chuyển.');

    const transferCode = `DC-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`;
    const result = await this.prisma.$transaction(async (tx) => {
      const rec = await tx.assetTransfer.create({
        data: {
          transferCode,
          assetId: asset.id,
          fromDepartmentId: asset.usingDepartmentId,
          fromUserName: asset.assignedUserName || 'Kho / Chưa gán',
          fromLocation: asset.location?.name || asset.locationDetail || null,
          toDepartmentId: body.toDepartmentId || null,
          toUserName: body.toUserName || null,
          toLocation: body.toLocation || null,
          reason: body.reason.trim(),
          handoverBy: body.handoverBy || actor.fullName,
          receivedBy: body.receivedBy || body.toUserName || 'Đại diện phòng ban mới',
          transferDate: body.transferDate ? new Date(body.transferDate) : new Date(),
          status: 'COMPLETED',
          notes: body.notes || null,
          createdById: actor.id,
        },
      });

      await tx.assetAssignment.updateMany({
        where: { assetId: asset.id, status: 'ACTIVE' },
        data: { status: 'RETURNED', returnDate: new Date() },
      });

      if (body.toUserName || body.toDepartmentId) {
        await tx.assetAssignment.create({
          data: {
            assetId: asset.id,
            assignmentCode: `BG-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`,
            departmentId: body.toDepartmentId || null,
            assigneeName: body.toUserName || 'Phòng ban tiếp nhận',
            assigneeUserId: body.toUserId || null,
            handoverBy: rec.handoverBy,
            receivedBy: rec.receivedBy,
            locationDetail: body.toLocation || null,
            handoverDate: rec.transferDate,
            notes: `Theo phiếu điều chuyển ${transferCode}`,
          },
        });
      }

      await tx.asset.update({
        where: { id: asset.id },
        data: {
          status: body.toDepartmentId || body.toUserName ? 'IN_USE' : 'UNALLOCATED',
          usingDepartmentId: body.toDepartmentId || null,
          assignedUserId: body.toUserId || null,
          assignedUserName: body.toUserName || null,
          locationId: body.toLocationId || asset.locationId,
          locationDetail: body.toLocation || asset.locationDetail,
          handoverDate: rec.transferDate,
          handoverBy: rec.handoverBy,
          receivedBy: rec.receivedBy,
        },
      });

      return rec;
    });

    await this.auditService.logAsset({
      assetId: asset.id,
      action: 'TRANSFERRED',
      oldValue: `${asset.usingDepartment?.name || 'Kho'} / ${asset.assignedUserName || 'N/A'}`,
      newValue: `${body.toUserName || 'Phòng ban mới'} (${transferCode})`,
      reason: body.reason.trim(),
      actorId: actor.id,
      actorName: actor.fullName,
      ipAddress: ip,
    });

    return result;
  }
}

@ApiTags('Transfers & Handovers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('api/v1/transfers')
export class TransfersController {
  constructor(private readonly service: TransfersService) {}

  @Get('assignments')
  @RequirePermissions('assets.read')
  listAssignments() {
    return this.service.listAssignments();
  }

  @Get()
  @RequirePermissions('assets.read')
  listTransfers() {
    return this.service.listTransfers();
  }

  @Post('handover')
  @RequirePermissions('transfers.manage')
  createHandover(@Body() body: any, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.service.createHandover(body, user, req.ip);
  }

  @Post()
  @RequirePermissions('transfers.manage')
  createTransfer(@Body() body: any, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.service.createTransfer(body, user, req.ip);
  }
}

@Module({
  providers: [TransfersService],
  controllers: [TransfersController],
})
export class TransfersModule {}
