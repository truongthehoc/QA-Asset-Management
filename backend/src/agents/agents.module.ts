import { Module } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { AgentProtocolController, AgentsAdminController } from './agents.controller';

@Module({
  providers: [AgentsService],
  controllers: [AgentProtocolController, AgentsAdminController],
  exports: [AgentsService],
})
export class AgentsModule {}
