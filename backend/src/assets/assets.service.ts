import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser, buildAssetScopeWhere } from '../auth/guards';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.ms-excel',
]);
const ALLOWED_EXTS = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.docx', '.xlsx', '.doc', '.xls']);

@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * SRS 7.3: Generate unique asset code transactionally according to SystemSettings pattern.
   */
  async generateAssetCodeTx(tx: any, assetTypeId: string): Promise<string> {
    const assetType = await tx.assetType.findUnique({ where: { id: assetTypeId } });
    if (!assetType) throw new BadRequestException('Loại tài sản không hợp lệ.');

    const patternSetting = await tx.systemSetting.findUnique({ where: { key: 'asset_code.pattern' } });
    const padSetting = await tx.systemSetting.findUnique({ where: { key: 'asset_code.seq_padding' } });

    const pattern = patternSetting?.value || 'IT-{TYPE}-{YEAR}-{SEQ}';
    const padding = Number(padSetting?.value) || 4;
    const year = String(new Date().getFullYear());
    const prefixKey = pattern.replace('{TYPE}', assetType.code).replace('{YEAR}', year).replace('-{SEQ}', '').replace('{SEQ}', '');

    for (let attempt = 0; attempt < 20; attempt++) {
      const seq = await tx.assetCodeSequence.upsert({
        where: { prefixKey },
        update: { lastNumber: { increment: 1 } },
        create: { prefixKey, lastNumber: 1 },
      });
      const numStr = String(seq.lastNumber).padStart(padding, '0');
      const candidate = pattern
        .replace('{TYPE}', assetType.code)
        .replace('{YEAR}', year)
        .replace('{SEQ}', numStr);
      const exists = await tx.asset.findUnique({ where: { assetCode: candidate } });
      if (!exists) return candidate;
    }
    throw new ConflictException('Không thể sinh mã tài sản duy nhất, vui lòng thử lại.');
  }

  async previewNextCode(assetTypeId: string) {
    const assetType = await this.prisma.assetType.findUnique({ where: { id: assetTypeId } });
    if (!assetType) throw new BadRequestException('Loại tài sản không hợp lệ.');
    const patternSetting = await this.prisma.systemSetting.findUnique({ where: { key: 'asset_code.pattern' } });
    const padSetting = await this.prisma.systemSetting.findUnique({ where: { key: 'asset_code.seq_padding' } });
    const pattern = patternSetting?.value || 'IT-{TYPE}-{YEAR}-{SEQ}';
    const padding = Number(padSetting?.value) || 4;
    const year = String(new Date().getFullYear());
    const prefixKey = pattern.replace('{TYPE}', assetType.code).replace('{YEAR}', year).replace('-{SEQ}', '').replace('{SEQ}', '');
    const seq = await this.prisma.assetCodeSequence.findUnique({ where: { prefixKey } });
    const nextNum = (seq?.lastNumber || 0) + 1;
    const preview = pattern
      .replace('{TYPE}', assetType.code)
      .replace('{YEAR}', year)
      .replace('{SEQ}', String(nextNum).padStart(padding, '0'));
    return { preview, pattern };
  }

  /**
   * SRS 7.3 B: Validate manual code (trim only, preserve exact content, reject duplicates clearly).
   */
  async resolveAssetCodeTx(tx: any, codeMode: 'AUTO' | 'MANUAL', manualCode: string | undefined, assetTypeId: string) {
    if (codeMode === 'MANUAL') {
      const trimmed = (manualCode || '').trim();
      if (!trimmed) {
        throw new BadRequestException('Vui lòng nhập mã tài sản khi chọn phương thức nhập thủ công.');
      }
      const dup = await tx.asset.findUnique({ where: { assetCode: trimmed } });
      if (dup) {
        throw new ConflictException(
          `Mã tài sản "${trimmed}" đã tồn tại trong hệ thống. Vui lòng nhập mã khác (hệ thống không tự động sửa mã thủ công).`,
        );
      }
      return { assetCode: trimmed, codeMode: 'MANUAL' };
    }
    const generated = await this.generateAssetCodeTx(tx, assetTypeId);
    return { assetCode: generated, codeMode: 'AUTO' };
  }

  async findAll(user: AuthUser, query: any) {
    const scopeWhere = buildAssetScopeWhere(user);
    const filters: any[] = [];
    if (Object.keys(scopeWhere).length > 0) filters.push(scopeWhere);

    if (query.search) {
      const s = String(query.search).trim();
      filters.push({
        OR: [
          { assetCode: { contains: s } },
          { name: { contains: s } },
          { serialNumber: { contains: s } },
          { hostname: { contains: s } },
          { assignedUserName: { contains: s } },
          { model: { contains: s } },
        ],
      });
    }
    if (query.assetTypeId) filters.push({ assetTypeId: query.assetTypeId });
    if (query.categoryId) filters.push({ categoryId: query.categoryId });
    if (query.departmentId) filters.push({ usingDepartmentId: query.departmentId });
    if (query.status) filters.push({ status: query.status });

    const where = filters.length > 0 ? { AND: filters } : {};

    const assets = await this.prisma.asset.findMany({
      where,
      include: {
        category: true,
        assetType: true,
        managingDepartment: true,
        usingDepartment: true,
        assignedEmployee: { select: { id: true, code: true, fullName: true, title: true } },
        location: true,
        purchase: { include: { supplier: true } },
        agents: {
          select: {
            id: true,
            agentUid: true,
            status: true,
            agentVersion: true,
            lastHeartbeatAt: true,
            lastIpAddress: true,
          },
        },
        _count: {
          select: {
            documents: true,
            deviceChanges: { where: { status: 'PENDING' } },
            alerts: { where: { status: { in: ['NEW', 'ACKNOWLEDGED', 'IN_PROGRESS'] } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return assets;
  }

  async findOne(id: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
      include: {
        category: true,
        assetType: true,
        managingDepartment: true,
        usingDepartment: true,
        assignedUser: { select: { id: true, fullName: true, username: true, email: true, title: true } },
        location: true,
        purchase: { include: { supplier: true } },
        documents: {
          include: { uploadedBy: { select: { fullName: true } } },
          orderBy: { uploadedAt: 'desc' },
        },
        assignments: {
          include: { department: true },
          orderBy: { handoverDate: 'desc' },
        },
        transfers: {
          include: { fromDepartment: true, toDepartment: true },
          orderBy: { transferDate: 'desc' },
        },
        maintenances: { orderBy: { receivedDate: 'desc' } },
        disposals: { orderBy: { disposalDate: 'desc' } },
        inventoryItems: {
          include: { session: true },
          orderBy: { updatedAt: 'desc' },
        },
        auditLogs: { orderBy: { createdAt: 'desc' }, take: 100 },
        agents: {
          include: {
            snapshots: {
              orderBy: { collectedAt: 'desc' },
              take: 1,
              include: {
                processors: true,
                memoryModules: true,
                disks: true,
                networkAdapters: true,
                graphics: true,
                monitors: true,
                operatingSystem: true,
                software: { orderBy: { displayName: 'asc' } },
              },
            },
          },
        },
        agentLinks: {
          include: { agent: { select: { agentUid: true, hostname: true, status: true } } },
          orderBy: { linkedAt: 'desc' },
        },
        baselines: {
          include: {
            confirmedBy: { select: { fullName: true } },
            snapshot: {
              include: {
                processors: true,
                memoryModules: true,
                disks: true,
                graphics: true,
                monitors: true,
                operatingSystem: true,
              },
            },
          },
          orderBy: { version: 'desc' },
        },
        deviceChanges: {
          include: {
            verifiedBy: { select: { fullName: true } },
          },
          orderBy: { detectedAt: 'desc' },
        },
        alerts: {
          orderBy: { detectedAt: 'desc' },
          take: 30,
        },
      },
    });
    if (!asset) throw new NotFoundException('Không tìm thấy tài sản.');
    return asset;
  }

  async create(body: any, actor: AuthUser, ipAddress?: string) {
    const assetType = await this.prisma.assetType.findUnique({ where: { id: body.assetTypeId } });
    if (!assetType) throw new BadRequestException('Loại tài sản không hợp lệ.');

    const created = await this.prisma.$transaction(async (tx) => {
      const codeMode = body.codeMode === 'MANUAL' ? 'MANUAL' : 'AUTO';
      const { assetCode } = await this.resolveAssetCodeTx(tx, codeMode, body.assetCode, body.assetTypeId);

      const asset = await tx.asset.create({
        data: {
          assetCode,
          codeMode,
          name: body.name,
          categoryId: body.categoryId || assetType.categoryId,
          assetTypeId: assetType.id,
          status: body.status || 'IN_USE',
          serialNumber: body.serialNumber || null,
          qrCodeValue: `ITAM:${assetCode}`,
          manufacturer: body.manufacturer || null,
          model: body.model || null,
          hostname: body.hostname || null,
          managingDepartmentId: body.managingDepartmentId || null,
          usingDepartmentId: body.usingDepartmentId || null,
          assignedUserId: body.assignedUserId || null,
          assignedEmployeeId: body.assignedEmployeeId || null,
          assignedUserName: body.assignedUserName || null,
          locationId: body.locationId || null,
          locationDetail: body.locationDetail || null,
          handoverDate: body.handoverDate ? new Date(body.handoverDate) : null,
          handoverBy: body.handoverBy || actor.fullName,
          receivedBy: body.receivedBy || body.assignedUserName || null,
          notes: body.notes || null,
          approvedById: actor.id,
          approvedAt: new Date(),
          createdById: actor.id,
        },
      });

      if (body.purchase) {
        await tx.assetPurchase.create({
          data: {
            assetId: asset.id,
            purchaseDate: body.purchase.purchaseDate ? new Date(body.purchase.purchaseDate) : null,
            inUseDate: body.purchase.inUseDate ? new Date(body.purchase.inUseDate) : null,
            supplierId: body.purchase.supplierId || null,
            contractNumber: body.purchase.contractNumber || null,
            invoiceNumber: body.purchase.invoiceNumber || null,
            purchasePrice: body.purchase.purchasePrice ? Number(body.purchase.purchasePrice) : null,
            fundingSource: body.purchase.fundingSource || null,
            warrantyStartDate: body.purchase.warrantyStartDate ? new Date(body.purchase.warrantyStartDate) : null,
            warrantyEndDate: body.purchase.warrantyEndDate ? new Date(body.purchase.warrantyEndDate) : null,
            notes: body.purchase.notes || null,
          },
        });
      }

      if (body.assignedUserName || body.usingDepartmentId) {
        await tx.assetAssignment.create({
          data: {
            assetId: asset.id,
            assignmentCode: `BG-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`,
            departmentId: body.usingDepartmentId || null,
            assigneeName: body.assignedUserName || 'Phòng ban sử dụng',
            assigneeUserId: body.assignedUserId || null,
            handoverBy: body.handoverBy || actor.fullName,
            receivedBy: body.receivedBy || body.assignedUserName || 'Đại diện phòng ban',
            locationDetail: body.locationDetail || null,
            handoverDate: body.handoverDate ? new Date(body.handoverDate) : new Date(),
          },
        });
      }

      return asset;
    });

    await this.auditService.logAsset({
      assetId: created.id,
      action: 'CREATED',
      newValue: `${created.assetCode} (${created.codeMode}) - ${created.name}`,
      actorId: actor.id,
      actorName: actor.fullName,
      ipAddress,
    });

    return this.findOne(created.id);
  }

  async update(id: string, body: any, actor: AuthUser, ipAddress?: string) {
    const existing = await this.prisma.asset.findUnique({ where: { id }, include: { purchase: true } });
    if (!existing) throw new NotFoundException('Không tìm thấy tài sản.');

    // SRS 7.3: Never allow silent assetCode overwrite through normal update!
    const updateData: any = {};
    const fields = [
      'name', 'status', 'serialNumber', 'manufacturer', 'model', 'hostname',
      'managingDepartmentId', 'locationId', 'locationDetail', 'notes',
    ];
    for (const f of fields) {
      if (body[f] !== undefined) updateData[f] = body[f] === '' ? null : body[f];
    }

    await this.prisma.asset.update({ where: { id }, data: updateData });

    if (body.purchase) {
      const p = body.purchase;
      const pData = {
        purchaseDate: p.purchaseDate ? new Date(p.purchaseDate) : null,
        inUseDate: p.inUseDate ? new Date(p.inUseDate) : null,
        supplierId: p.supplierId || null,
        contractNumber: p.contractNumber || null,
        invoiceNumber: p.invoiceNumber || null,
        purchasePrice: p.purchasePrice !== undefined && p.purchasePrice !== '' ? Number(p.purchasePrice) : null,
        fundingSource: p.fundingSource || null,
        warrantyStartDate: p.warrantyStartDate ? new Date(p.warrantyStartDate) : null,
        warrantyEndDate: p.warrantyEndDate ? new Date(p.warrantyEndDate) : null,
        notes: p.notes || null,
      };
      await this.prisma.assetPurchase.upsert({
        where: { assetId: id },
        update: pData,
        create: { assetId: id, ...pData },
      });
    }

    await this.auditService.logAsset({
      assetId: id,
      action: 'UPDATED',
      oldValue: { name: existing.name, status: existing.status, serialNumber: existing.serialNumber },
      newValue: updateData,
      reason: body.reason || 'Cập nhật thông tin tài sản',
      actorId: actor.id,
      actorName: actor.fullName,
      ipAddress,
    });

    return this.findOne(id);
  }

  /**
   * SRS 7.3: Audited asset code adjustment requiring permission + reason + audit log.
   */
  async updateAssetCode(id: string, newCodeRaw: string, reason: string, actor: AuthUser, ipAddress?: string) {
    const newCode = (newCodeRaw || '').trim();
    if (!newCode) throw new BadRequestException('Mã tài sản mới không được để trống.');
    if (!reason || !reason.trim()) {
      throw new BadRequestException('Bắt buộc nhập lý do khi điều chỉnh mã tài sản chính thức.');
    }

    const existing = await this.prisma.asset.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Không tìm thấy tài sản.');
    if (existing.assetCode === newCode) return existing;

    const dup = await this.prisma.asset.findUnique({ where: { assetCode: newCode } });
    if (dup) {
      throw new ConflictException(`Mã tài sản "${newCode}" đã tồn tại. Vui lòng nhập mã khác.`);
    }

    const updated = await this.prisma.asset.update({
      where: { id },
      data: { assetCode: newCode, qrCodeValue: `ITAM:${newCode}`, codeMode: 'MANUAL' },
    });

    await this.auditService.logAsset({
      assetId: id,
      action: 'CODE_CHANGED',
      fieldName: 'assetCode',
      oldValue: existing.assetCode,
      newValue: newCode,
      reason: reason.trim(),
      actorId: actor.id,
      actorName: actor.fullName,
      ipAddress,
    });

    return updated;
  }

  async uploadDocument(assetId: string, file: Express.Multer.File, docType: string, notes: string, actor: AuthUser) {
    const asset = await this.prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) throw new NotFoundException('Không tìm thấy tài sản.');
    if (!file) throw new BadRequestException('Chưa chọn tập tin tải lên.');

    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTS.has(ext) || !ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Định dạng file không được phép. Chỉ hỗ trợ PDF, PNG, JPG, WEBP, DOC/DOCX, XLS/XLSX.');
    }

    // SRS 12: Never use user-supplied filename as storage path! Always UUID.
    const uploadDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'storage/uploads');
    fs.mkdirSync(uploadDir, { recursive: true });
    const storedName = `${uuidv4()}${ext}`;
    const fullPath = path.join(uploadDir, storedName);
    fs.writeFileSync(fullPath, file.buffer);

    const doc = await this.prisma.assetDocument.create({
      data: {
        assetId,
        docType: docType || 'OTHER',
        originalName: file.originalname,
        storedName,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        storagePath: path.join('storage', 'uploads', storedName),
        notes: notes || null,
        uploadedById: actor.id,
      },
      include: { uploadedBy: { select: { fullName: true } } },
    });

    await this.auditService.logAsset({
      assetId,
      action: 'DOCUMENT_UPLOADED',
      newValue: `${doc.docType}: ${doc.originalName} (${doc.sizeBytes} bytes)`,
      actorId: actor.id,
      actorName: actor.fullName,
    });

    return doc;
  }

  async getDocumentForDownload(docId: string) {
    const doc = await this.prisma.assetDocument.findUnique({ where: { id: docId } });
    if (!doc) throw new NotFoundException('Không tìm thấy hồ sơ đính kèm.');
    const fullPath = path.resolve(process.cwd(), doc.storagePath);
    if (!fs.existsSync(fullPath)) throw new NotFoundException('Tệp vật lý không còn tồn tại trên máy chủ.');
    return { doc, fullPath };
  }

  async deleteDocument(docId: string, actor: AuthUser) {
    const doc = await this.prisma.assetDocument.findUnique({ where: { id: docId } });
    if (!doc) throw new NotFoundException('Không tìm thấy hồ sơ.');
    const fullPath = path.resolve(process.cwd(), doc.storagePath);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    await this.prisma.assetDocument.delete({ where: { id: docId } });
    await this.auditService.logAsset({
      assetId: doc.assetId,
      action: 'DOCUMENT_DELETED',
      oldValue: `${doc.docType}: ${doc.originalName}`,
      actorId: actor.id,
      actorName: actor.fullName,
    });
    return { deleted: true };
  }

  async findPublicByCode(codeRaw: string) {
    const code = decodeURIComponent(codeRaw || '').trim();
    if (!code) throw new NotFoundException('Không tìm thấy tài sản.');
    const asset = await this.prisma.asset.findFirst({
      where: {
        OR: [{ assetCode: code }, { id: code }],
      },
      select: {
        id: true,
        assetCode: true,
        name: true,
        status: true,
        serialNumber: true,
        manufacturer: true,
        model: true,
        hostname: true,
        assignedUserName: true,
        locationDetail: true,
        handoverDate: true,
        category: { select: { code: true, name: true } },
        assetType: { select: { code: true, name: true } },
        usingDepartment: { select: { code: true, name: true } },
        assignedEmployee: { select: { code: true, fullName: true, title: true } },
        location: { select: { name: true, building: true, floor: true, room: true } },
        purchase: { select: { purchaseDate: true, warrantyStartDate: true, warrantyEndDate: true } },
      },
    });
    if (!asset) throw new NotFoundException('Không tìm thấy thông tin tài sản cho mã QR này.');
    const [statusCatalog, qrSettings] = await Promise.all([
      this.prisma.assetStatusCatalog.findUnique({
        where: { code: asset.status },
        select: { code: true, name: true, bgColor: true, textColor: true },
      }),
      this.prisma.systemSetting.findMany({ where: { group: 'QR_LABEL' } }),
    ]);
    const qrMap: Record<string, string> = {};
    for (const s of qrSettings) qrMap[s.key] = s.value;
    return {
      ...asset,
      statusCatalog,
      qrConfig: {
        labelTitle: qrMap['qr.label_title'] ?? 'TÀI SẢN CNTT',
        sizePx: Number(qrMap['qr.size_px']) || 180,
        fields: (qrMap['qr.fields'] || 'assetCode,name,serialNumber,department,employee')
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean),
      },
    };
  }

  async getQrCode(id: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
      select: { id: true, assetCode: true, name: true, serialNumber: true, qrCodeValue: true },
    });
    if (!asset) throw new NotFoundException('Không tìm thấy tài sản.');
    const value = asset.qrCodeValue || `ITAM:${asset.assetCode}`;
    const dataUrl = await QRCode.toDataURL(value, { width: 260, margin: 2 });
    return { ...asset, qrCodeValue: value, dataUrl };
  }
}
