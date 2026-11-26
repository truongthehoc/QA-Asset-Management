import { Controller, Get, Post, Delete, Patch, Param, Query, Body, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { DiscoveryService } from './discovery.service';
import { JwtAuthGuard, PermissionsGuard, RequirePermissions, CurrentUser, AuthUser } from '../auth/guards';

@ApiTags('Discovery')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('api/v1/discovery')
export class DiscoveryController {
  constructor(private readonly discoveryService: DiscoveryService) {}

  @Get('networks')
  @RequirePermissions('discovery.read')
  listNetworks() {
    return this.discoveryService.listNetworks();
  }

  @Post('networks')
  @RequirePermissions('discovery.scan')
  createNetwork(@Body() body: any) {
    return this.discoveryService.createNetwork(body);
  }

  @Delete('networks/:id')
  @RequirePermissions('discovery.scan')
  deleteNetwork(@Param('id') id: string) {
    return this.discoveryService.deleteNetwork(id);
  }

  @Get('scans')
  @RequirePermissions('discovery.read')
  listScans() {
    return this.discoveryService.listScans();
  }

  @Post('networks/:id/scan')
  @RequirePermissions('discovery.scan')
  runScan(@Param('id') id: string, @Body() body: { mode?: 'ARP_PROBE' | 'DEMO_SIMULATE' }, @CurrentUser() user: AuthUser) {
    return this.discoveryService.runNetworkScan(id, user, body?.mode || 'ARP_PROBE');
  }

  @Get('devices')
  @RequirePermissions('discovery.read')
  listDevices(@Query() query: any) {
    return this.discoveryService.listDiscoveredDevices(query);
  }

  @Post('devices/:id/approve')
  @RequirePermissions('discovery.approve')
  approve(@Param('id') id: string, @Body() body: any, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.discoveryService.approveDevice(id, body, user, req.ip);
  }

  @Patch('devices/:id/ignore')
  @RequirePermissions('discovery.approve')
  ignore(@Param('id') id: string, @Body() body: { reason?: string }, @CurrentUser() user: AuthUser) {
    return this.discoveryService.ignoreDevice(id, body.reason || '', user);
  }

  @Patch('devices/:id/restore')
  @RequirePermissions('discovery.approve')
  restore(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.discoveryService.restoreDevice(id, user);
  }
}
