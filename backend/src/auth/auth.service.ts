import { Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const AVATAR_UPLOAD_DIR = path.resolve(process.cwd(), 'storage', 'uploads', 'avatars');
const ALLOWED_AVATAR_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg']);
const ALLOWED_AVATAR_MIMES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml']);

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
  ) {}

  private formatUserProfile(user: any) {
    const roles = (user.userRoles || []).map((ur: any) => ur.role.code);
    const permSet = new Set<string>();
    for (const ur of user.userRoles || []) {
      for (const rp of ur.role.permissions || []) {
        permSet.add(rp.permission.code);
      }
    }
    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone || '',
      title: user.title || '',
      avatarUrl: user.avatarUrl || '',
      employeeCode: user.employeeCode || user.employee?.code || null,
      departmentId: user.departmentId,
      departmentName: user.department?.name || null,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      roles,
      roleNames: (user.userRoles || []).map((ur: any) => ur.role.name),
      permissions: Array.from(permSet),
      scopes: (user.userRoles || []).map((ur: any) => ({
        roleCode: ur.role.code,
        scopeType: ur.scopeType,
        departmentId: ur.departmentId,
      })),
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        department: true,
        employee: true,
        userRoles: {
          include: {
            role: { include: { permissions: { include: { permission: true } } } },
          },
        },
      },
    });
    if (!user) throw new NotFoundException('Không tìm thấy tài khoản.');
    return this.formatUserProfile(user);
  }

  async login(username: string, password: string, ipAddress?: string) {
    const user = await this.prisma.user.findUnique({
      where: { username: username.trim() },
      include: {
        department: true,
        employee: true,
        userRoles: {
          include: {
            role: { include: { permissions: { include: { permission: true } } } },
          },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không đúng.');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không đúng.');
    }

    const now = new Date();
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: now },
    });
    user.lastLoginAt = now;

    await this.auditService.log({
      userId: user.id,
      actorName: user.fullName,
      action: 'USER_LOGIN',
      entityType: 'User',
      entityId: user.id,
      ipAddress,
    });

    const token = this.jwtService.sign({ sub: user.id, username: user.username });
    return {
      accessToken: token,
      user: this.formatUserProfile(user),
    };
  }

  async updateProfile(
    userId: string,
    body: { email?: string; phone?: string; avatarUrl?: string | null },
  ) {
    const existing = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!existing) throw new NotFoundException('Không tìm thấy tài khoản.');

    const nextEmail = body.email !== undefined ? body.email.trim() : existing.email;
    if (!nextEmail) throw new BadRequestException('Email không được để trống.');

    if (nextEmail !== existing.email) {
      const dup = await this.prisma.user.findUnique({ where: { email: nextEmail } });
      if (dup && dup.id !== userId) {
        throw new BadRequestException('Địa chỉ email này đã được sử dụng bởi tài khoản khác.');
      }
    }

    const nextPhone = body.phone !== undefined ? (body.phone?.trim() || null) : existing.phone;
    const nextAvatarUrl =
      body.avatarUrl !== undefined ? (body.avatarUrl?.trim() || null) : existing.avatarUrl;

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          email: nextEmail,
          phone: nextPhone,
          avatarUrl: nextAvatarUrl,
        },
      });

      if (existing.employeeId) {
        await tx.employee.update({
          where: { id: existing.employeeId },
          data: {
            email: nextEmail,
            phone: nextPhone,
          },
        }).catch(() => {});
      }
    });

    await this.auditService.log({
      userId,
      actorName: existing.fullName,
      action: 'USER_UPDATED',
      entityType: 'User',
      entityId: userId,
      newValue: `Cập nhật hồ sơ cá nhân (${nextEmail}${nextPhone ? `, ${nextPhone}` : ''})`,
    });

    return this.getProfile(userId);
  }

  async uploadAvatar(userId: string, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Vui lòng chọn ảnh đại diện.');
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!ALLOWED_AVATAR_EXTS.has(ext) || !ALLOWED_AVATAR_MIMES.has(file.mimetype)) {
      throw new BadRequestException('Chỉ hỗ trợ ảnh đại diện định dạng PNG, JPG, WEBP hoặc SVG.');
    }

    fs.mkdirSync(AVATAR_UPLOAD_DIR, { recursive: true });
    const filename = `avatar-${userId.slice(0, 8)}-${crypto.randomUUID()}${ext}`;
    fs.writeFileSync(path.join(AVATAR_UPLOAD_DIR, filename), file.buffer);
    const avatarUrl = `/api/v1/public/avatars/${filename}`;

    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
    });

    const user = await this.getProfile(userId);
    return { avatarUrl, user };
  }

  getAvatarPath(filename: string) {
    const safe = path.basename(filename);
    const fullPath = path.join(AVATAR_UPLOAD_DIR, safe);
    if (!fs.existsSync(fullPath)) throw new NotFoundException('Không tìm thấy ảnh đại diện.');
    return fullPath;
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    if (!newPassword || newPassword.length < 6) {
      throw new BadRequestException('Mật khẩu mới phải có ít nhất 6 ký tự.');
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) throw new BadRequestException('Mật khẩu hiện tại không chính xác.');
    const hash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: hash } });
    return { message: 'Đổi mật khẩu thành công.' };
  }
}
