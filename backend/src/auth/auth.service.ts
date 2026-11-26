import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
  ) {}

  async login(username: string, password: string, ipAddress?: string) {
    const user = await this.prisma.user.findUnique({
      where: { username: username.trim() },
      include: {
        department: true,
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

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.auditService.log({
      userId: user.id,
      actorName: user.fullName,
      action: 'USER_LOGIN',
      entityType: 'User',
      entityId: user.id,
      ipAddress,
    });

    const roles = user.userRoles.map((ur) => ur.role.code);
    const permSet = new Set<string>();
    for (const ur of user.userRoles) {
      for (const rp of ur.role.permissions) {
        permSet.add(rp.permission.code);
      }
    }

    const token = this.jwtService.sign({ sub: user.id, username: user.username });
    return {
      accessToken: token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        title: user.title,
        departmentId: user.departmentId,
        departmentName: user.department?.name || null,
        roles,
        roleNames: user.userRoles.map((ur) => ur.role.name),
        permissions: Array.from(permSet),
        scopes: user.userRoles.map((ur) => ({
          roleCode: ur.role.code,
          scopeType: ur.scopeType,
          departmentId: ur.departmentId,
        })),
      },
    };
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
