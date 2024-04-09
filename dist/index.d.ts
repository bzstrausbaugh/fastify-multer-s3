import * as AWS from '@aws-sdk/client-s3';
import { File, StorageEngine } from 'fastify-multer/lib/interfaces';
import { FastifyRequest } from 'fastify';

interface Options {
  s3: AWS.S3Client;
  bucket:
    | ((
        req: FastifyRequest,
        file: File,
        callback: (error: any, bucket?: string) => void
      ) => void)
    | string;
  key?(
    req: FastifyRequest,
    file: File,
    callback: (error: any, key?: string) => void
  ): void;
  acl?:
    | ((
        req: FastifyRequest,
        file: File,
        callback: (error: any, acl?: string) => void
      ) => void)
    | string;
  contentType?(
    req: FastifyRequest,
    file: File,
    callback: (
      error: any,
      mime?: string,
      stream?: NodeJS.ReadableStream
    ) => void
  ): void;
  contentDisposition?:
    | ((
        req: FastifyRequest,
        file: File,
        callback: (error: any, contentDisposition?: string) => void
      ) => void)
    | string;
  metadata?(
    req: FastifyRequest,
    file: File,
    callback: (error: any, metadata?: any) => void
  ): void;
  cacheControl?:
    | ((
        req: FastifyRequest,
        file: File,
        callback: (error: any, cacheControl?: string) => void
      ) => void)
    | string;
  serverSideEncryption?:
    | ((
        req: FastifyRequest,
        file: File,
        callback: (error: any, serverSideEncryption?: string) => void
      ) => void)
    | string;
  shouldTransform?(
    req: FastifyRequest,
    file: File,
    callback: (error: any, metadata?: any) => void
  ): void;
  transforms?: {
    id: string;
    key(
      req: FastifyRequest,
      file: File,
      callback: (error: any, metadata?: any) => void
    ): void;
    transform(
      req: FastifyRequest,
      file: File,
      callback: (error: any, metadata?: any) => void
    ): void;
  }[];
}

declare global {
  namespace Fastify {
    namespace MulterS3 {
      interface File extends File {
        bucket: string;
        key: string;
        acl: string;
        contentType: string;
        contentDisposition: null;
        storageClass: string;
        serverSideEncryption: null;
        metadata: any;
        location: string;
        etag: string;
        transforms: {
          id: string;
          size: string;
          bucket: string;
          key: string;
          acl: string;
          contentType: string;
          contentDisposition: null;
          storageClass: string;
          serverSideEncryption: null;
          metadata: any;
          location: string;
          etag: string;
        }[];
      }
    }
  }
}

interface S3StorageTransforms {
  (options?: Options): StorageEngine;

  AUTO_CONTENT_TYPE(
    req: FastifyRequest,
    file: File,
    callback: (
      error: any,
      mime?: string,
      stream?: NodeJS.ReadableStream
    ) => void
  ): void;
  DEFAULT_CONTENT_TYPE(
    req: FastifyRequest,
    file: File,
    callback: (error: any, mime?: string) => void
  ): void;
}

declare const s3Storage: S3StorageTransforms;

export { type Options, type S3StorageTransforms, s3Storage as default };
