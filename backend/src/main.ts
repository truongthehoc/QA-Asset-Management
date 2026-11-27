import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(json({ limit: '15mb' }));
  app.use(urlencoded({ extended: true, limit: '15mb' }));

  // SRS 11.1: Request ID tracing header on every request
  app.use((req: any, res: any, next: any) => {
    const reqId = req.headers['x-request-id'] || uuidv4();
    req.requestId = reqId;
    res.setHeader('X-Request-Id', reqId);
    next();
  });

  app.enableCors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true,
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('IT Asset Management API')
    .setDescription('Hệ thống quản lý tài sản CNTT nội bộ - REST API v1 & Windows Agent Protocol')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const doc = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, doc);

  const port = Number(process.env.PORT) || 3001;
  await app.listen(port);
  console.log(`IT Asset Management Backend listening on http://localhost:${port}`);
  console.log(`Swagger API Docs: http://localhost:${port}/api/docs`);
}

bootstrap();
