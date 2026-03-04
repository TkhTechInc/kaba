#!/usr/bin/env node

const esbuild = require('esbuild');
const { esbuildDecorators } = require('@anatine/esbuild-decorators');
const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const apiLambdaDir = path.join(rootDir, 'dist/api-lambda');
if (!fs.existsSync(apiLambdaDir)) {
  fs.mkdirSync(apiLambdaDir, { recursive: true });
}

// Remove leftover trace files from previous debug builds
if (fs.existsSync(apiLambdaDir)) {
  const files = fs.readdirSync(apiLambdaDir);
  for (const f of files) {
    if (f.startsWith('handler-trace') && f.endsWith('.js')) {
      fs.unlinkSync(path.join(apiLambdaDir, f));
    }
  }
}

console.log('Bundling Nest API Lambda...');

const externals = [
  'aws-sdk',
  '@aws-sdk/*',
  'aws-lambda',
  'aws-lambda/*',
  '@nestjs/websockets',
  '@nestjs/websockets/socket-module',
  '@nestjs/microservices',
  '@nestjs/microservices/microservices-module',
  'class-transformer/storage',
  'mock-aws-s3',
  'nock',
];

esbuild
  .build({
    entryPoints: [path.join(rootDir, 'src/nest/lambda.ts')],
    bundle: true,
    platform: 'node',
    target: 'node20',
    tsconfig: path.join(rootDir, 'tsconfig.json'),
    outfile: path.join(rootDir, 'dist/api-lambda/handler.js'),
    external: externals,
    plugins: [
      esbuildDecorators({
        tsconfig: path.join(rootDir, 'tsconfig.json'),
        cwd: rootDir,
      }),
    ],
  })
  .then(() => {
    console.log('Nest API Lambda bundled: dist/api-lambda/handler.js');
  })
  .catch((err) => {
    console.error('Bundle failed:', err.message);
    process.exit(1);
  });
