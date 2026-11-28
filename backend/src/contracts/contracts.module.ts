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
import { AuditService } from '../audit/audit.service';
import { JwtAuthGuard, PermissionsGuard, RequirePermissions, CurrentUser, AuthUser } from '../auth/guards';

const CONTRACT_UPLOAD_DIR = path.resolve(process.cwd(), 'storage', 'uploads', 'contracts');

export function computeContractState(c: {
  status: string;
  endDate?: Date | null;
  remindDaysBefore?: number | null;
}) {
  if (c.status === 'TERMINATED' || c.status === 'DRAFT') {
    return { effectiveStatus: c.status, daysRemaining: null as number | null, isReminding: false };
  }
  if (!c.endDate) {
    return { effectiveStatus: c.status || 'ACTIVE', daysRemaining: null as number | null, isReminding: false };
  }
  const now = new Date();
  const diffDays = Math.ceil((new Date(c.endDate).getTime() - now.getTime()) / 86_400_000);
  const remindDays = Math.max(1, c.remindDaysBefore ?? 30);
  if (diffDays < 0) {
    return { effectiveStatus: 'EXPIRED', daysRemaining: diffDays, isReminding: true };
  }
  if (diffDays <= remindDays) {
    return { effectiveStatus: 'EXPIRING_SOON', daysRemaining: diffDays, isReminding: true };
  }
  return { effectiveStatus: 'ACTIVE', daysRemaining: diffDays, isReminding: false };
}

@Injectable()
export class ContractsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(query: { search?: string; status?: string; contractType?: string; supplierId?: string }) {
    const where: any = {};
    if (query.contractType) where.contractType = query.contractType;
    if (query.supplierId) where.supplierId = query.supplierId;
    if (query.search?.trim()) {
      const q = query.search.trim();
      where.OR = [
        { contractCode: { contains: q } },
        { title: { contains: q } },
        { supplierName: { contains: q } },
        { ownerName: { contains: q } },
      ];
    }

    const list = await this.prisma.contract.findMany({
      where,
      include: { _count: { select: { documents: true } } },
      orderBy: [{ endDate: 'asc' }, { createdAt: 'desc' }],
    });

    const enriched = list.map((c) => ({
      ...c,
      ...computeContractState(c),
    }));

    if (query.status) {
      return enriched.filter((c) => c.effectiveStatus === query.status);
    }
    return enriched;
  }

  async findOne(id: string) {
    const rec = await this.prisma.contract.findUnique({
      where: { id },
      include: { documents: { orderBy: { createdAt: 'desc' } } },
    });
    if (!rec) throw new NotFoundException('Không tìm thấy hợp đồng.');
    return {
      ...rec,
      ...computeContractState(rec),
    };
  }

  async create(body: any, actor: AuthUser) {
    if (!body.title?.trim()) throw new BadRequestException('Vui lòng nhập tên / nội dung hợp đồng.');
    const contractCode =
      body.contractCode?.trim() || `HD-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`;

    const dup = await this.prisma.contract.findUnique({ where: { contractCode } });
    if (dup) throw new BadRequestException(`Số hợp đồng "${contractCode}" đã tồn tại.`);

    let supplierName = body.supplierName?.trim() || null;
    if (body.supplierId && !supplierName) {
      const sup = await this.prisma.supplier.findUnique({ where: { id: body.supplierId } });
      if (sup) supplierName = sup.name;
    }

    const created = await this.prisma.contract.create({
      data: {
        contractCode,
        title: body.title.trim(),
        contractType: body.contractType || 'PURCHASE',
        supplierId: body.supplierId || null,
        supplierName,
        contractValue: body.contractValue ? Number(body.contractValue) : 0,
        signedDate: body.signedDate ? new Date(body.signedDate) : null,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        remindDaysBefore: Math.max(1, Number(body.remindDaysBefore) || 30),
        autoRenew: Boolean(body.autoRenew),
        status: body.status || 'ACTIVE',
        ownerName: body.ownerName?.trim() || actor.fullName,
        departmentName: body.departmentName?.trim() || null,
        notes: body.notes?.trim() || null,
        createdById: actor.id,
      },
    });

    await this.auditService.log({
      userId: actor.id,
      actorName: actor.fullName,
      action: 'CONTRACT_CREATED',
      entityType: 'Contract',
      entityId: created.id,
      newValue: `${created.contractCode} — ${created.title}${supplierName ? ` (${supplierName})` : ''}`,
    });

    return this.findOne(created.id);
  }

  async update(id: string, body: any, actor: AuthUser) {
    const existing = await this.prisma.contract.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Không tìm thấy hợp đồng.');

    let supplierName =
      body.supplierName !== undefined ? (body.supplierName?.trim() || null) : existing.supplierName;
    const supplierId = body.supplierId !== undefined ? (body.supplierId || null) : existing.supplierId;
    if (supplierId && !supplierName) {
      const sup = await this.prisma.supplier.findUnique({ where: { id: supplierId } });
      if (sup) supplierName = sup.name;
    }

    await this.prisma.contract.update({
      where: { id },
      data: {
        title: body.title !== undefined ? body.title.trim() : existing.title,
        contractType: body.contractType ?? existing.contractType,
        supplierId,
        supplierName,
        contractValue: body.contractValue !== undefined ? Number(body.contractValue) || 0 : existing.contractValue,
        signedDate:
          body.signedDate !== undefined
            ? body.signedDate
              ? new Date(body.signedDate)
              : null
            : existing.signedDate,
        startDate:
          body.startDate !== undefined
            ? body.startDate
              ? new Date(body.startDate)
              : null
            : existing.startDate,
        endDate:
          body.endDate !== undefined
            ? body.endDate
              ? new Date(body.endDate)
              : null
            : existing.endDate,
        remindDaysBefore:
          body.remindDaysBefore !== undefined
            ? Math.max(1, Number(body.remindDaysBefore) || 30)
            : existing.remindDaysBefore,
        autoRenew: body.autoRenew !== undefined ? Boolean(body.autoRenew) : existing.autoRenew,
        status: body.status ?? existing.status,
        ownerName: body.ownerName !== undefined ? (body.ownerName?.trim() || null) : existing.ownerName,
        departmentName:
          body.departmentName !== undefined ? (body.departmentName?.trim() || null) : existing.departmentName,
        notes: body.notes !== undefined ? (body.notes?.trim() || null) : existing.notes,
      },
    });

    await this.auditService.log({
      userId: actor.id,
      actorName: actor.fullName,
      action: 'CONTRACT_UPDATED',
      entityType: 'Contract',
      entityId: id,
      newValue: `${existing.contractCode} — Cập nhật thông tin hợp đồng`,
    });

    return this.findOne(id);
  }

  async remove(id: string, actor: AuthUser) {
    const existing = await this.prisma.contract.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Không tìm thấy hợp đồng.');
    await this.prisma.contract.delete({ where: { id } });
    await this.auditService.log({
      userId: actor.id,
      actorName: actor.fullName,
      action: 'CONTRACT_DELETED',
      entityType: 'Contract',
      entityId: id,
      oldValue: `${existing.contractCode} — ${existing.title}`,
    });
    return { deleted: true };
  }

  async uploadDocument(
    contractId: string,
    file: Express.Multer.File,
    docType: string,
    notes: string,
    actor: AuthUser,
  ) {
    if (!file) throw new BadRequestException('Vui lòng chọn tệp đính kèm.');
    const rec = await this.prisma.contract.findUnique({ where: { id: contractId } });
    if (!rec) throw new NotFoundException('Không tìm thấy hợp đồng.');

    fs.mkdirSync(CONTRACT_UPLOAD_DIR, { recursive: true });
    const ext = path.extname(file.originalname || '').slice(0, 12);
    const storedName = `${contractId}-${crypto.randomUUID()}${ext}`;
    fs.writeFileSync(path.join(CONTRACT_UPLOAD_DIR, storedName), file.buffer);
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');

    return this.prisma.contractDocument.create({
      data: {
        contractId,
        docType: docType || 'CONTRACT',
        originalName,
        storedName,
        mimeType: file.mimetype || 'application/octet-stream',
        sizeBytes: file.size || file.buffer.length,
        notes: notes?.trim() || null,
        uploadedBy: actor.fullName,
      },
    });
  }

  async getDocumentForDownload(docId: string) {
    const doc = await this.prisma.contractDocument.findUnique({ where: { id: docId } });
    if (!doc) throw new NotFoundException('Không tìm thấy tệp chứng từ.');
    const fullPath = path.join(CONTRACT_UPLOAD_DIR, doc.storedName);
    if (!fs.existsSync(fullPath)) throw new NotFoundException('Tệp chứng từ không tồn tại trên máy chủ.');
    return { doc, fullPath };
  }

  async deleteDocument(contractId: string, docId: string) {
    const doc = await this.prisma.contractDocument.findFirst({ where: { id: docId, contractId } });
    if (!doc) throw new NotFoundException('Không tìm thấy tệp chứng từ.');
    const fullPath = path.join(CONTRACT_UPLOAD_DIR, doc.storedName);
    if (fs.existsSync(fullPath)) {
      try {
        fs.unlinkSync(fullPath);
      } catch {
        // ignore
      }
    }
    await this.prisma.contractDocument.delete({ where: { id: docId } });
    return { deleted: true };
  }
}

@ApiTags('Contracts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('api/v1/contracts')
export class ContractsController {
  constructor(private readonly service: ContractsService) {}

  @Get()
  @RequirePermissions('assets.read')
  list(@Query() query: any) {
    return this.service.list(query);
  }

  @Post()
  @RequirePermissions('assets.create')
  create(@Body() body: any, @CurrentUser() user: AuthUser) {
    return this.service.create(body, user);
  }

  @Get('documents/:docId/download')
  @RequirePermissions('assets.read')
  async downloadDoc(@Param('docId') docId: string, @Res() res: Response) {
    const { doc, fullPath } = await this.service.getDocumentForDownload(docId);
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.originalName)}"`);
    return res.sendFile(fullPath);
  }

  @Get(':id')
  @RequirePermissions('assets.read')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('assets.update')
  update(@Param('id') id: string, @Body() body: any, @CurrentUser() user: AuthUser) {
    return this.service.update(id, body, user);
  }

  @Delete(':id')
  @RequirePermissions('assets.delete')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.remove(id, user);
  }

  @Post(':id/documents')
  @RequirePermissions('assets.documents')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 },
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

  @Delete(':id/documents/:docId')
  @RequirePermissions('assets.documents')
  deleteDoc(@Param('id') id: string, @Param('docId') docId: string) {
    return this.service.deleteDocument(id, docId);
  }
}

@Module({
  providers: [ContractsService],
  controllers: [ContractsController],
})
export class ContractsModule {}
