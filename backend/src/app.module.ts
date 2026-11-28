import { Module, Controller, Get } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { AgentsModule } from './agents/agents.module';
import { AssetsModule } from './assets/assets.module';
import { DiscoveryModule } from './discovery/discovery.module';
import { AlertsModule } from './alerts/alerts.module';
import { TransfersModule } from './transfers/transfers.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { InventoryModule } from './inventory/inventory.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { SoftwareModule } from './software/software.module';
import { ReportsModule } from './reports/reports.module';
import { CatalogsModule } from './catalogs/catalogs.module';
import { ContractsModule } from './contracts/contracts.module';
import { PrismaService } from './prisma/prisma.service';

@Controller('api/v1/health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    const [assets, agents] = await Promise.all([
      this.prisma.asset.count(),
      this.prisma.deviceAgent.count(),
    ]);
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'IT Asset Management API v1',
      counts: { assets, agents },
    };
  }
}

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    AuthModule,
    AgentsModule,
    AssetsModule,
    DiscoveryModule,
    AlertsModule,
    TransfersModule,
    MaintenanceModule,
    InventoryModule,
    DashboardModule,
    SoftwareModule,
    ReportsModule,
    CatalogsModule,
    ContractsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
