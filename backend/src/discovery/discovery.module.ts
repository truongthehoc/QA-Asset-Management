import { Module } from '@nestjs/common';
import { DiscoveryService } from './discovery.service';
import { DiscoveryController } from './discovery.controller';
import { AssetsModule } from '../assets/assets.module';

@Module({
  imports: [AssetsModule],
  providers: [DiscoveryService],
  controllers: [DiscoveryController],
})
export class DiscoveryModule {}
