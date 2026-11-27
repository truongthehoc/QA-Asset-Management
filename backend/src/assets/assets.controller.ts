import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { memoryStorage } from 'multer';
import { AssetsService } from './assets.service';
import { JwtAuthGuard, PermissionsGuard, RequirePermissions, CurrentUser, AuthUser } from '../auth/guards';

@ApiTags('Assets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('api/v1/assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get()
  @RequirePermissions('assets.read')
  findAll(@CurrentUser() user: AuthUser, @Query() query: any) {
    return this.assetsService.findAll(user, query);
  }

  @Get('preview-code')
  @RequirePermissions('assets.read')
  previewCode(@Query('assetTypeId') assetTypeId: string) {
    return this.assetsService.previewNextCode(assetTypeId);
  }

  @Get('documents/:docId/download')
  @RequirePermissions('assets.read')
  async downloadDocument(@Param('docId') docId: string, @Res() res: Response) {
    const { doc, fullPath } = await this.assetsService.getDocumentForDownload(docId);
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.originalName)}"`);
    return res.sendFile(fullPath);
  }

  @Delete('documents/:docId')
  @RequirePermissions('assets.documents')
  deleteDocument(@Param('docId') docId: string, @CurrentUser() user: AuthUser) {
    return this.assetsService.deleteDocument(docId, user);
  }

  @Get(':id')
  @RequirePermissions('assets.read')
  findOne(@Param('id') id: string) {
    return this.assetsService.findOne(id);
  }

  @Get(':id/qr')
  @RequirePermissions('assets.read')
  getQr(@Param('id') id: string) {
    return this.assetsService.getQrCode(id);
  }

  @Post()
  @RequirePermissions('assets.create')
  create(@Body() body: any, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.assetsService.create(body, user, req.ip);
  }

  @Patch(':id')
  @RequirePermissions('assets.update')
  update(@Param('id') id: string, @Body() body: any, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.assetsService.update(id, body, user, req.ip);
  }

  @Patch(':id/code')
  @RequirePermissions('assets.edit_code')
  updateCode(
    @Param('id') id: string,
    @Body() body: { assetCode: string; reason: string },
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.assetsService.updateAssetCode(id, body.assetCode, body.reason, user, req.ip);
  }

  @Post(':id/documents')
  @RequirePermissions('assets.documents')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: (Number(process.env.MAX_UPLOAD_SIZE_MB) || 15) * 1024 * 1024 },
    }),
  )
  uploadDoc(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { docType?: string; notes?: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.assetsService.uploadDocument(id, file, body.docType || 'OTHER', body.notes || '', user);
  }
}

@ApiTags('Public Asset QR')
@Controller('api/v1/public/assets')
export class PublicAssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get(':code')
  getPublicByCode(@Param('code') code: string) {
    return this.assetsService.findPublicByCode(code);
  }
}
