import crypto from 'node:crypto';
import stream from 'node:stream';
import { filetypemime } from 'magic-bytes.js';
import parallel from 'run-parallel';
import isSvg from 'is-svg';
import {
  DeleteObjectCommand,
  DeleteObjectCommandInput,
  S3Client,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

const staticValue = (value) => {
  return function (req, file, cb) {
    cb(null, value);
  };
};

var defaultAcl = staticValue('private');
var defaultContentType = staticValue('application/octet-stream');

var defaultMetadata = staticValue(null);
var defaultCacheControl = staticValue(null);
var defaultShouldTransform = staticValue(false);
var defaultTransforms = [];
var defaultContentDisposition = staticValue(null);
var defaultStorageClass = staticValue('STANDARD');
var defaultSSE = staticValue(null);
var defaultSSEKMS = staticValue(null);

const defaultKey = (req, file, cb) => {
  crypto.randomBytes(16, function (err, raw) {
    cb(err, err ? undefined : raw.toString('hex'));
  });
};

const autoContentType = (req, file, cb) => {
  file.stream.once('data', async (firstChunk) => {
    var type: any[] = filetypemime(firstChunk);
    var mime;

    if (type && type.length > 0) {
      mime = type[0];
    } else if (isSvg(firstChunk.toString())) {
      mime = 'image/svg+xml';
    } else {
      mime = 'application/octet-stream';
    }
    var outStream = new stream.PassThrough();

    outStream.write(firstChunk);
    file.stream.pipe(outStream);

    cb(null, mime, outStream);
  });
};

function collect(storage, req, file, cb) {
  parallel(
    [
      storage.getBucket.bind(storage, req, file),
      storage.getKey.bind(storage, req, file),
      storage.getAcl.bind(storage, req, file),
      storage.getMetadata.bind(storage, req, file),
      storage.getCacheControl.bind(storage, req, file),
      storage.getShouldTransform.bind(storage, req, file),
      storage.getContentDisposition.bind(storage, req, file),
      storage.getStorageClass.bind(storage, req, file),
      storage.getSSE.bind(storage, req, file),
      storage.getSSEKMS.bind(storage, req, file),
    ],
    (err, values) => {
      if (err) return cb(err);

      storage.getContentType(
        req,
        file,
        (err, contentType, replacementStream) => {
          if (err) return cb(err);

          cb.call(storage, null, {
            bucket: values[0],
            key: values[1],
            acl: values[2],
            metadata: values[3],
            cacheControl: values[4],
            shouldTransform: values[5],
            contentDisposition: values[6],
            storageClass: values[7],
            contentType: contentType,
            replacementStream: replacementStream,
            serverSideEncryption: values[8],
            sseKmsKeyId: values[9],
          });
        }
      );
    }
  );
}

class S3Storage {
  s3: S3Client;
  getBucket;
  getKey;
  getAcl;
  getContentType;
  getMetadata;
  getCacheControl;
  getShouldTransform;
  getTransforms;
  getContentDisposition;
  getStorageClass;
  getSSE;
  getSSEKMS;

  constructor(opts) {
    switch (typeof opts.s3) {
      case 'object':
        this.s3 = opts.s3;
        break;
      default:
        throw new TypeError('Expected opts.s3 to be object');
    }
    switch (typeof opts.bucket) {
      case 'function':
        this.getBucket = opts.bucket;
        break;
      case 'string':
        this.getBucket = staticValue(opts.bucket);
        break;
      case 'undefined':
        throw new Error('bucket is required');
      default:
        throw new TypeError(
          'Expected opts.bucket to be undefined, string or function'
        );
    }
    switch (typeof opts.key) {
      case 'function':
        this.getKey = opts.key;
        break;
      case 'undefined':
        this.getKey = defaultKey;
        break;
      default:
        throw new TypeError('Expected opts.key to be undefined or function');
    }
    switch (typeof opts.acl) {
      case 'function':
        this.getAcl = opts.acl;
        break;
      case 'string':
        this.getAcl = staticValue(opts.acl);
        break;
      case 'undefined':
        this.getAcl = defaultAcl;
        break;
      default:
        throw new TypeError(
          'Expected opts.acl to be undefined, string or function'
        );
    }
    switch (typeof opts.contentType) {
      case 'function':
        this.getContentType = opts.contentType;
        break;
      case 'undefined':
        this.getContentType = defaultContentType;
        break;
      default:
        throw new TypeError(
          'Expected opts.contentType to be undefined or function'
        );
    }
    switch (typeof opts.metadata) {
      case 'function':
        this.getMetadata = opts.metadata;
        break;
      case 'undefined':
        this.getMetadata = defaultMetadata;
        break;
      default:
        throw new TypeError(
          'Expected opts.metadata to be undefined or function'
        );
    }
    switch (typeof opts.cacheControl) {
      case 'function':
        this.getCacheControl = opts.cacheControl;
        break;
      case 'string':
        this.getCacheControl = staticValue(opts.cacheControl);
        break;
      case 'undefined':
        this.getCacheControl = defaultCacheControl;
        break;
      default:
        throw new TypeError(
          'Expected opts.cacheControl to be undefined, string or function'
        );
    }
    switch (typeof opts.shouldTransform) {
      case 'function':
        this.getShouldTransform = opts.shouldTransform;
        break;
      case 'boolean':
        this.getShouldTransform = staticValue(opts.shouldTransform);
        break;
      case 'undefined':
        this.getShouldTransform = defaultShouldTransform;
        break;
      default:
        throw new TypeError(
          'Expected opts.shouldTransform to be undefined, boolean or function'
        );
    }
    switch (typeof opts.transforms) {
      case 'object':
        this.getTransforms = opts.transforms;
        break;
      case 'undefined':
        this.getTransforms = defaultTransforms;
        break;
      default:
        throw new TypeError(
          'Expected opts.transforms to be undefined or object'
        );
    }
    this.getTransforms.map(function (transform, i) {
      switch (typeof transform.key) {
        case 'function':
          break;
        case 'string':
          transform.key = staticValue(transform.key);
          break;
        case 'undefined':
          transform.key = defaultKey;
          break;
        default:
          throw new TypeError(
            'Expected opts.transform[].key to be unedefined, string or function'
          );
      }
      switch (typeof transform.transform) {
        case 'function':
          break;
        default:
          throw new TypeError(
            'Expected opts.transform[].transform to be function'
          );
      }
      return transform;
    });
    switch (typeof opts.contentDisposition) {
      case 'function':
        this.getContentDisposition = opts.contentDisposition;
        break;
      case 'string':
        this.getContentDisposition = staticValue(opts.contentDisposition);
        break;
      case 'undefined':
        this.getContentDisposition = defaultContentDisposition;
        break;
      default:
        throw new TypeError(
          'Expected opts.contentDisposition to be undefined, string or function'
        );
    }
    switch (typeof opts.storageClass) {
      case 'function':
        this.getStorageClass = opts.storageClass;
        break;
      case 'string':
        this.getStorageClass = staticValue(opts.storageClass);
        break;
      case 'undefined':
        this.getStorageClass = defaultStorageClass;
        break;
      default:
        throw new TypeError(
          'Expected opts.storageClass to be undefined, string or function'
        );
    }
    switch (typeof opts.serverSideEncryption) {
      case 'function':
        this.getSSE = opts.serverSideEncryption;
        break;
      case 'string':
        this.getSSE = staticValue(opts.serverSideEncryption);
        break;
      case 'undefined':
        this.getSSE = defaultSSE;
        break;
      default:
        throw new TypeError(
          'Expected opts.serverSideEncryption to be undefined, string or function'
        );
    }
    switch (typeof opts.sseKmsKeyId) {
      case 'function':
        this.getSSEKMS = opts.sseKmsKeyId;
        break;
      case 'string':
        this.getSSEKMS = staticValue(opts.sseKmsKeyId);
        break;
      case 'undefined':
        this.getSSEKMS = defaultSSEKMS;
        break;
      default:
        throw new TypeError(
          'Expected opts.sseKmsKeyId to be undefined, string, or function'
        );
    }
  }

  _handleFile = (req, file, cb) => {
    var storage = this;
    collect(this, req, file, function (err, opts) {
      if (err) return cb(err);

      if (!opts.shouldTransform) {
        storage.directUpload(opts, file, cb);
      } else {
        storage.transformUpload(opts, req, file, cb);
      }
    });
  };

  directUpload = (opts, file, cb) => {
    var currentSize = 0;

    var params = {
      Bucket: opts.bucket,
      Key: opts.key,
      ACL: opts.acl,
      CacheControl: opts.cacheControl,
      ContentType: opts.contentType,
      Metadata: opts.metadata,
      StorageClass: opts.storageClass,
      ServerSideEncryption: opts.serverSideEncryption,
      SSEKMSKeyId: opts.sseKmsKeyId,
      Body: opts.replacementStream || file.stream,
    };

    if (opts.contentDisposition) {
      params['ContentDisposition'] = opts.contentDisposition;
    }

    var upload = new Upload({ client: this.s3, params });

    upload.on('httpUploadProgress', (progress) => {
      if (progress.total) {
        currentSize = progress.total;
      }
    });

    upload
      .done()
      .then((output) => {
        return cb(null, {
          size: currentSize,
          bucket: opts.bucket,
          key: opts.key,
          acl: opts.acl,
          contentType: opts.contentType,
          contentDisposition: opts.contentDisposition,
          storageClass: opts.storageClass,
          serverSideEncryption: opts.serverSideEncryption,
          metadata: opts.metadata,
          location: output.Location,
          etag: output.ETag,
          versionId: output.VersionId,
        });
      })
      .catch((reason) => cb(reason));
  };

  transformUpload = (opts, req, file, cb) => {
    var storage = this;
    var results: any[] = [];
    parallel(
      storage.getTransforms.map((transform) =>
        transform.key.bind(storage, req, file)
      ),
      (err, keys) => {
        if (err) return cb(err);

        keys.forEach((key: string, i: number) => {
          var currentSize = 0;
          storage.getTransforms[i].transform(req, file, async (err, piper) => {
            if (err) return cb(err);

            const params = {
              Bucket: opts.bucket,
              Key: key,
              ACL: opts.acl,
              CacheControl: opts.cacheControl,
              ContentType: opts.contentType,
              Metadata: opts.metadata,
              StorageClass: opts.storageClass,
              ServerSideEncryption: opts.serverSideEncryption,
              SSEKMSKeyId: opts.sseKmsKeyId,
              Body: (opts.replacementStream || file.stream).pipe(piper),
            };

            var upload = new Upload({ client: this.s3, params });

            upload.on('httpUploadProgress', function (ev) {
              if (ev.total) currentSize = ev.total;
            });

            upload
              .done()
              .then((output) => {
                results.push({
                  id: storage.getTransforms[i].id || i,
                  size: currentSize,
                  bucket: opts.bucket,
                  key: key,
                  acl: opts.acl,
                  contentType: opts.contentType,
                  contentDisposition: opts.contentDisposition,
                  storageClass: opts.storageClass,
                  serverSideEncryption: opts.serverSideEncryption,
                  metadata: opts.metadata,
                  location: output.Location,
                  etag: output.ETag,
                  versionId: output.VersionId,
                });

                if (results.length === keys.length) {
                  return cb(null, { transforms: results });
                }
              })
              .catch((reason) => cb(reason));
          });
        });
      }
    );
  };

  _removeFile = (req, file, cb) => {
    const deleteCommandInput: DeleteObjectCommandInput = {
      Bucket: file.bucket,
      Key: file.key,
    };
    const deleteObjectCommand: DeleteObjectCommand = new DeleteObjectCommand(
      deleteCommandInput
    );
    this.s3.send(deleteObjectCommand).then((output) => cb(output));
  };
}

export default function (opts) {
  return new S3Storage(opts);
}

export const AUTO_CONTENT_TYPE = autoContentType;
export const DEFAULT_CONTENT_TYPE = defaultContentType;
