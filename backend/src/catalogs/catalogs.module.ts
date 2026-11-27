import { Module, Injectable, Controller, Get, Post, Patch, Delete, Param, Body, Query, Res, UseGuards, UseInterceptors, UploadedFile, BadRequestException, ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { memoryStorage } from 'multer';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { JwtAuthGuard, PermissionsGuard, RequirePermissions, CurrentUser, AuthUser } from '../auth/guards';

const ALLOWED_LOGO_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg']);
const ALLOWED_LOGO_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);

const DEFAULT_ASSET_STATUSES = [
  { code: 'IN_USE', name: 'Đang sử dụng', bgColor: '#ECFDF5', textColor: '#047857', description: 'Tài sản đang được bàn giao và sử dụng', sortOrder: 1 },
  { code: 'UNALLOCATED', name: 'Chưa phân bổ', bgColor: '#F0F9FF', textColor: '#0369A1', description: 'Tài sản đang lưu kho, sẵn sàng cấp phát', sortOrder: 2 },
  { code: 'MAINTENANCE', name: 'Đang sửa chữa', bgColor: '#FFFBEB', textColor: '#B45309', description: 'Tài sản đang trong quá trình bảo trì, sửa chữa', sortOrder: 3 },
  { code: 'BROKEN', name: 'Hư hỏng', bgColor: '#FEF2F2', textColor: '#B91C1C', description: 'Tài sản hư hỏng, không thể sử dụng', sortOrder: 4 },
  { code: 'DISPOSED', name: 'Đã thanh lý', bgColor: '#F1F5F9', textColor: '#475569', description: 'Tài sản đã hoàn tất thủ tục thanh lý', sortOrder: 5 },
  { code: 'LOST', name: 'Thất lạc', bgColor: '#FFF1F2', textColor: '#BE123C', description: 'Tài sản không tìm thấy khi kiểm kê', sortOrder: 6 },
];

@Injectable()
export class CatalogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async ensureDefaultAssetStatuses() {
    const count = await this.prisma.assetStatusCatalog.count();
    if (count === 0) {
      for (const item of DEFAULT_ASSET_STATUSES) {
        await this.prisma.assetStatusCatalog.upsert({
          where: { code: item.code },
          update: {},
          create: { ...item, isActive: true },
        });
      }
    }
  }

  async ensureDefaultSystemSettings() {
    const defaults = [
      {
        key: 'discovery.lan_scan_enabled',
        value: 'false',
        group: 'DISCOVERY',
        description: 'Bật/tắt tính năng quét dải IP mạng LAN (chỉ bật khi triển khai máy chủ trong mạng nội bộ công ty)',
      },
      {
        key: 'qr.label_title',
        value: 'TÀI SẢN CNTT',
        group: 'QR_LABEL',
        description: 'Tiêu đề hoặc tên công ty/đơn vị hiển thị ở đầu tem mã QR',
      },
      {
        key: 'qr.size_px',
        value: '180',
        group: 'QR_LABEL',
        description: 'Kích thước mã QR (px) khi in tem nhãn tài sản',
      },
      {
        key: 'qr.fields',
        value: 'assetCode,name,serialNumber,department,employee',
        group: 'QR_LABEL',
        description: 'Các trường thông tin hiển thị trên tem mã QR và thẻ tra cứu nhanh',
      },
      {
        key: 'org.name',
        value: '',
        group: 'ORG_INFO',
        description: 'Tên đầy đủ của công ty / đơn vị sử dụng hệ thống',
      },
      {
        key: 'org.address',
        value: '',
        group: 'ORG_INFO',
        description: 'Địa chỉ trụ sở đơn vị hiển thị trên các biên bản',
      },
      {
        key: 'org.tax_code',
        value: '',
        group: 'ORG_INFO',
        description: 'Mã số thuế của đơn vị',
      },
      {
        key: 'org.logo_url',
        value: '',
        group: 'ORG_INFO',
        description: 'Logo đơn vị (tải ảnh PNG/JPG/SVG hoặc nhập đường dẫn ảnh)',
      },
      {
        key: 'doc.department_subtitle',
        value: 'Phòng Công nghệ Thông tin',
        group: 'DOCUMENT_TEMPLATE',
        description: 'Tên phòng phụ trách hiển thị bên dưới tên đơn vị trên biên bản',
      },
      {
        key: 'doc.header_fields',
        value: 'logo,name,address,taxCode,departmentSubtitle,nationalMotto',
        group: 'DOCUMENT_TEMPLATE',
        description: 'Chọn các thông tin đơn vị sẽ hiển thị ở phần đầu của các biên bản bàn giao / điều chuyển / thu hồi',
      },
    ];
    for (const item of defaults) {
      await this.prisma.systemSetting.upsert({
        where: { key: item.key },
        update: {},
        create: item,
      });
    }
  }

  async getAllMeta() {
    await Promise.all([this.ensureDefaultAssetStatuses(), this.ensureDefaultSystemSettings()]);
    const [departments, locations, categories, assetTypes, assetStatuses, suppliers, roles, permissions, users, employees, lanScanSetting, qrSettings] = await Promise.all([
      this.prisma.department.findMany({
        where: { isActive: true },
        include: {
          location: true,
          _count: { select: { users: true, employees: true, usingAssets: true } },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.location.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
      this.prisma.assetCategory.findMany({
        where: { isActive: true },
        include: { _count: { select: { types: true, assets: true } } },
        orderBy: { name: 'asc' },
      }),
      this.prisma.assetType.findMany({ where: { isActive: true }, include: { category: true }, orderBy: { name: 'asc' } }),
      this.prisma.assetStatusCatalog.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
      this.prisma.supplier.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
      this.prisma.role.findMany({
        include: {
          permissions: { include: { permission: true } },
          _count: { select: { userRoles: true } },
        },
        orderBy: { code: 'asc' },
      }),
      this.prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { code: 'asc' }] }),
      this.prisma.user.findMany({
        where: { isActive: true },
        select: {
          id: true,
          username: true,
          fullName: true,
          email: true,
          title: true,
          departmentId: true,
          employeeId: true,
        },
        orderBy: { fullName: 'asc' },
      }),
      this.prisma.employee.findMany({
        where: { isActive: true },
        select: {
          id: true,
          code: true,
          fullName: true,
          email: true,
          phone: true,
          title: true,
          departmentId: true,
          department: {
            select: {
              id: true,
              code: true,
              name: true,
              locationId: true,
              location: { select: { id: true, code: true, name: true, building: true, floor: true, room: true } },
            },
          },
        },
        orderBy: { fullName: 'asc' },
      }),
      this.prisma.systemSetting.findUnique({ where: { key: 'discovery.lan_scan_enabled' } }),
      this.prisma.systemSetting.findMany({
        where: { group: { in: ['QR_LABEL', 'ORG_INFO', 'DOCUMENT_TEMPLATE'] } },
      }),
    ]);
    const cfgMap: Record<string, string> = {};
    for (const s of qrSettings) cfgMap[s.key] = s.value;
    return {
      departments,
      locations,
      categories,
      assetTypes,
      assetStatuses,
      suppliers,
      roles,
      permissions,
      users,
      employees,
      features: {
        lanScanEnabled: lanScanSetting?.value === 'true',
      },
      qrConfig: {
        labelTitle: cfgMap['qr.label_title'] ?? 'TÀI SẢN CNTT',
        sizePx: Number(cfgMap['qr.size_px']) || 180,
        fields: (cfgMap['qr.fields'] || 'assetCode,name,serialNumber,department,employee')
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean),
      },
      orgInfo: {
        name: cfgMap['org.name'] || '',
        address: cfgMap['org.address'] || '',
        taxCode: cfgMap['org.tax_code'] || '',
        logoUrl: cfgMap['org.logo_url'] || '',
      },
      docTemplate: {
        departmentSubtitle: cfgMap['doc.department_subtitle'] ?? 'Phòng Công nghệ Thông tin',
        headerFields: (cfgMap['doc.header_fields'] || 'logo,name,address,taxCode,departmentSubtitle,nationalMotto')
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean),
      },
    };
  }

  // Employees (Danh mục Nhân viên)
  async listEmployees() {
    return this.prisma.employee.findMany({
      include: {
        department: true,
        users: { select: { id: true, username: true, isActive: true } },
        _count: { select: { assets: true, users: true } },
      },
      orderBy: [{ isActive: 'desc' }, { fullName: 'asc' }],
    });
  }

  async createEmployee(data: any, actor: AuthUser) {
    const code = (data.code || '').trim().toUpperCase();
    const fullName = (data.fullName || '').trim();
    if (!code || !fullName) {
      throw new BadRequestException('Vui lòng nhập đầy đủ mã nhân viên và họ tên.');
    }
    const dup = await this.prisma.employee.findUnique({ where: { code } });
    if (dup) throw new ConflictException(`Mã nhân viên "${code}" đã tồn tại.`);

    const created = await this.prisma.employee.create({
      data: {
        code,
        fullName,
        email: data.email?.trim() || null,
        phone: data.phone?.trim() || null,
        title: data.title?.trim() || null,
        departmentId: data.departmentId || null,
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
      },
      include: { department: true },
    });
    await this.auditService.log({
      userId: actor.id,
      actorName: actor.fullName,
      action: 'EMPLOYEE_CREATED',
      entityType: 'Employee',
      entityId: created.id,
      newValue: `${created.code} - ${created.fullName}`,
    });
    return created;
  }

  async updateEmployee(id: string, data: any, actor: AuthUser) {
    const existing = await this.prisma.employee.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Không tìm thấy nhân viên.');

    const code = data.code !== undefined ? String(data.code).trim().toUpperCase() : existing.code;
    const fullName = data.fullName !== undefined ? String(data.fullName).trim() : existing.fullName;
    if (!code || !fullName) {
      throw new BadRequestException('Mã nhân viên và họ tên không được để trống.');
    }
    if (code !== existing.code) {
      const dup = await this.prisma.employee.findUnique({ where: { code } });
      if (dup) throw new ConflictException(`Mã nhân viên "${code}" đã tồn tại.`);
    }

    const updated = await this.prisma.employee.update({
      where: { id },
      data: {
        code,
        fullName,
        email: data.email !== undefined ? data.email?.trim() || null : existing.email,
        phone: data.phone !== undefined ? data.phone?.trim() || null : existing.phone,
        title: data.title !== undefined ? data.title?.trim() || null : existing.title,
        departmentId: data.departmentId !== undefined ? data.departmentId || null : existing.departmentId,
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : existing.isActive,
      },
      include: { department: true },
    });
    await this.auditService.log({
      userId: actor.id,
      actorName: actor.fullName,
      action: 'EMPLOYEE_UPDATED',
      entityType: 'Employee',
      entityId: id,
      oldValue: `${existing.code} - ${existing.fullName}`,
      newValue: `${updated.code} - ${updated.fullName}`,
    });
    return updated;
  }

  async toggleEmployeeActive(id: string, isActive: boolean, actor: AuthUser) {
    const existing = await this.prisma.employee.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Không tìm thấy nhân viên.');
    const updated = await this.prisma.employee.update({
      where: { id },
      data: { isActive: Boolean(isActive) },
    });
    await this.auditService.log({
      userId: actor.id,
      actorName: actor.fullName,
      action: isActive ? 'EMPLOYEE_ACTIVATED' : 'EMPLOYEE_DEACTIVATED',
      entityType: 'Employee',
      entityId: id,
      newValue: `${updated.code} - ${updated.fullName}`,
    });
    return updated;
  }

  async deleteEmployee(id: string, actor: AuthUser) {
    const existing = await this.prisma.employee.findUnique({
      where: { id },
      include: { _count: { select: { assets: true, users: true } } },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy nhân viên.');
    if (existing._count.assets > 0 || existing._count.users > 0) {
      throw new BadRequestException(
        `Không thể xóa nhân viên "${existing.fullName}" vì đang liên kết với ${existing._count.assets} tài sản và ${existing._count.users} tài khoản người dùng. Hãy gạt sang trạng thái Ngưng hoạt động.`,
      );
    }
    await this.prisma.employee.delete({ where: { id } });
    await this.auditService.log({
      userId: actor.id,
      actorName: actor.fullName,
      action: 'EMPLOYEE_DELETED',
      entityType: 'Employee',
      entityId: id,
      oldValue: `${existing.code} - ${existing.fullName}`,
    });
    return { deleted: true };
  }

  // Asset Statuses (Danh mục Trạng thái tài sản)
  async listAssetStatuses() {
    await this.ensureDefaultAssetStatuses();
    const [statuses, grouped] = await Promise.all([
      this.prisma.assetStatusCatalog.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }),
      this.prisma.asset.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);
    const countMap = new Map<string, number>();
    for (const g of grouped) {
      countMap.set(g.status, g._count._all);
    }
    return statuses.map((s) => ({ ...s, assetCount: countMap.get(s.code) || 0 }));
  }

  async createAssetStatus(data: any, actor: AuthUser) {
    const code = (data.code || '').trim().toUpperCase().replace(/\s+/g, '_');
    const name = (data.name || '').trim();
    if (!code || !name) {
      throw new BadRequestException('Vui lòng nhập đầy đủ mã và tên trạng thái tài sản.');
    }
    const existing = await this.prisma.assetStatusCatalog.findUnique({ where: { code } });
    if (existing) {
      throw new ConflictException(`Mã trạng thái "${code}" đã tồn tại.`);
    }
    const maxOrder = await this.prisma.assetStatusCatalog.aggregate({ _max: { sortOrder: true } });
    const created = await this.prisma.assetStatusCatalog.create({
      data: {
        code,
        name,
        bgColor: (data.bgColor || '#ECFDF5').trim(),
        textColor: (data.textColor || '#047857').trim(),
        description: data.description?.trim() || null,
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
        sortOrder: data.sortOrder !== undefined ? Number(data.sortOrder) : (maxOrder._max.sortOrder || 0) + 1,
      },
    });
    await this.auditService.log({
      userId: actor.id,
      actorName: actor.fullName,
      action: 'ASSET_STATUS_CREATED',
      entityType: 'AssetStatusCatalog',
      entityId: created.id,
      newValue: `${created.code} - ${created.name}`,
    });
    return created;
  }

  async updateAssetStatus(id: string, data: any, actor: AuthUser) {
    const existing = await this.prisma.assetStatusCatalog.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Không tìm thấy trạng thái tài sản.');

    const code = data.code !== undefined ? String(data.code).trim().toUpperCase().replace(/\s+/g, '_') : existing.code;
    const name = data.name !== undefined ? String(data.name).trim() : existing.name;
    if (!code || !name) {
      throw new BadRequestException('Mã và tên trạng thái tài sản không được để trống.');
    }
    if (code !== existing.code) {
      const dup = await this.prisma.assetStatusCatalog.findUnique({ where: { code } });
      if (dup) throw new ConflictException(`Mã trạng thái "${code}" đã tồn tại.`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const rec = await tx.assetStatusCatalog.update({
        where: { id },
        data: {
          code,
          name,
          bgColor: data.bgColor !== undefined ? String(data.bgColor).trim() : existing.bgColor,
          textColor: data.textColor !== undefined ? String(data.textColor).trim() : existing.textColor,
          description: data.description !== undefined ? data.description?.trim() || null : existing.description,
          isActive: data.isActive !== undefined ? Boolean(data.isActive) : existing.isActive,
          sortOrder: data.sortOrder !== undefined ? Number(data.sortOrder) : existing.sortOrder,
        },
      });
      if (code !== existing.code) {
        await tx.asset.updateMany({
          where: { status: existing.code },
          data: { status: code },
        });
      }
      return rec;
    });

    await this.auditService.log({
      userId: actor.id,
      actorName: actor.fullName,
      action: 'ASSET_STATUS_UPDATED',
      entityType: 'AssetStatusCatalog',
      entityId: id,
      oldValue: `${existing.code} - ${existing.name}`,
      newValue: `${updated.code} - ${updated.name}`,
    });
    return updated;
  }

  async toggleAssetStatusActive(id: string, isActive: boolean, actor: AuthUser) {
    const existing = await this.prisma.assetStatusCatalog.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Không tìm thấy trạng thái tài sản.');
    const updated = await this.prisma.assetStatusCatalog.update({
      where: { id },
      data: { isActive: Boolean(isActive) },
    });
    await this.auditService.log({
      userId: actor.id,
      actorName: actor.fullName,
      action: isActive ? 'ASSET_STATUS_ACTIVATED' : 'ASSET_STATUS_DEACTIVATED',
      entityType: 'AssetStatusCatalog',
      entityId: id,
      newValue: `${updated.code} (${isActive ? 'Kích hoạt' : 'Ngưng sử dụng'})`,
    });
    return updated;
  }

  async deleteAssetStatus(id: string, actor: AuthUser) {
    const existing = await this.prisma.assetStatusCatalog.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Không tìm thấy trạng thái tài sản.');
    const assetCount = await this.prisma.asset.count({ where: { status: existing.code } });
    if (assetCount > 0) {
      throw new BadRequestException(
        `Không thể xóa trạng thái "${existing.name}" vì đang có ${assetCount} tài sản sử dụng. Hãy gạt tắt sang "Ngưng sử dụng" thay vì xóa.`,
      );
    }
    await this.prisma.assetStatusCatalog.delete({ where: { id } });
    await this.auditService.log({
      userId: actor.id,
      actorName: actor.fullName,
      action: 'ASSET_STATUS_DELETED',
      entityType: 'AssetStatusCatalog',
      entityId: id,
      oldValue: `${existing.code} - ${existing.name}`,
    });
    return { deleted: true };
  }

  // Departments
  createDepartment(data: any) {
    return this.prisma.department.create({
      data: {
        code: data.code.trim().toUpperCase(),
        name: data.name.trim(),
        description: data.description || null,
        locationId: data.locationId || null,
      },
      include: { location: true },
    });
  }
  async updateDepartment(id: string, data: any) {
    const existing = await this.prisma.department.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Không tìm thấy phòng ban.');
    const code = (data.code ?? existing.code).trim().toUpperCase();
    const name = (data.name ?? existing.name).trim();
    if (!code || !name) throw new BadRequestException('Mã và tên phòng ban không được để trống.');
    return this.prisma.department.update({
      where: { id },
      data: {
        code,
        name,
        description: data.description !== undefined ? data.description?.trim() || null : existing.description,
        locationId: data.locationId !== undefined ? (data.locationId || null) : existing.locationId,
      },
      include: { location: true },
    });
  }
  deleteDepartment(id: string) {
    return this.prisma.department.update({ where: { id }, data: { isActive: false } });
  }

  // Locations
  createLocation(data: any) {
    return this.prisma.location.create({ data: { code: data.code.trim(), name: data.name.trim(), building: data.building || null, floor: data.floor || null, room: data.room || null } });
  }
  deleteLocation(id: string) {
    return this.prisma.location.update({ where: { id }, data: { isActive: false } });
  }

  // Asset Categories (Nhóm tài sản)
  async createAssetCategory(data: any, actor: AuthUser) {
    const code = (data.code || '').trim().toUpperCase();
    const name = (data.name || '').trim();
    if (!code || !name) {
      throw new BadRequestException('Vui lòng nhập đầy đủ mã và tên nhóm tài sản.');
    }
    const existing = await this.prisma.assetCategory.findUnique({ where: { code } });
    if (existing) {
      if (!existing.isActive) {
        const restored = await this.prisma.assetCategory.update({
          where: { id: existing.id },
          data: { name, description: data.description?.trim() || null, isActive: true },
        });
        await this.auditService.log({
          userId: actor.id,
          actorName: actor.fullName,
          action: 'ASSET_CATEGORY_CREATED',
          entityType: 'AssetCategory',
          entityId: restored.id,
          newValue: `${restored.code} - ${restored.name}`,
        });
        return restored;
      }
      throw new ConflictException(`Mã nhóm tài sản "${code}" đã tồn tại.`);
    }
    const created = await this.prisma.assetCategory.create({
      data: { code, name, description: data.description?.trim() || null },
    });
    await this.auditService.log({
      userId: actor.id,
      actorName: actor.fullName,
      action: 'ASSET_CATEGORY_CREATED',
      entityType: 'AssetCategory',
      entityId: created.id,
      newValue: `${created.code} - ${created.name}`,
    });
    return created;
  }

  async updateAssetCategory(id: string, data: any, actor: AuthUser) {
    const existing = await this.prisma.assetCategory.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Không tìm thấy nhóm tài sản.');
    const code = (data.code ?? existing.code).trim().toUpperCase();
    const name = (data.name ?? existing.name).trim();
    if (!code || !name) {
      throw new BadRequestException('Mã và tên nhóm tài sản không được để trống.');
    }
    if (code !== existing.code) {
      const dup = await this.prisma.assetCategory.findUnique({ where: { code } });
      if (dup) throw new ConflictException(`Mã nhóm tài sản "${code}" đã tồn tại.`);
    }
    const updated = await this.prisma.assetCategory.update({
      where: { id },
      data: { code, name, description: data.description !== undefined ? data.description?.trim() || null : existing.description },
    });
    await this.auditService.log({
      userId: actor.id,
      actorName: actor.fullName,
      action: 'ASSET_CATEGORY_UPDATED',
      entityType: 'AssetCategory',
      entityId: id,
      oldValue: `${existing.code} - ${existing.name}`,
      newValue: `${updated.code} - ${updated.name}`,
    });
    return updated;
  }

  async deleteAssetCategory(id: string, actor: AuthUser) {
    const existing = await this.prisma.assetCategory.findUnique({
      where: { id },
      include: { _count: { select: { types: true, assets: true } } },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy nhóm tài sản.');
    if (existing._count.types > 0 || existing._count.assets > 0) {
      throw new BadRequestException(
        `Không thể xóa nhóm "${existing.name}" vì đang có ${existing._count.types} loại tài sản và ${existing._count.assets} tài sản liên kết.`,
      );
    }
    await this.prisma.assetCategory.delete({ where: { id } });
    await this.auditService.log({
      userId: actor.id,
      actorName: actor.fullName,
      action: 'ASSET_CATEGORY_DELETED',
      entityType: 'AssetCategory',
      entityId: id,
      oldValue: `${existing.code} - ${existing.name}`,
    });
    return { deleted: true };
  }

  // Asset Types
  createAssetType(data: any) {
    return this.prisma.assetType.create({ data: { code: data.code.trim().toUpperCase(), name: data.name.trim(), categoryId: data.categoryId, supportsAgent: !!data.supportsAgent, description: data.description || null } });
  }

  // Suppliers
  createSupplier(data: any) {
    return this.prisma.supplier.create({ data: { code: data.code.trim(), name: data.name.trim(), taxCode: data.taxCode || null, contactName: data.contactName || null, phone: data.phone || null, email: data.email || null, address: data.address || null } });
  }

  // Roles & RBAC Permissions (Super Admin / SYSTEM_ADMIN only)
  private assertSuperAdmin(actor: AuthUser) {
    if (!actor?.roles?.includes('SYSTEM_ADMIN')) {
      throw new ForbiddenException('Chỉ Super Admin (System Admin) mới có quyền tạo hoặc chỉnh sửa nhóm quyền.');
    }
  }

  async createRole(data: any, actor: AuthUser) {
    this.assertSuperAdmin(actor);
    const code = (data.code || '').trim().toUpperCase().replace(/\s+/g, '_');
    const name = (data.name || '').trim();
    if (!code || !name) {
      throw new BadRequestException('Vui lòng nhập đầy đủ mã và tên nhóm quyền.');
    }
    const dup = await this.prisma.role.findUnique({ where: { code } });
    if (dup) throw new ConflictException(`Mã nhóm quyền "${code}" đã tồn tại.`);

    const permIds: string[] = Array.isArray(data.permissionIds) ? data.permissionIds : [];

    const role = await this.prisma.$transaction(async (tx) => {
      const created = await tx.role.create({
        data: { code, name, description: data.description?.trim() || null },
      });
      if (permIds.length > 0) {
        await tx.rolePermission.createMany({
          data: permIds.map((permissionId) => ({ roleId: created.id, permissionId })),
        });
      }
      return created;
    });

    await this.auditService.log({
      userId: actor.id,
      actorName: actor.fullName,
      action: 'ROLE_CREATED',
      entityType: 'Role',
      entityId: role.id,
      newValue: `${role.code} (${role.name}) - ${permIds.length} quyền`,
    });
    return role;
  }

  async updateRole(id: string, data: any, actor: AuthUser) {
    this.assertSuperAdmin(actor);
    const existing = await this.prisma.role.findUnique({
      where: { id },
      include: { permissions: { include: { permission: true } } },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy nhóm quyền.');

    const name = data.name !== undefined ? String(data.name).trim() : existing.name;
    if (!name) throw new BadRequestException('Tên nhóm quyền không được để trống.');

    const hasPermUpdate = Array.isArray(data.permissionIds);
    const nextPermIds: string[] = hasPermUpdate ? data.permissionIds : [];

    if (existing.code === 'SYSTEM_ADMIN' && hasPermUpdate) {
      throw new BadRequestException('Không thể thay đổi quyền mặc định của nhóm Super Admin (System Admin).');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const r = await tx.role.update({
        where: { id },
        data: {
          name,
          description: data.description !== undefined ? data.description?.trim() || null : existing.description,
        },
      });
      if (hasPermUpdate) {
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
        if (nextPermIds.length > 0) {
          await tx.rolePermission.createMany({
            data: nextPermIds.map((permissionId) => ({ roleId: id, permissionId })),
          });
        }
      }
      return r;
    });

    await this.auditService.log({
      userId: actor.id,
      actorName: actor.fullName,
      action: 'ROLE_UPDATED',
      entityType: 'Role',
      entityId: id,
      oldValue: `${existing.name} (${existing.permissions.length} quyền)`,
      newValue: `${updated.name}${hasPermUpdate ? ` (${nextPermIds.length} quyền)` : ''}`,
    });
    return updated;
  }

  async deleteRole(id: string, actor: AuthUser) {
    this.assertSuperAdmin(actor);
    const existing = await this.prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { userRoles: true } } },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy nhóm quyền.');
    if (existing.code === 'SYSTEM_ADMIN') {
      throw new BadRequestException('Không thể xóa nhóm quyền Super Admin (System Admin).');
    }
    if (existing._count.userRoles > 0) {
      throw new BadRequestException(
        `Không thể xóa nhóm quyền "${existing.name}" vì đang được gán cho ${existing._count.userRoles} người dùng.`,
      );
    }
    await this.prisma.role.delete({ where: { id } });
    await this.auditService.log({
      userId: actor.id,
      actorName: actor.fullName,
      action: 'ROLE_DELETED',
      entityType: 'Role',
      entityId: id,
      oldValue: `${existing.code} (${existing.name})`,
    });
    return { deleted: true };
  }

  // Users & RBAC
  async listUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        employeeCode: true,
        title: true,
        isActive: true,
        lastLoginAt: true,
        department: true,
        employeeId: true,
        employee: { include: { department: true } },
        userRoles: { include: { role: true, department: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createUser(data: any, actor: AuthUser) {
    const username = (data.username || '').trim();
    if (!username) {
      throw new BadRequestException('Vui lòng nhập tên đăng nhập (tài khoản).');
    }
    const dupUser = await this.prisma.user.findUnique({ where: { username } });
    if (dupUser) {
      throw new ConflictException(`Tài khoản "${username}" đã tồn tại.`);
    }
    let linkedEmp: any = null;
    if (data.employeeId) {
      linkedEmp = await this.prisma.employee.findUnique({ where: { id: data.employeeId } });
      if (!linkedEmp) {
        throw new BadRequestException('Nhân viên được chọn không tồn tại.');
      }
    }
    const fullName = (data.fullName || linkedEmp?.fullName || '').trim();
    if (!fullName) {
      throw new BadRequestException('Vui lòng chọn nhân viên hoặc nhập họ tên.');
    }
    let email = (data.email || linkedEmp?.email || '').trim();
    if (!email) {
      email = `${username.toLowerCase().replace(/[^a-z0-9._-]/g, '') || 'user'}@internal.local`;
    }
    const dupEmail = await this.prisma.user.findUnique({ where: { email } });
    if (dupEmail) {
      email = `${username.toLowerCase().replace(/[^a-z0-9._-]/g, '')}.${Date.now().toString().slice(-4)}@internal.local`;
    }
    const departmentId = linkedEmp ? linkedEmp.departmentId || null : data.departmentId || null;
    const passwordHash = await bcrypt.hash(data.password || 'Admin@123', 10);
    const user = await this.prisma.user.create({
      data: {
        username,
        email,
        fullName,
        passwordHash,
        employeeCode: linkedEmp?.code || data.employeeCode || null,
        title: linkedEmp?.title || data.title || null,
        departmentId,
        employeeId: linkedEmp ? linkedEmp.id : null,
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
      },
    });
    if (data.roleId) {
      await this.prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: data.roleId,
          scopeType: data.scopeType || 'ORGANIZATION',
          departmentId: data.scopeType === 'DEPARTMENT' ? departmentId : null,
        },
      });
    }
    await this.auditService.log({
      userId: actor.id,
      actorName: actor.fullName,
      action: 'USER_CREATED',
      entityType: 'User',
      entityId: user.id,
      newValue: `${user.username} (${user.fullName})`,
    });
    return user;
  }

  async updateUser(id: string, data: any, actor: AuthUser) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Không tìm thấy người dùng.');
    let linkedEmp: any = null;
    if (data.employeeId) {
      linkedEmp = await this.prisma.employee.findUnique({ where: { id: data.employeeId } });
    }
    const nextDepartmentId = linkedEmp
      ? linkedEmp.departmentId || null
      : data.employeeId === null
        ? null
        : existing.departmentId;
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        fullName: linkedEmp
          ? linkedEmp.fullName
          : data.fullName !== undefined
            ? String(data.fullName).trim()
            : existing.fullName,
        email: linkedEmp?.email
          ? linkedEmp.email
          : data.email !== undefined && String(data.email).trim()
            ? String(data.email).trim()
            : existing.email,
        title: linkedEmp
          ? linkedEmp.title || null
          : data.title !== undefined
            ? data.title?.trim() || null
            : existing.title,
        employeeId: data.employeeId !== undefined ? data.employeeId || null : existing.employeeId,
        employeeCode: linkedEmp ? linkedEmp.code : data.employeeId === null ? null : existing.employeeCode,
        departmentId: nextDepartmentId,
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : existing.isActive,
      },
    });
    await this.auditService.log({
      userId: actor.id,
      actorName: actor.fullName,
      action: 'USER_UPDATED',
      entityType: 'User',
      entityId: id,
      newValue: `${updated.username} (${updated.fullName})`,
    });
    return updated;
  }

  async toggleUserActive(id: string, isActive: boolean, actor: AuthUser) {
    const updated = await this.prisma.user.update({ where: { id }, data: { isActive } });
    await this.auditService.log({
      userId: actor.id,
      actorName: actor.fullName,
      action: isActive ? 'USER_ACTIVATED' : 'USER_DISABLED',
      entityType: 'User',
      entityId: id,
    });
    return updated;
  }

  // System Settings
  async listSettings() {
    await this.ensureDefaultSystemSettings();
    return this.prisma.systemSetting.findMany({ orderBy: [{ group: 'asc' }, { key: 'asc' }] });
  }

  async updateSettings(items: Array<{ key: string; value: string }>, actor: AuthUser) {
    const summarize = (v?: string | null) => {
      if (!v) return '';
      return v.length > 140 ? `${v.slice(0, 140)}... (${v.length} chars)` : v;
    };
    for (const item of items) {
      const prev = await this.prisma.systemSetting.findUnique({ where: { key: item.key } });
      await this.prisma.systemSetting.upsert({
        where: { key: item.key },
        update: { value: String(item.value), updatedBy: actor.fullName },
        create: { key: item.key, value: String(item.value), updatedBy: actor.fullName },
      });
      await this.auditService.log({
        userId: actor.id,
        actorName: actor.fullName,
        action: 'SYSTEM_SETTING_UPDATED',
        entityType: 'SystemSetting',
        entityId: item.key,
        oldValue: summarize(prev?.value),
        newValue: summarize(String(item.value)),
      });
    }
    return this.listSettings();
  }

  saveOrgLogo(file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Chưa chọn tệp ảnh logo.');
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!ALLOWED_LOGO_EXTS.has(ext) || !ALLOWED_LOGO_MIMES.has(file.mimetype)) {
      throw new BadRequestException('Chỉ hỗ trợ ảnh logo định dạng PNG, JPG, WEBP hoặc SVG.');
    }
    const uploadDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'storage/uploads');
    fs.mkdirSync(uploadDir, { recursive: true });
    const storedName = `org-logo-${uuidv4()}${ext}`;
    fs.writeFileSync(path.join(uploadDir, storedName), file.buffer);
    return { url: `/api/v1/public/org-logo/${storedName}`, filename: storedName };
  }

  getOrgLogoPath(filename: string) {
    const safeName = path.basename(filename || '');
    if (!/^org-logo-[a-zA-Z0-9-]+\.(png|jpg|jpeg|webp|svg)$/.test(safeName)) {
      throw new NotFoundException('Không tìm thấy logo.');
    }
    const uploadDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'storage/uploads');
    const fullPath = path.join(uploadDir, safeName);
    if (!fs.existsSync(fullPath)) {
      throw new NotFoundException('Tệp logo không tồn tại.');
    }
    return fullPath;
  }
}

@ApiTags('Catalogs & Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('api/v1/admin')
export class CatalogsController {
  constructor(
    private readonly service: CatalogsService,
    private readonly auditService: AuditService,
  ) {}

  @Get('meta')
  getMeta() {
    return this.service.getAllMeta();
  }

  @Post('departments')
  @RequirePermissions('catalogs.create')
  createDepartment(@Body() body: any) {
    return this.service.createDepartment(body);
  }

  @Patch('departments/:id')
  @RequirePermissions('catalogs.update')
  updateDepartment(@Param('id') id: string, @Body() body: any) {
    return this.service.updateDepartment(id, body);
  }

  @Delete('departments/:id')
  @RequirePermissions('catalogs.delete')
  deleteDepartment(@Param('id') id: string) {
    return this.service.deleteDepartment(id);
  }

  @Get('employees')
  listEmployees() {
    return this.service.listEmployees();
  }

  @Post('employees')
  @RequirePermissions('catalogs.create')
  createEmployee(@Body() body: any, @CurrentUser() user: AuthUser) {
    return this.service.createEmployee(body, user);
  }

  @Patch('employees/:id')
  @RequirePermissions('catalogs.update')
  updateEmployee(@Param('id') id: string, @Body() body: any, @CurrentUser() user: AuthUser) {
    return this.service.updateEmployee(id, body, user);
  }

  @Patch('employees/:id/active')
  @RequirePermissions('catalogs.update')
  toggleEmployee(@Param('id') id: string, @Body() body: { isActive: boolean }, @CurrentUser() user: AuthUser) {
    return this.service.toggleEmployeeActive(id, body.isActive, user);
  }

  @Delete('employees/:id')
  @RequirePermissions('catalogs.delete')
  deleteEmployee(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.deleteEmployee(id, user);
  }

  @Post('locations')
  @RequirePermissions('catalogs.create')
  createLocation(@Body() body: any) {
    return this.service.createLocation(body);
  }

  @Delete('locations/:id')
  @RequirePermissions('catalogs.delete')
  deleteLocation(@Param('id') id: string) {
    return this.service.deleteLocation(id);
  }

  @Post('asset-categories')
  @RequirePermissions('catalogs.create')
  createAssetCategory(@Body() body: any, @CurrentUser() user: AuthUser) {
    return this.service.createAssetCategory(body, user);
  }

  @Patch('asset-categories/:id')
  @RequirePermissions('catalogs.update')
  updateAssetCategory(@Param('id') id: string, @Body() body: any, @CurrentUser() user: AuthUser) {
    return this.service.updateAssetCategory(id, body, user);
  }

  @Delete('asset-categories/:id')
  @RequirePermissions('catalogs.delete')
  deleteAssetCategory(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.deleteAssetCategory(id, user);
  }

  @Post('asset-types')
  @RequirePermissions('catalogs.create')
  createAssetType(@Body() body: any) {
    return this.service.createAssetType(body);
  }

  @Get('asset-statuses')
  listAssetStatuses() {
    return this.service.listAssetStatuses();
  }

  @Post('asset-statuses')
  @RequirePermissions('catalogs.create')
  createAssetStatus(@Body() body: any, @CurrentUser() user: AuthUser) {
    return this.service.createAssetStatus(body, user);
  }

  @Patch('asset-statuses/:id')
  @RequirePermissions('catalogs.update')
  updateAssetStatus(@Param('id') id: string, @Body() body: any, @CurrentUser() user: AuthUser) {
    return this.service.updateAssetStatus(id, body, user);
  }

  @Patch('asset-statuses/:id/active')
  @RequirePermissions('catalogs.update')
  toggleAssetStatus(@Param('id') id: string, @Body() body: { isActive: boolean }, @CurrentUser() user: AuthUser) {
    return this.service.toggleAssetStatusActive(id, body.isActive, user);
  }

  @Delete('asset-statuses/:id')
  @RequirePermissions('catalogs.delete')
  deleteAssetStatus(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.deleteAssetStatus(id, user);
  }

  @Post('suppliers')
  @RequirePermissions('catalogs.create')
  createSupplier(@Body() body: any) {
    return this.service.createSupplier(body);
  }

  @Post('roles')
  @RequirePermissions('users.create')
  createRole(@Body() body: any, @CurrentUser() user: AuthUser) {
    return this.service.createRole(body, user);
  }

  @Patch('roles/:id')
  @RequirePermissions('users.update')
  updateRole(@Param('id') id: string, @Body() body: any, @CurrentUser() user: AuthUser) {
    return this.service.updateRole(id, body, user);
  }

  @Delete('roles/:id')
  @RequirePermissions('users.delete')
  deleteRole(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.deleteRole(id, user);
  }

  @Get('users')
  @RequirePermissions('users.read')
  listUsers() {
    return this.service.listUsers();
  }

  @Post('users')
  @RequirePermissions('users.create')
  createUser(@Body() body: any, @CurrentUser() user: AuthUser) {
    return this.service.createUser(body, user);
  }

  @Patch('users/:id')
  @RequirePermissions('users.update')
  updateUser(@Param('id') id: string, @Body() body: any, @CurrentUser() user: AuthUser) {
    return this.service.updateUser(id, body, user);
  }

  @Patch('users/:id/active')
  @RequirePermissions('users.update')
  toggleUser(@Param('id') id: string, @Body() body: { isActive: boolean }, @CurrentUser() user: AuthUser) {
    return this.service.toggleUserActive(id, body.isActive, user);
  }

  @Get('settings')
  @RequirePermissions('settings.read')
  listSettings() {
    return this.service.listSettings();
  }

  @Patch('settings')
  @RequirePermissions('settings.update')
  updateSettings(@Body() body: { items: Array<{ key: string; value: string }> }, @CurrentUser() user: AuthUser) {
    return this.service.updateSettings(body.items || [], user);
  }

  @Post('settings/org-logo')
  @RequirePermissions('settings.update')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  uploadOrgLogo(@UploadedFile() file: Express.Multer.File) {
    return this.service.saveOrgLogo(file);
  }

  @Get('audit-logs')
  @RequirePermissions('admin.audit')
  listAuditLogs(@Query() query: any) {
    return this.auditService.findAll(query);
  }
}

@ApiTags('Public Organization Logo')
@Controller('api/v1/public/org-logo')
export class PublicOrgLogoController {
  constructor(private readonly service: CatalogsService) {}

  @Get(':filename')
  serveOrgLogo(@Param('filename') filename: string, @Res() res: Response) {
    const fullPath = this.service.getOrgLogoPath(filename);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.sendFile(fullPath);
  }
}

@Module({
  providers: [CatalogsService],
  controllers: [CatalogsController, PublicOrgLogoController],
})
export class CatalogsModule {}
