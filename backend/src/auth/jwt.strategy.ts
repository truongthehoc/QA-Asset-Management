import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from './guards';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'it-asset-mgmt-internal-jwt-secret-change-in-production-2026',
    });
  }

  async validate(payload: { sub: string }): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Tài khoản không tồn tại hoặc đã bị khóa.');
    }

    const roles = user.userRoles.map((ur) => ur.role.code);
    const permSet = new Set<string>();
    for (const ur of user.userRoles) {
      for (const rp of ur.role.permissions) {
        permSet.add(rp.permission.code);
      }
    }

    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      departmentId: user.departmentId,
      roles,
      permissions: Array.from(permSet),
      scopes: user.userRoles.map((ur) => ({
        roleCode: ur.role.code,
        scopeType: ur.scopeType,
        departmentId: ur.departmentId,
        assetTypeId: ur.assetTypeId,
      })),
    };
  }
}
