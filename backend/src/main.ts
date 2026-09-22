import { createServer } from 'http';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { attachViteHmr, attachWebUi } from './web-ui';

function listenOn(server: ReturnType<typeof createServer>, port: number, host: string) {
  return new Promise<void>((resolve, reject) => {
    const onError = (err: Error) => reject(err);
    server.once('error', onError);
    server.listen(port, host, () => {
      server.off('error', onError);
      resolve();
    });
  });
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.setGlobalPrefix('api/v1');

  const config = new DocumentBuilder()
    .setTitle('EMMAPP Mobile API')
    .setDescription('ERP/CRM pour production et distribution d\'eau potable')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
  attachWebUi(app);

  const port = Number(process.env.PORT) || 8443;
  // IPv4 on all interfaces: Cursor/port-forwarders scan 0.0.0.0, not IPv6-only sockets.
  await app.listen(port, '0.0.0.0');
  attachViteHmr(app.getHttpServer());
  // IPv6 localhost: Chromium resolves "localhost" to ::1 first; without this bind
  // the preview browser gets ERR_SOCKET_NOT_CONNECTED / connection refused.
  const ipv6 = createServer(app.getHttpAdapter().getInstance());
  try {
    await listenOn(ipv6, port, '::1');
    attachViteHmr(ipv6);
  } catch (err) {
    console.warn(`IPv6 ::1:${port} unavailable`, err);
  }

  console.log(`EMMAPP UI  http://localhost:${port}/`);
  console.log(`EMMAPP API http://localhost:${port}/api/docs`);
}

bootstrap();
