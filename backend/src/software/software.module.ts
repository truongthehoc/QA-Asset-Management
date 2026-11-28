import {
  Module,
  Injectable,
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { memoryStorage } from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard, PermissionsGuard, RequirePermissions, CurrentUser, AuthUser } from '../auth/guards';

const LICENSE_UPLOAD_DIR = path.resolve(process.cwd(), 'storage', 'uploads', 'licenses');

function computeEffectiveStatus(lic: { status: string; expirationDate?: Date | null }) {
  if (lic.status === 'REVOKED' || lic.status === 'CANCELLED') {
    return { effectiveStatus: lic.status, daysRemaining: null as number | null };
  }
  if (!lic.expirationDate) {
    return { effectiveStatus: lic.status || 'ACTIVE', daysRemaining: null as number | null };
  }
  const now = new Date();
  const diffDays = Math.ceil((new Date(lic.expirationDate).getTime() - now.getTime()) / 86_400_000);
  if (diffDays < 0) return { effectiveStatus: 'EXPIRED', daysRemaining: diffDays };
  if (diffDays <= 30) return { effectiveStatus: 'EXPIRING_SOON', daysRemaining: diffDays };
  return { effectiveStatus: 'ACTIVE', daysRemaining: diffDays };
}

function formatTargetLabel(t: {
  employeeName?: string | null;
  departmentName?: string | null;
  assetCode?: string | null;
  assignedAccount?: string | null;
}): string {
  const parts: string[] = [];
  if (t.employeeName) parts.push(t.employeeName);
  if (t.departmentName) parts.push(t.departmentName);
  if (t.assetCode) parts.push(`Máy ${t.assetCode}`);
  if (t.assignedAccount) parts.push(`TK: ${t.assignedAccount}`);
  return parts.join(' · ') || 'Không xác định';
}

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

  // ==================== SOFTWARE LICENSE LIFECYCLE ====================

  private async resolveTargetRefs(body: {
    assetId?: string;
    employeeId?: string;
    departmentId?: string;
    assignedAccount?: string;
  }) {
    let assetCode: string | null = null;
    let assetName: string | null = null;
    let employeeName: string | null = null;
    let departmentName: string | null = null;
    let departmentId = body.departmentId || null;

    if (body.assetId) {
      const asset = await this.prisma.asset.findUnique({
        where: { id: body.assetId },
        include: { usingDepartment: true, assignedEmployee: true },
      });
      if (asset) {
        assetCode = asset.assetCode;
        assetName = asset.name;
        if (!departmentId && asset.usingDepartmentId) departmentId = asset.usingDepartmentId;
      }
    }
    if (body.employeeId) {
      const emp = await this.prisma.employee.findUnique({
        where: { id: body.employeeId },
        include: { department: true },
      });
      if (emp) {
        employeeName = emp.fullName;
        if (!departmentId && emp.departmentId) departmentId = emp.departmentId;
      }
    }
    if (departmentId) {
      const dept = await this.prisma.department.findUnique({ where: { id: departmentId } });
      if (dept) departmentName = dept.name;
    }

    return {
      assetId: body.assetId || null,
      assetCode,
      assetName,
      employeeId: body.employeeId || null,
      employeeName,
      departmentId,
      departmentName,
      assignedAccount: body.assignedAccount?.trim() || null,
    };
  }

  async listLicenses(query: { search?: string; status?: string; licenseType?: string }) {
    const where: any = {};
    if (query.licenseType) where.licenseType = query.licenseType;
    if (query.search?.trim()) {
      const q = query.search.trim();
      where.OR = [
        { licenseCode: { contains: q } },
        { name: { contains: q } },
        { publisher: { contains: q } },
        { contractNumber: { contains: q } },
        { supplierName: { contains: q } },
      ];
    }

    const list = await this.prisma.softwareLicense.findMany({
      where,
      include: {
        allocations: { where: { status: 'ACTIVE' }, select: { id: true, seatCount: true, employeeName: true, departmentName: true, assetCode: true } },
        _count: { select: { documents: true, histories: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    const enriched = list.map((lic) => {
      const usedSeats = lic.allocations.reduce((s, a) => s + (a.seatCount || 1), 0);
      const availableSeats = Math.max(0, lic.totalSeats - usedSeats);
      const { effectiveStatus, daysRemaining } = computeEffectiveStatus(lic);
      return {
        ...lic,
        usedSeats,
        availableSeats,
        effectiveStatus,
        daysRemaining,
      };
    });

    if (query.status) {
      return enriched.filter((l) => l.effectiveStatus === query.status);
    }
    return enriched;
  }

  async findLicense(id: string) {
    const lic = await this.prisma.softwareLicense.findUnique({
      where: { id },
      include: {
        allocations: { orderBy: [{ status: 'asc' }, { allocatedDate: 'desc' }] },
        histories: { orderBy: { createdAt: 'desc' } },
        documents: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!lic) throw new NotFoundException('Không tìm thấy bản quyền phần mềm.');

    const usedSeats = lic.allocations
      .filter((a) => a.status === 'ACTIVE')
      .reduce((s, a) => s + (a.seatCount || 1), 0);
    const availableSeats = Math.max(0, lic.totalSeats - usedSeats);
    const { effectiveStatus, daysRemaining } = computeEffectiveStatus(lic);

    return {
      ...lic,
      usedSeats,
      availableSeats,
      effectiveStatus,
      daysRemaining,
    };
  }

  async createLicense(body: any, actor: AuthUser) {
    if (!body.name?.trim()) throw new BadRequestException('Vui lòng nhập tên phần mềm / bản quyền.');
    const totalSeats = Math.max(1, Number(body.totalSeats) || 1);
    const licenseCode =
      body.licenseCode?.trim() || `LIC-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`;

    let supplierName = body.supplierName?.trim() || null;
    if (body.supplierId && !supplierName) {
      const sup = await this.prisma.supplier.findUnique({ where: { id: body.supplierId } });
      if (sup) supplierName = sup.name;
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const lic = await tx.softwareLicense.create({
        data: {
          licenseCode,
          name: body.name.trim(),
          publisher: body.publisher?.trim() || null,
          version: body.version?.trim() || null,
          licenseType: body.licenseType || 'SUBSCRIPTION',
          licenseKey: body.licenseKey?.trim() || null,
          totalSeats,
          status: body.status || 'ACTIVE',
          supplierId: body.supplierId || null,
          supplierName,
          contractNumber: body.contractNumber?.trim() || null,
          invoiceNumber: body.invoiceNumber?.trim() || null,
          purchasePrice: body.purchasePrice ? Number(body.purchasePrice) : 0,
          purchaseDate: body.purchaseDate ? new Date(body.purchaseDate) : null,
          activationDate: body.activationDate ? new Date(body.activationDate) : null,
          expirationDate: body.expirationDate ? new Date(body.expirationDate) : null,
          autoRenew: Boolean(body.autoRenew),
          notes: body.notes?.trim() || null,
          createdById: actor.id,
        },
      });

      await tx.softwareLicenseHistory.create({
        data: {
          licenseId: lic.id,
          action: 'CREATED',
          toTarget: `${lic.name} (${totalSeats} suất)`,
          note: `Khởi tạo hồ sơ bản quyền ${licenseCode}${lic.contractNumber ? ` — HĐ: ${lic.contractNumber}` : ''}`,
          actorId: actor.id,
          actorName: actor.fullName,
        },
      });

      return lic;
    });

    return this.findLicense(created.id);
  }

  async updateLicense(id: string, body: any, actor: AuthUser) {
    const existing = await this.prisma.softwareLicense.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Không tìm thấy bản quyền phần mềm.');

    let supplierName = body.supplierName !== undefined ? (body.supplierName?.trim() || null) : existing.supplierName;
    const supplierId = body.supplierId !== undefined ? (body.supplierId || null) : existing.supplierId;
    if (supplierId && !supplierName) {
      const sup = await this.prisma.supplier.findUnique({ where: { id: supplierId } });
      if (sup) supplierName = sup.name;
    }

    const nextExp =
      body.expirationDate !== undefined
        ? body.expirationDate
          ? new Date(body.expirationDate)
          : null
        : existing.expirationDate;

    const isRenewed =
      nextExp &&
      existing.expirationDate &&
      nextExp.getTime() > existing.expirationDate.getTime();

    await this.prisma.$transaction(async (tx) => {
      await tx.softwareLicense.update({
        where: { id },
        data: {
          name: body.name !== undefined ? body.name.trim() : existing.name,
          publisher: body.publisher !== undefined ? (body.publisher?.trim() || null) : existing.publisher,
          version: body.version !== undefined ? (body.version?.trim() || null) : existing.version,
          licenseType: body.licenseType ?? existing.licenseType,
          licenseKey: body.licenseKey !== undefined ? (body.licenseKey?.trim() || null) : existing.licenseKey,
          totalSeats: body.totalSeats !== undefined ? Math.max(1, Number(body.totalSeats) || 1) : existing.totalSeats,
          status: body.status ?? existing.status,
          supplierId,
          supplierName,
          contractNumber: body.contractNumber !== undefined ? (body.contractNumber?.trim() || null) : existing.contractNumber,
          invoiceNumber: body.invoiceNumber !== undefined ? (body.invoiceNumber?.trim() || null) : existing.invoiceNumber,
          purchasePrice: body.purchasePrice !== undefined ? Number(body.purchasePrice) || 0 : existing.purchasePrice,
          purchaseDate:
            body.purchaseDate !== undefined
              ? body.purchaseDate
                ? new Date(body.purchaseDate)
                : null
              : existing.purchaseDate,
          activationDate:
            body.activationDate !== undefined
              ? body.activationDate
                ? new Date(body.activationDate)
                : null
              : existing.activationDate,
          expirationDate: nextExp,
          autoRenew: body.autoRenew !== undefined ? Boolean(body.autoRenew) : existing.autoRenew,
          notes: body.notes !== undefined ? (body.notes?.trim() || null) : existing.notes,
        },
      });

      await tx.softwareLicenseHistory.create({
        data: {
          licenseId: id,
          action: isRenewed ? 'RENEWED' : 'UPDATED',
          note:
            body.historyNote?.trim() ||
            (isRenewed
              ? `Gia hạn bản quyền đến ngày ${nextExp!.toLocaleDateString('vi-VN')}`
              : 'Cập nhật thông tin hợp đồng / bản quyền phần mềm'),
          actorId: actor.id,
          actorName: actor.fullName,
        },
      });
    });

    return this.findLicense(id);
  }

  async deleteLicense(id: string) {
    const existing = await this.prisma.softwareLicense.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Không tìm thấy bản quyền phần mềm.');
    await this.prisma.softwareLicense.delete({ where: { id } });
    return { deleted: true };
  }

  async allocateLicense(id: string, body: any, actor: AuthUser) {
    const lic = await this.prisma.softwareLicense.findUnique({
      where: { id },
      include: { allocations: { where: { status: 'ACTIVE' } } },
    });
    if (!lic) throw new NotFoundException('Không tìm thấy bản quyền phần mềm.');

    const seatCount = Math.max(1, Number(body.seatCount) || 1);
    const usedSeats = lic.allocations.reduce((s, a) => s + (a.seatCount || 1), 0);
    if (usedSeats + seatCount > lic.totalSeats) {
      throw new BadRequestException(
        `Không đủ suất bản quyền (đã dùng ${usedSeats}/${lic.totalSeats}, cần thêm ${seatCount}).`,
      );
    }

    if (!body.employeeId && !body.assetId && !body.departmentId && !body.assignedAccount?.trim()) {
      throw new BadRequestException('Vui lòng chọn ít nhất Nhân viên, Phòng ban, Tài sản hoặc Tài khoản kích hoạt.');
    }

    const refs = await this.resolveTargetRefs(body);
    const toTarget = formatTargetLabel(refs);

    await this.prisma.$transaction(async (tx) => {
      await tx.softwareLicenseAllocation.create({
        data: {
          licenseId: id,
          status: 'ACTIVE',
          seatCount,
          ...refs,
          allocatedDate: body.allocatedDate ? new Date(body.allocatedDate) : new Date(),
          activatedDate: body.activatedDate ? new Date(body.activatedDate) : new Date(),
          notes: body.notes?.trim() || null,
          createdByName: actor.fullName,
        },
      });

      await tx.softwareLicenseHistory.create({
        data: {
          licenseId: id,
          action: 'ALLOCATED',
          fromTarget: 'Kho bản quyền',
          toTarget,
          reason: body.reason?.trim() || 'Cấp phát bản quyền sử dụng',
          note: body.notes?.trim() || `Cấp phát ${seatCount} suất cho ${toTarget}`,
          actorId: actor.id,
          actorName: actor.fullName,
        },
      });
    });

    return this.findLicense(id);
  }

  async transferAllocation(licenseId: string, allocId: string, body: any, actor: AuthUser) {
    const alloc = await this.prisma.softwareLicenseAllocation.findFirst({
      where: { id: allocId, licenseId, status: 'ACTIVE' },
    });
    if (!alloc) throw new NotFoundException('Không tìm thấy suất cấp phát đang hoạt động.');

    if (!body.employeeId && !body.assetId && !body.departmentId && !body.assignedAccount?.trim()) {
      throw new BadRequestException('Vui lòng chọn đối tượng nhận luân chuyển mới.');
    }

    const fromTarget = formatTargetLabel(alloc);
    const newRefs = await this.resolveTargetRefs(body);
    const toTarget = formatTargetLabel(newRefs);

    await this.prisma.$transaction(async (tx) => {
      await tx.softwareLicenseAllocation.update({
        where: { id: allocId },
        data: {
          status: 'TRANSFERRED',
          revokedDate: new Date(),
          revokeReason: body.reason?.trim() || `Luân chuyển sang ${toTarget}`,
        },
      });

      await tx.softwareLicenseAllocation.create({
        data: {
          licenseId,
          status: 'ACTIVE',
          seatCount: alloc.seatCount,
          ...newRefs,
          allocatedDate: body.transferDate ? new Date(body.transferDate) : new Date(),
          activatedDate: body.activatedDate ? new Date(body.activatedDate) : new Date(),
          notes: body.notes?.trim() || null,
          createdByName: actor.fullName,
        },
      });

      await tx.softwareLicenseHistory.create({
        data: {
          licenseId,
          action: 'TRANSFERRED',
          fromTarget,
          toTarget,
          reason: body.reason?.trim() || 'Luân chuyển bản quyền',
          note: body.notes?.trim() || `Luân chuyển ${alloc.seatCount} suất từ ${fromTarget} sang ${toTarget}`,
          actorId: actor.id,
          actorName: actor.fullName,
        },
      });
    });

    return this.findLicense(licenseId);
  }

  async revokeAllocation(licenseId: string, allocId: string, body: any, actor: AuthUser) {
    const alloc = await this.prisma.softwareLicenseAllocation.findFirst({
      where: { id: allocId, licenseId, status: 'ACTIVE' },
    });
    if (!alloc) throw new NotFoundException('Không tìm thấy suất cấp phát đang hoạt động.');

    const fromTarget = formatTargetLabel(alloc);
    const reason = body.reason?.trim() || 'Thu hồi bản quyền về kho';

    await this.prisma.$transaction(async (tx) => {
      await tx.softwareLicenseAllocation.update({
        where: { id: allocId },
        data: {
          status: 'REVOKED',
          revokedDate: body.revokedDate ? new Date(body.revokedDate) : new Date(),
          revokeReason: reason,
        },
      });

      await tx.softwareLicenseHistory.create({
        data: {
          licenseId,
          action: 'REVOKED',
          fromTarget,
          toTarget: 'Kho bản quyền',
          reason,
          note: `Thu hồi ${alloc.seatCount} suất từ ${fromTarget}`,
          actorId: actor.id,
          actorName: actor.fullName,
        },
      });
    });

    return this.findLicense(licenseId);
  }

  async uploadDocument(
    licenseId: string,
    file: Express.Multer.File,
    docType: string,
    notes: string,
    actor: AuthUser,
  ) {
    if (!file) throw new BadRequestException('Vui lòng chọn tệp hồ sơ cần tải lên.');
    const lic = await this.prisma.softwareLicense.findUnique({ where: { id: licenseId } });
    if (!lic) throw new NotFoundException('Không tìm thấy bản quyền phần mềm.');

    fs.mkdirSync(LICENSE_UPLOAD_DIR, { recursive: true });
    const ext = path.extname(file.originalname || '').slice(0, 12);
    const storedName = `${licenseId}-${crypto.randomUUID()}${ext}`;
    const fullPath = path.join(LICENSE_UPLOAD_DIR, storedName);
    fs.writeFileSync(fullPath, file.buffer);

    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');

    const doc = await this.prisma.$transaction(async (tx) => {
      const created = await tx.softwareLicenseDocument.create({
        data: {
          licenseId,
          docType: docType || 'CONTRACT',
          originalName,
          storedName,
          mimeType: file.mimetype || 'application/octet-stream',
          sizeBytes: file.size || file.buffer.length,
          notes: notes?.trim() || null,
          uploadedBy: actor.fullName,
        },
      });

      await tx.softwareLicenseHistory.create({
        data: {
          licenseId,
          action: 'DOCUMENT_UPLOADED',
          note: `Tải lên chứng từ (${docType || 'CONTRACT'}): ${originalName}`,
          actorId: actor.id,
          actorName: actor.fullName,
        },
      });

      return created;
    });

    return doc;
  }

  async getDocumentForDownload(docId: string) {
    const doc = await this.prisma.softwareLicenseDocument.findUnique({ where: { id: docId } });
    if (!doc) throw new NotFoundException('Không tìm thấy tệp chứng từ.');
    const fullPath = path.join(LICENSE_UPLOAD_DIR, doc.storedName);
    if (!fs.existsSync(fullPath)) throw new NotFoundException('Tệp chứng từ không tồn tại trên máy chủ.');
    return { doc, fullPath };
  }

  async deleteDocument(licenseId: string, docId: string, actor: AuthUser) {
    const doc = await this.prisma.softwareLicenseDocument.findFirst({ where: { id: docId, licenseId } });
    if (!doc) throw new NotFoundException('Không tìm thấy tệp chứng từ.');

    const fullPath = path.join(LICENSE_UPLOAD_DIR, doc.storedName);
    if (fs.existsSync(fullPath)) {
      try {
        fs.unlinkSync(fullPath);
      } catch {
        // ignore fs cleanup error
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.softwareLicenseDocument.delete({ where: { id: docId } });
      await tx.softwareLicenseHistory.create({
        data: {
          licenseId,
          action: 'DOCUMENT_DELETED',
          note: `Xóa chứng từ: ${doc.originalName}`,
          actorId: actor.id,
          actorName: actor.fullName,
        },
      });
    });

    return { deleted: true };
  }
}

@ApiTags('Software & License Management')
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

  // ---- License Management ----

  @Get('licenses')
  @RequirePermissions('software.read')
  listLicenses(@Query() query: any) {
    return this.service.listLicenses(query);
  }

  @Post('licenses')
  @RequirePermissions('assets.create')
  createLicense(@Body() body: any, @CurrentUser() user: AuthUser) {
    return this.service.createLicense(body, user);
  }

  @Get('licenses/documents/:docId/download')
  @RequirePermissions('software.read')
  async downloadDoc(@Param('docId') docId: string, @Res() res: Response) {
    const { doc, fullPath } = await this.service.getDocumentForDownload(docId);
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.originalName)}"`);
    return res.sendFile(fullPath);
  }

  @Get('licenses/:id')
  @RequirePermissions('software.read')
  findLicense(@Param('id') id: string) {
    return this.service.findLicense(id);
  }

  @Patch('licenses/:id')
  @RequirePermissions('assets.update')
  updateLicense(@Param('id') id: string, @Body() body: any, @CurrentUser() user: AuthUser) {
    return this.service.updateLicense(id, body, user);
  }

  @Delete('licenses/:id')
  @RequirePermissions('assets.delete')
  deleteLicense(@Param('id') id: string) {
    return this.service.deleteLicense(id);
  }

  @Post('licenses/:id/allocate')
  @RequirePermissions('assets.update')
  allocate(@Param('id') id: string, @Body() body: any, @CurrentUser() user: AuthUser) {
    return this.service.allocateLicense(id, body, user);
  }

  @Post('licenses/:id/allocations/:allocId/transfer')
  @RequirePermissions('assets.update')
  transfer(
    @Param('id') id: string,
    @Param('allocId') allocId: string,
    @Body() body: any,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.transferAllocation(id, allocId, body, user);
  }

  @Post('licenses/:id/allocations/:allocId/revoke')
  @RequirePermissions('assets.update')
  revoke(
    @Param('id') id: string,
    @Param('allocId') allocId: string,
    @Body() body: any,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.revokeAllocation(id, allocId, body, user);
  }

  @Post('licenses/:id/documents')
  @RequirePermissions('assets.documents')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: (Number(process.env.MAX_UPLOAD_SIZE_MB) || 15) * 1024 * 1024 },
    }),
  )
  uploadDoc(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { docType?: string; notes?: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.uploadDocument(id, file, body.docType || 'CONTRACT', body.notes || '', user);
  }

  @Delete('licenses/:id/documents/:docId')
  @RequirePermissions('assets.documents')
  deleteDoc(@Param('id') id: string, @Param('docId') docId: string, @CurrentUser() user: AuthUser) {
    return this.service.deleteDocument(id, docId, user);
  }
}

@Module({
  providers: [SoftwareService],
  controllers: [SoftwareController],
})
export class SoftwareModule {}
