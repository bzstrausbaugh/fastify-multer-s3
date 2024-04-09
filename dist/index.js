var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// index.ts
import crypto from "node:crypto";
import stream from "node:stream";
import { fileTypeFromBuffer } from "file-type";
import parallel from "run-parallel";
import isSvg from "is-svg";
var staticValue = /* @__PURE__ */ __name((value) => {
  return function(req, file, cb) {
    cb(null, value);
  };
}, "staticValue");
var defaultAcl = staticValue("private");
var defaultContentType = staticValue("application/octet-stream");
var defaultMetadata = staticValue(null);
var defaultCacheControl = staticValue(null);
var defaultShouldTransform = staticValue(false);
var defaultTransforms = [];
var defaultContentDisposition = staticValue(null);
var defaultStorageClass = staticValue("STANDARD");
var defaultSSE = staticValue(null);
var defaultSSEKMS = staticValue(null);
var defaultKey = /* @__PURE__ */ __name((req, file, cb) => {
  crypto.randomBytes(16, function(err, raw) {
    cb(err, err ? void 0 : raw.toString("hex"));
  });
}, "defaultKey");
var autoContentType = /* @__PURE__ */ __name((req, file, cb) => {
  file.stream.once("data", async (firstChunk) => {
    var type = await fileTypeFromBuffer(firstChunk);
    var mime;
    if (type) {
      mime = type.mime;
    } else if (isSvg(firstChunk.toString())) {
      mime = "image/svg+xml";
    } else {
      mime = "application/octet-stream";
    }
    var outStream = new stream.PassThrough();
    outStream.write(firstChunk);
    file.stream.pipe(outStream);
    cb(null, mime, outStream);
  });
}, "autoContentType");
function collect(storage, req, file, cb) {
  parallel([
    storage.getBucket.bind(storage, req, file),
    storage.getKey.bind(storage, req, file),
    storage.getAcl.bind(storage, req, file),
    storage.getMetadata.bind(storage, req, file),
    storage.getCacheControl.bind(storage, req, file),
    storage.getShouldTransform.bind(storage, req, file),
    storage.getContentDisposition.bind(storage, req, file),
    storage.getStorageClass.bind(storage, req, file),
    storage.getSSE.bind(storage, req, file),
    storage.getSSEKMS.bind(storage, req, file)
  ], (err, values) => {
    if (err)
      return cb(err);
    storage.getContentType(req, file, (err2, contentType, replacementStream) => {
      if (err2)
        return cb(err2);
      cb.call(storage, null, {
        bucket: values[0],
        key: values[1],
        acl: values[2],
        metadata: values[3],
        cacheControl: values[4],
        shouldTransform: values[5],
        contentDisposition: values[6],
        storageClass: values[7],
        contentType,
        replacementStream,
        serverSideEncryption: values[8],
        sseKmsKeyId: values[9]
      });
    });
  });
}
__name(collect, "collect");
var S3Storage = class S3Storage2 {
  static {
    __name(this, "S3Storage");
  }
  s3;
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
      case "object":
        this.s3 = opts.s3;
        break;
      default:
        throw new TypeError("Expected opts.s3 to be object");
    }
    switch (typeof opts.bucket) {
      case "function":
        this.getBucket = opts.bucket;
        break;
      case "string":
        this.getBucket = staticValue(opts.bucket);
        break;
      case "undefined":
        throw new Error("bucket is required");
      default:
        throw new TypeError("Expected opts.bucket to be undefined, string or function");
    }
    switch (typeof opts.key) {
      case "function":
        this.getKey = opts.key;
        break;
      case "undefined":
        this.getKey = defaultKey;
        break;
      default:
        throw new TypeError("Expected opts.key to be undefined or function");
    }
    switch (typeof opts.acl) {
      case "function":
        this.getAcl = opts.acl;
        break;
      case "string":
        this.getAcl = staticValue(opts.acl);
        break;
      case "undefined":
        this.getAcl = defaultAcl;
        break;
      default:
        throw new TypeError("Expected opts.acl to be undefined, string or function");
    }
    switch (typeof opts.contentType) {
      case "function":
        this.getContentType = opts.contentType;
        break;
      case "undefined":
        this.getContentType = defaultContentType;
        break;
      default:
        throw new TypeError("Expected opts.contentType to be undefined or function");
    }
    switch (typeof opts.metadata) {
      case "function":
        this.getMetadata = opts.metadata;
        break;
      case "undefined":
        this.getMetadata = defaultMetadata;
        break;
      default:
        throw new TypeError("Expected opts.metadata to be undefined or function");
    }
    switch (typeof opts.cacheControl) {
      case "function":
        this.getCacheControl = opts.cacheControl;
        break;
      case "string":
        this.getCacheControl = staticValue(opts.cacheControl);
        break;
      case "undefined":
        this.getCacheControl = defaultCacheControl;
        break;
      default:
        throw new TypeError("Expected opts.cacheControl to be undefined, string or function");
    }
    switch (typeof opts.shouldTransform) {
      case "function":
        this.getShouldTransform = opts.shouldTransform;
        break;
      case "boolean":
        this.getShouldTransform = staticValue(opts.shouldTransform);
        break;
      case "undefined":
        this.getShouldTransform = defaultShouldTransform;
        break;
      default:
        throw new TypeError("Expected opts.shouldTransform to be undefined, boolean or function");
    }
    switch (typeof opts.transforms) {
      case "object":
        this.getTransforms = opts.transforms;
        break;
      case "undefined":
        this.getTransforms = defaultTransforms;
        break;
      default:
        throw new TypeError("Expected opts.transforms to be undefined or object");
    }
    this.getTransforms.map(function(transform, i) {
      switch (typeof transform.key) {
        case "function":
          break;
        case "string":
          transform.key = staticValue(transform.key);
          break;
        case "undefined":
          transform.key = defaultKey;
          break;
        default:
          throw new TypeError("Expected opts.transform[].key to be unedefined, string or function");
      }
      switch (typeof transform.transform) {
        case "function":
          break;
        default:
          throw new TypeError("Expected opts.transform[].transform to be function");
      }
      return transform;
    });
    switch (typeof opts.contentDisposition) {
      case "function":
        this.getContentDisposition = opts.contentDisposition;
        break;
      case "string":
        this.getContentDisposition = staticValue(opts.contentDisposition);
        break;
      case "undefined":
        this.getContentDisposition = defaultContentDisposition;
        break;
      default:
        throw new TypeError("Expected opts.contentDisposition to be undefined, string or function");
    }
    switch (typeof opts.storageClass) {
      case "function":
        this.getStorageClass = opts.storageClass;
        break;
      case "string":
        this.getStorageClass = staticValue(opts.storageClass);
        break;
      case "undefined":
        this.getStorageClass = defaultStorageClass;
        break;
      default:
        throw new TypeError("Expected opts.storageClass to be undefined, string or function");
    }
    switch (typeof opts.serverSideEncryption) {
      case "function":
        this.getSSE = opts.serverSideEncryption;
        break;
      case "string":
        this.getSSE = staticValue(opts.serverSideEncryption);
        break;
      case "undefined":
        this.getSSE = defaultSSE;
        break;
      default:
        throw new TypeError("Expected opts.serverSideEncryption to be undefined, string or function");
    }
    switch (typeof opts.sseKmsKeyId) {
      case "function":
        this.getSSEKMS = opts.sseKmsKeyId;
        break;
      case "string":
        this.getSSEKMS = staticValue(opts.sseKmsKeyId);
        break;
      case "undefined":
        this.getSSEKMS = defaultSSEKMS;
        break;
      default:
        throw new TypeError("Expected opts.sseKmsKeyId to be undefined, string, or function");
    }
  }
  _handleFile = (req, file, cb) => {
    var storage = this;
    collect(this, req, file, function(err, opts) {
      if (err)
        return cb(err);
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
      Body: opts.replacementStream || file.stream
    };
    if (opts.contentDisposition) {
      params["ContentDisposition"] = opts.contentDisposition;
    }
    var upload = this.s3.upload(params);
    upload.on("httpUploadProgress", function(ev) {
      if (ev.total)
        currentSize = ev.total;
    });
    upload.send(function(err, result) {
      if (err)
        return cb(err);
      cb(null, {
        size: currentSize,
        bucket: opts.bucket,
        key: opts.key,
        acl: opts.acl,
        contentType: opts.contentType,
        contentDisposition: opts.contentDisposition,
        storageClass: opts.storageClass,
        serverSideEncryption: opts.serverSideEncryption,
        metadata: opts.metadata,
        location: result.Location,
        etag: result.ETag,
        versionId: result.VersionId
      });
    });
  };
  transformUpload = (opts, req, file, cb) => {
    var storage = this;
    var results = [];
    parallel(storage.getTransforms.map(function(transform) {
      return transform.key.bind(storage, req, file);
    }), function(err, keys) {
      if (err)
        return cb(err);
      keys.forEach(function(key, i) {
        var currentSize = 0;
        storage.getTransforms[i].transform(req, file, function(err2, piper) {
          if (err2)
            return cb(err2);
          var upload = storage.s3.upload({
            Bucket: opts.bucket,
            Key: key,
            ACL: opts.acl,
            CacheControl: opts.cacheControl,
            ContentType: opts.contentType,
            Metadata: opts.metadata,
            StorageClass: opts.storageClass,
            ServerSideEncryption: opts.serverSideEncryption,
            SSEKMSKeyId: opts.sseKmsKeyId,
            Body: (opts.replacementStream || file.stream).pipe(piper)
          });
          upload.on("httpUploadProgress", function(ev) {
            if (ev.total)
              currentSize = ev.total;
          });
          upload.send(function(err3, result) {
            if (err3)
              return cb(err3);
            results.push({
              id: storage.getTransforms[i].id || i,
              size: currentSize,
              bucket: opts.bucket,
              key,
              acl: opts.acl,
              contentType: opts.contentType,
              contentDisposition: opts.contentDisposition,
              storageClass: opts.storageClass,
              serverSideEncryption: opts.serverSideEncryption,
              metadata: opts.metadata,
              location: result.Location,
              etag: result.ETag
            });
            if (results.length === keys.length) {
              return cb(null, {
                transforms: results
              });
            }
          });
        });
      });
    });
  };
  _removeFile = (req, file, cb) => {
    this.s3.deleteObject({
      Bucket: file.bucket,
      Key: file.key
    }, cb);
  };
};
function multer_s3_transform_2_default(opts) {
  return new S3Storage(opts);
}
__name(multer_s3_transform_2_default, "default");
var AUTO_CONTENT_TYPE = autoContentType;
var DEFAULT_CONTENT_TYPE = defaultContentType;
export {
  AUTO_CONTENT_TYPE,
  DEFAULT_CONTENT_TYPE,
  multer_s3_transform_2_default as default
};
//# sourceMappingURL=index.js.map