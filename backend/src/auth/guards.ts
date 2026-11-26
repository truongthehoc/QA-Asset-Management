import {
  Injectable,
  CanActivate,
  ExecutionContext,
  SetMetadata,
  createParamDecorator,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

export const PERMISSIONS_KEY = 'required_permissions';
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  email: string;
  departmentId: string | null;
  roles: string[];
  permissions: string[];
  scopes: Array<{
    roleCode: string;
    scopeType: string;
    departmentId: string | null;
    assetTypeId: string | null;
  }>;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest();
    return req.user;
  },
);

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

const PERMISSION_ALIASES: Record<string, string[]> = {
  'assets.write': ['assets.create', 'assets.update'],
  'transfers.manage': ['transfers.create', 'transfers.update'],
  'maintenance.manage': ['maintenance.create', 'maintenance.update'],
  'inventory.manage': ['inventory.create', 'inventory.update'],
  'admin.catalogs': ['catalogs.read', 'catalogs.create', 'catalogs.update', 'catalogs.delete'],
  'admin.users': ['users.read', 'users.create', 'users.update', 'users.delete'],
  'admin.settings': ['settings.read', 'settings.create', 'settings.update', 'settings.delete'],
};

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const req = context.switchToHttp().getRequest();
    const user: AuthUser = req.user;
    if (!user) return false;
    if (user.roles.includes('SYSTEM_ADMIN')) return true;

    const hasAll = required.every((perm) => {
      if (user.permissions.includes(perm)) return true;
      const aliases = PERMISSION_ALIASES[perm];
      return aliases ? aliases.some((a) => user.permissions.includes(a)) : false;
    });
    if (!hasAll) {
      throw new ForbiddenException('Bạn không có quyền thực hiện thao tác này.');
    }
    return true;
  }
}

export function buildAssetScopeWhere(user: AuthUser) {
  if (!user || user.roles.includes('SYSTEM_ADMIN') || user.roles.includes('IT_ADMIN')) {
    return {};
  }
  const orgScope = user.scopes.find((s) => s.scopeType === 'ORGANIZATION');
  if (orgScope) return {};

  const deptIds = user.scopes.filter((s) => s.scopeType === 'DEPARTMENT' && s.departmentId).map((s) => s.departmentId!);
  const typeIds = user.scopes.filter((s) => s.scopeType === 'ASSET_TYPE' && s.assetTypeId).map((s) => s.assetTypeId!);

  const clauses: any[] = [];
  if (deptIds.length > 0) {
    clauses.push({ OR: [{ usingDepartmentId: { in: deptIds } }, { managingDepartmentId: { in: deptIds } }] });
  }
  if (typeIds.length > 0) {
    clauses.push({ assetTypeId: { in: typeIds } });
  }
  if (clauses.length === 0 && user.departmentId) {
    return { OR: [{ usingDepartmentId: user.departmentId }, { managingDepartmentId: user.departmentId }] };
  }
  return clauses.length > 0 ? { OR: clauses } : {};
}
