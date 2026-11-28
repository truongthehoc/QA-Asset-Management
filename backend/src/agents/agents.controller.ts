import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  Headers,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AgentsService } from './agents.service';
import { JwtAuthGuard, PermissionsGuard, RequirePermissions, CurrentUser, AuthUser } from '../auth/guards';

@ApiTags('Windows Agent API')
@Controller('api/v1/agent')
export class AgentProtocolController {
  constructor(private readonly agentsService: AgentsService) {}

  @Post('enroll')
  enroll(@Body() body: any) {
    return this.agentsService.enroll(body);
  }

  @Post('heartbeat')
  async heartbeat(
    @Headers('x-agent-id') agentUid: string,
    @Headers('x-agent-token') agentToken: string,
    @Body() body: any,
  ) {
    const agent = await this.agentsService.authenticateAgent(agentUid, agentToken);
    return this.agentsService.heartbeat(agent, body || {});
  }

  @Post('inventory')
  async inventory(
    @Headers('x-agent-id') agentUid: string,
    @Headers('x-agent-token') agentToken: string,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() body: any,
  ) {
    const agent = await this.agentsService.authenticateAgent(agentUid, agentToken);
    return this.agentsService.submitSnapshot(agent, { ...body, source: body.source || 'INITIAL' }, idempotencyKey);
  }

  @Post('snapshot')
  async snapshot(
    @Headers('x-agent-id') agentUid: string,
    @Headers('x-agent-token') agentToken: string,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() body: any,
  ) {
    const agent = await this.agentsService.authenticateAgent(agentUid, agentToken);
    return this.agentsService.submitSnapshot(agent, body, idempotencyKey);
  }

  @Post('events')
  async events(
    @Headers('x-agent-id') agentUid: string,
    @Headers('x-agent-token') agentToken: string,
    @Body() body: { events: any[] },
  ) {
    const agent = await this.agentsService.authenticateAgent(agentUid, agentToken);
    return this.agentsService.submitEvents(agent, body?.events || []);
  }

  @Get('config')
  async config(
    @Headers('x-agent-id') agentUid: string,
    @Headers('x-agent-token') agentToken: string,
  ) {
    await this.agentsService.authenticateAgent(agentUid, agentToken);
    return this.agentsService.getAgentConfig();
  }

  @Get('version')
  version() {
    return this.agentsService.getLatestVersion();
  }

  @Get('self-update/bundle')
  async selfUpdateBundle(
    @Headers('x-agent-id') agentUid: string,
    @Headers('x-agent-token') agentToken: string,
  ) {
    await this.agentsService.authenticateAgent(agentUid, agentToken);
    return this.agentsService.getSelfUpdateBundle();
  }
}

@ApiTags('Agents Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('api/v1/agents')
export class AgentsAdminController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get()
  @RequirePermissions('discovery.read')
  listAgents(@Query() query: any) {
    return this.agentsService.listAgents(query);
  }

  @Patch(':id/revoke')
  @RequirePermissions('admin.settings')
  revoke(@Param('id') id: string, @Body() body: { reason?: string }, @CurrentUser() user: AuthUser) {
    return this.agentsService.revokeAgent(id, body.reason || '', user);
  }

  @Post(':id/commands')
  @RequirePermissions('admin.settings')
  issueCommand(@Param('id') id: string, @Body() body: { commandType: string }, @CurrentUser() user: AuthUser) {
    return this.agentsService.issueAllowedCommand(id, body.commandType, user.fullName);
  }

  @Get('tokens')
  @RequirePermissions('admin.settings')
  listTokens() {
    return this.agentsService.listEnrollmentTokens();
  }

  @Post('tokens')
  @RequirePermissions('admin.settings')
  createToken(@Body() body: any, @CurrentUser() user: AuthUser) {
    return this.agentsService.createEnrollmentToken(body, user);
  }

  @Patch('tokens/:id/revoke')
  @RequirePermissions('admin.settings')
  revokeToken(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.agentsService.revokeEnrollmentToken(id, user);
  }

  @Get('versions')
  @RequirePermissions('discovery.read')
  listVersions() {
    return this.agentsService.listVersions();
  }

  @Post('versions')
  @RequirePermissions('admin.settings')
  createVersion(@Body() body: any) {
    return this.agentsService.createVersion(body);
  }

  @Post('download-installer')
  @RequirePermissions('admin.settings')
  async downloadInstaller(
    @Body() body: { backendUrl?: string; enrollmentToken?: string; allowSelfSignedCert?: boolean },
    @Res() res: Response,
  ) {
    const { filename, content } = await this.agentsService.buildOneClickInstaller(body || {});
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(content);
  }
}
