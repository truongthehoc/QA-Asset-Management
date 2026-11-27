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
        asset: {
          select: {
            id: true,
            assetCode: true,
            name: true,
            status: true,
            serialNumber: true,
            manufacturer: true,
            model: true,
            assetType: { select: { code: true, name: true } },
            location: { select: { name: true } },
          },
        },
        department: true,
      },
      orderBy: { handoverDate: 'desc' },
    });
  }

  async listTransfers() {
    return this.prisma.assetTransfer.findMany({
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
            assetType: { select: { code: true, name: true } },
            location: { select: { name: true } },
          },
        },
        fromDepartment: true,
        toDepartment: true,
      },
      orderBy: { transferDate: 'desc' },
    });
  }

  async createHandover(body: any, actor: AuthUser, ip?: string) {
    const asset = await this.prisma.asset.findUnique({ where: { id: body.assetId } });
    if (!asset) throw new NotFoundException('Không tìm thấy tài sản.');

    let employee: any = null;
    if (body.employeeId) {
      employee = await this.prisma.employee.findUnique({ where: { id: body.employeeId } });
      if (!employee) throw new BadRequestException('Nhân viên được chọn không tồn tại.');
    }

    const assigneeName = (body.assigneeName || employee?.fullName || '').trim();
    const departmentId = body.departmentId || employee?.departmentId || null;
    if (!assigneeName && !departmentId) {
      throw new BadRequestException('Vui lòng chọn nhân viên hoặc phòng ban tiếp nhận.');
    }

    let resolvedLocationId = body.locationId || null;
    if (!resolvedLocationId && departmentId) {
      const dept = await this.prisma.department.findUnique({ where: { id: departmentId }, select: { locationId: true } });
      resolvedLocationId = dept?.locationId || null;
    }

    const displayAssignee = assigneeName || 'Phòng ban tiếp nhận';
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
          departmentId,
          assigneeName: displayAssignee,
          assigneeUserId: body.assigneeUserId || null,
          handoverBy: body.handoverBy !== undefined ? String(body.handoverBy).trim() : actor.fullName,
          receivedBy: body.receivedBy !== undefined ? String(body.receivedBy).trim() : displayAssignee,
          locationDetail: body.locationDetail || null,
          handoverDate: body.handoverDate ? new Date(body.handoverDate) : new Date(),
          notes: body.notes || null,
        },
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
              assetType: { select: { code: true, name: true } },
              location: { select: { name: true } },
            },
          },
          department: true,
        },
      });

      await tx.asset.update({
        where: { id: asset.id },
        data: {
          status: 'IN_USE',
          usingDepartmentId: departmentId || asset.usingDepartmentId,
          assignedEmployeeId: employee ? employee.id : null,
          assignedUserId: body.assigneeUserId || null,
          assignedUserName: displayAssignee,
          locationId: resolvedLocationId || asset.locationId,
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
      newValue: `${displayAssignee} (${assignmentCode})`,
      reason: body.notes || 'Lập phiếu cấp phát / bàn giao tài sản',
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

    const isReturnToWarehouse = body.mode === 'RETURN' || (!body.employeeId && !body.toDepartmentId && !body.toUserName);
    let employee: any = null;
    if (!isReturnToWarehouse && body.employeeId) {
      employee = await this.prisma.employee.findUnique({ where: { id: body.employeeId } });
      if (!employee) throw new BadRequestException('Nhân viên được chọn không tồn tại.');
    }

    const toDepartmentId = isReturnToWarehouse ? null : (body.toDepartmentId || employee?.departmentId || null);
    const toUserName = isReturnToWarehouse ? null : ((body.toUserName || employee?.fullName || '').trim() || null);

    let resolvedToLocationId = isReturnToWarehouse ? null : (body.toLocationId || null);
    if (!isReturnToWarehouse && !resolvedToLocationId && toDepartmentId) {
      const dept = await this.prisma.department.findUnique({ where: { id: toDepartmentId }, select: { locationId: true } });
      resolvedToLocationId = dept?.locationId || null;
    }

    const transferCode = `DC-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`;
    const result = await this.prisma.$transaction(async (tx) => {
      const rec = await tx.assetTransfer.create({
        data: {
          transferCode,
          assetId: asset.id,
          fromDepartmentId: asset.usingDepartmentId,
          fromUserName: asset.assignedUserName || 'Kho / Chưa gán',
          fromLocation: asset.location?.name || asset.locationDetail || null,
          toDepartmentId,
          toUserName: toUserName || (isReturnToWarehouse ? 'Kho IT' : null),
          toLocation: body.toLocation || null,
          reason: body.reason.trim(),
          handoverBy: body.handoverBy !== undefined ? String(body.handoverBy).trim() : actor.fullName,
          receivedBy:
            body.receivedBy !== undefined
              ? String(body.receivedBy).trim()
              : toUserName || (isReturnToWarehouse ? actor.fullName : 'Đại diện phòng ban mới'),
          transferDate: body.transferDate ? new Date(body.transferDate) : new Date(),
          status: 'COMPLETED',
          notes: body.notes || null,
          createdById: actor.id,
        },
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
              assetType: { select: { code: true, name: true } },
              location: { select: { name: true } },
            },
          },
          fromDepartment: true,
          toDepartment: true,
        },
      });

      await tx.assetAssignment.updateMany({
        where: { assetId: asset.id, status: 'ACTIVE' },
        data: { status: 'RETURNED', returnDate: new Date() },
      });

      if (!isReturnToWarehouse && (toUserName || toDepartmentId)) {
        await tx.assetAssignment.create({
          data: {
            assetId: asset.id,
            assignmentCode: `BG-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`,
            departmentId: toDepartmentId,
            assigneeName: toUserName || 'Phòng ban tiếp nhận',
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
          status: isReturnToWarehouse ? 'UNALLOCATED' : 'IN_USE',
          usingDepartmentId: toDepartmentId,
          assignedEmployeeId: employee ? employee.id : null,
          assignedUserId: isReturnToWarehouse ? null : (body.toUserId || null),
          assignedUserName: toUserName,
          locationId: isReturnToWarehouse ? null : (resolvedToLocationId || asset.locationId),
          locationDetail: isReturnToWarehouse ? null : (body.toLocation || asset.locationDetail),
          handoverDate: rec.transferDate,
          handoverBy: rec.handoverBy,
          receivedBy: rec.receivedBy,
        },
      });

      return rec;
    });

    await this.auditService.logAsset({
      assetId: asset.id,
      action: isReturnToWarehouse ? 'RETURNED_TO_STOCK' : 'TRANSFERRED',
      oldValue: `${asset.usingDepartment?.name || 'Kho'} / ${asset.assignedUserName || 'N/A'}`,
      newValue: isReturnToWarehouse ? `Thu hồi về kho (${transferCode})` : `${toUserName || 'Phòng ban mới'} (${transferCode})`,
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
