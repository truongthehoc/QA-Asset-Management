import { Module } from '@nestjs/common';
import { AssetsService } from './assets.service';
import { AssetsController, PublicAssetsController } from './assets.controller';

@Module({
  providers: [AssetsService],
  controllers: [AssetsController, PublicAssetsController],
  exports: [AssetsService],
})
export class AssetsModule {}
