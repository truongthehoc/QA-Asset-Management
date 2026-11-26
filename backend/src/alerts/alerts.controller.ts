import { Controller, Get, Patch, Post, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AlertsService } from './alerts.service';
import { JwtAuthGuard, PermissionsGuard, RequirePermissions, CurrentUser, AuthUser } from '../auth/guards';

@ApiTags('Alerts & Changes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('api/v1/alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  @RequirePermissions('alerts.read')
  listAlerts(@Query() query: any) {
    return this.alertsService.listAlerts(query);
  }

  @Patch(':id/status')
  @RequirePermissions('alerts.read')
  updateStatus(@Param('id') id: string, @Body() body: { status: string; notes?: string }, @CurrentUser() user: AuthUser) {
    return this.alertsService.updateAlertStatus(id, body.status, body.notes || '', user);
  }

  @Get('changes')
  @RequirePermissions('alerts.read')
  listChanges(@Query() query: any) {
    return this.alertsService.listDeviceChanges(query);
  }

  @Post('changes/:changeId/verify')
  @RequirePermissions('alerts.verify')
  verifyChange(
    @Param('changeId') changeId: string,
    @Body() body: { decision: 'APPROVED' | 'REJECTED' | 'IGNORED'; notes?: string; updateBaseline?: boolean },
    @CurrentUser() user: AuthUser,
  ) {
    return this.alertsService.verifyDeviceChange(
      changeId,
      body.decision,
      body.notes || '',
      body.updateBaseline !== false,
      user,
    );
  }

  @Get('rules')
  @RequirePermissions('alerts.read')
  listRules() {
    return this.alertsService.listRules();
  }

  @Patch('rules/:id')
  @RequirePermissions('admin.settings')
  updateRule(@Param('id') id: string, @Body() body: any, @CurrentUser() user: AuthUser) {
    return this.alertsService.updateRule(id, body, user);
  }
}
