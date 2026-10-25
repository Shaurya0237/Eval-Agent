/**
 * Entry point: serves /api and the built web app on one port.
 * Fastify (not Express) because our proxy blocks Express's content-type deps.
 */
import 'reflect-metadata';
import { existsSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppModule } from './app.module';
import { loadEnv } from './config/env';
import { API_KEY_ENV } from './config/model-provider';
import { paths } from './config/paths';
import { PipelineRunner } from './services/pipeline-runner.service';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
};

/** Serve built UI files, falling back to index.html for client-side routes. */
function serveWebApp(app: NestFastifyApplication): void {
  const root = normalize(paths.webDist);
  const fastify = app.getHttpAdapter().getInstance();
  // Catch-all; Fastify still prefers the specific /api routes.
  const handler = async (request: FastifyRequest, reply: FastifyReply) => {
    const url = request.url.split('?')[0];
    if (url.startsWith('/api')) return reply.code(404).send({ statusCode: 404, message: `Cannot GET ${url}` });
    const candidate = normalize(join(root, decodeURIComponent(url)));
    const isFile = candidate.startsWith(root + sep) && existsSync(candidate) && statSync(candidate).isFile();
    const file = isFile ? candidate : join(root, 'index.html');
    return reply.type(MIME[extname(file)] ?? 'application/octet-stream').send(await readFile(file));
  };
  fastify.get('/', handler);
  fastify.get('/*', handler);
}

async function bootstrap(): Promise<void> {
  loadEnv();
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  // Mark experiments left "running" by a previous process as interrupted.
  await app.get(PipelineRunner).recoverInterrupted();
  if (existsSync(paths.webDist)) serveWebApp(app);

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port, '127.0.0.1');
  const logger = new Logger('AgentEvalLab');
  logger.log(`Ready → http://localhost:${port}`);
  if (!process.env[API_KEY_ENV]) logger.warn(`${API_KEY_ENV} is not set: you can browse, but not start experiments.`);
}

void bootstrap();
