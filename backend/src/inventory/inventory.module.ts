import { Module, Injectable, Controller, Get, Post, Patch, Param, Body, UseGuards, NotFoundException, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { JwtAuthGuard, PermissionsGuard, RequirePermissions, CurrentUser, AuthUser } from '../auth/guards';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listSessions() {
    const sessions = await this.prisma.inventorySession.findMany({
      include: {
        department: true,
        items: { select: { status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return sessions.map((s) => {
      const total = s.items.length;
      const checked = s.items.filter((i) => i.status === 'CHECKED').length;
      const notChecked = s.items.filter((i) => i.status === 'NOT_CHECKED').length;
      const discrepancy = total - checked - notChecked;
      return { ...s, stats: { total, checked, notChecked, discrepancy } };
    });
  }

  async getSession(id: string) {
    const session = await this.prisma.inventorySession.findUnique({
      where: { id },
      include: {
        department: true,
        items: {
          include: {
            asset: {
              include: {
                assetType: true,
                usingDepartment: true,
                location: true,
              },
            },
          },
          orderBy: { asset: { assetCode: 'asc' } },
        },
      },
    });
    if (!session) throw new NotFoundException('Không tìm thấy đợt kiểm kê.');
    return session;
  }

  async createSession(body: any, actor: AuthUser) {
    if (!body.name) throw new BadRequestException('Vui lòng nhập tên đợt kiểm kê.');
    const whereAsset: any = { status: { not: 'DISPOSED' } };
    if (body.departmentId) whereAsset.usingDepartmentId = body.departmentId;
    if (body.assetTypeId) whereAsset.assetTypeId = body.assetTypeId;

    const assets = await this.prisma.asset.findMany({ where: whereAsset, select: { id: true } });
    const sessionCode = `KK-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;

    const session = await this.prisma.inventorySession.create({
      data: {
        sessionCode,
        name: body.name,
        departmentId: body.departmentId || null,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        notes: body.notes || null,
        createdById: actor.id,
        items: {
          create: assets.map((a) => ({ assetId: a.id, status: 'NOT_CHECKED' })),
        },
      },
      include: { _count: { select: { items: true } } },
    });

    await this.auditService.log({
      userId: actor.id,
      actorName: actor.fullName,
      action: 'INVENTORY_SESSION_CREATED',
      entityType: 'InventorySession',
      entityId: session.id,
      newValue: `${session.sessionCode} (${assets.length} tài sản)`,
    });
    return session;
  }

  async checkItem(itemId: string, body: any, actor: AuthUser) {
    const item = await this.prisma.inventoryItem.findUnique({
      where: { id: itemId },
      include: { asset: true },
    });
    if (!item) throw new NotFoundException('Không tìm thấy mục kiểm kê.');

    const updated = await this.prisma.inventoryItem.update({
      where: { id: itemId },
      data: {
        status: body.status || 'CHECKED',
        actualLocation: body.actualLocation ?? item.actualLocation,
        actualUser: body.actualUser ?? item.actualUser,
        actualCondition: body.actualCondition ?? item.actualCondition,
        discrepancyNotes: body.discrepancyNotes ?? item.discrepancyNotes,
        checkedBy: actor.fullName,
        checkedAt: new Date(),
      },
      include: { asset: true },
    });

    await this.auditService.log({
      userId: actor.id,
      actorName: actor.fullName,
      action: 'INVENTORY_ITEM_CHECKED',
      entityType: 'InventoryItem',
      entityId: itemId,
      oldValue: item.status,
      newValue: `${item.asset.assetCode}: ${updated.status}`,
      reason: updated.discrepancyNotes || undefined,
    });
    return updated;
  }

  async scanQrCheck(sessionId: string, codeOrQr: string, body: any, actor: AuthUser) {
    const cleanCode = (codeOrQr || '').replace(/^ITAM:/i, '').trim();
    const asset = await this.prisma.asset.findFirst({
      where: { OR: [{ assetCode: cleanCode }, { serialNumber: cleanCode }] },
    });
    if (!asset) throw new NotFoundException(`Không tìm thấy tài sản với mã "${cleanCode}".`);

    const item = await this.prisma.inventoryItem.findUnique({
      where: { sessionId_assetId: { sessionId, assetId: asset.id } },
    });
    if (!item) {
      throw new NotFoundException(`Tài sản ${asset.assetCode} không nằm trong danh sách đợt kiểm kê này.`);
    }
    return this.checkItem(
      item.id,
      {
        status: body.status || 'CHECKED',
        actualLocation: body.actualLocation,
        actualUser: body.actualUser,
        actualCondition: body.actualCondition || 'Đã xác nhận qua mã QR',
        discrepancyNotes: body.discrepancyNotes,
      },
      actor,
    );
  }

  async completeSession(id: string, actor: AuthUser) {
    const updated = await this.prisma.inventorySession.update({
      where: { id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
    await this.auditService.log({
      userId: actor.id,
      actorName: actor.fullName,
      action: 'INVENTORY_SESSION_COMPLETED',
      entityType: 'InventorySession',
      entityId: id,
    });
    return updated;
  }
}

@ApiTags('Inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('api/v1/inventory')
export class InventoryController {
  constructor(private readonly service: InventoryService) {}

  @Get('sessions')
  @RequirePermissions('assets.read')
  listSessions() {
    return this.service.listSessions();
  }

  @Get('sessions/:id')
  @RequirePermissions('assets.read')
  getSession(@Param('id') id: string) {
    return this.service.getSession(id);
  }

  @Post('sessions')
  @RequirePermissions('inventory.manage')
  createSession(@Body() body: any, @CurrentUser() user: AuthUser) {
    return this.service.createSession(body, user);
  }

  @Patch('items/:itemId')
  @RequirePermissions('inventory.manage')
  checkItem(@Param('itemId') itemId: string, @Body() body: any, @CurrentUser() user: AuthUser) {
    return this.service.checkItem(itemId, body, user);
  }

  @Post('sessions/:id/scan')
  @RequirePermissions('inventory.manage')
  scanQr(@Param('id') id: string, @Body() body: any, @CurrentUser() user: AuthUser) {
    return this.service.scanQrCheck(id, body.code, body, user);
  }

  @Patch('sessions/:id/complete')
  @RequirePermissions('inventory.manage')
  complete(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.completeSession(id, user);
  }
}

@Module({
  providers: [InventoryService],
  controllers: [InventoryController],
})
export class InventoryModule {}
