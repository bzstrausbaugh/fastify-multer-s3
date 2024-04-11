/* eslint-env mocha */
import multerS3, { AUTO_CONTENT_TYPE } from '../lib/esm/index.js';

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import extend from 'xtend';
import assert from 'node:assert';
import multer from 'fastify-multer';
import stream from 'node:stream';
import FormData from 'form-data';
import onFinished from 'on-finished';
import MockReq from 'mock-req';
import {
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';

var VALID_OPTIONS = {
  bucket: 'string',
};

var INVALID_OPTIONS = [
  ['numeric key', { key: 1337 }],
  ['string key', { key: 'string' }],
  ['numeric bucket', { bucket: 1337 }],
  ['numeric contentType', { contentType: 1337 }],
];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function setupMock(mock) {
  mock.on(CreateMultipartUploadCommand).resolves({
    ETag: 'mock-etag',
    VersionId: 'mock-version',
  });
  mock.on(UploadPartCommand).resolves({
    ETag: 'mock-etag',
    VersionId: 'mock-version',
  });
  mock.on(PutObjectCommand).resolves({
    ETag: 'mock-etag',
    VersionId: 'mock-version',
  });
}

function submitForm(multer, form, cb) {
  form.getLength(function (err, length) {
    if (err) return cb(err);

    var req = new stream.PassThrough();
    req['complete'] = false;
    form.once('end', function () {
      req['complete'] = true;
    });
    req['headers'] = {
      'content-type': 'multipart/form-data; boundary=' + form.getBoundary(),
      'content-length': length,
    };

    form.pipe(req);

    var request = new MockReq({
      raw: req,
      headers: req['headers'],
    });

    multer(request, null, function (err) {
      onFinished(request, function () {
        cb(err, request);
      });
    });
  });
}

describe('Multer S3', function () {
  let mock;
  let s3;

  beforeEach(() => {
    mock = mockClient(S3Client);
    s3 = new S3Client();
  });
  afterEach(() => {
    if (mock) {
      mock.reset();
    }
  });

  it('is exposed as a function', function () {
    assert.equal(typeof multerS3, 'function');
  });

  INVALID_OPTIONS.forEach(function (testCase) {
    it('throws when given ' + testCase[0], function () {
      function testBody() {
        multerS3(extend(VALID_OPTIONS, testCase[1]));
      }

      assert.throws(testBody, TypeError);
    });
  });

  it('upload files', function (done) {
    setupMock(mock);
    var form = new FormData();
    var storage = multerS3({ s3: s3, bucket: 'test' });
    var upload = multer({ storage: storage });
    var parser = upload.single('image');
    var image = fs.createReadStream(
      path.join(__dirname, 'files', 'ffffff.png')
    );

    form.append('name', 'Multer');
    form.append('image', image);

    submitForm(parser, form, function (err, req) {
      assert.ifError(err);

      assert.equal(req.body.name, 'Multer');

      assert.equal(req.file.fieldname, 'image');
      assert.equal(req.file.originalname, 'ffffff.png');
      assert.equal(req.file.size, 68);
      assert.equal(req.file.bucket, 'test');
      assert.equal(req.file.etag, 'mock-etag');
      assert.equal(req.file.versionId, 'mock-version');
      done();
    });
  });

  it('uploads file with AES256 server-side encryption', function (done) {
    setupMock(mock);

    var form = new FormData();
    var storage = multerS3({
      s3: s3,
      bucket: 'test',
      serverSideEncryption: 'AES256',
    });
    var upload = multer({ storage: storage });
    var parser = upload.single('image');
    var image = fs.createReadStream(
      path.join(__dirname, 'files', 'ffffff.png')
    );

    form.append('name', 'Multer');
    form.append('image', image);

    submitForm(parser, form, function (err, req) {
      assert.ifError(err);

      assert.equal(req.body.name, 'Multer');

      assert.equal(req.file.fieldname, 'image');
      assert.equal(req.file.originalname, 'ffffff.png');
      assert.equal(req.file.size, 68);
      assert.equal(req.file.bucket, 'test');
      assert.equal(req.file.etag, 'mock-etag');
      assert.equal(req.file.versionId, 'mock-version');
      assert.equal(req.file.serverSideEncryption, 'AES256');

      done();
    });
  });

  it('uploads file with AWS KMS-managed server-side encryption', function (done) {
    setupMock(mock);

    var form = new FormData();
    var storage = multerS3({
      s3: s3,
      bucket: 'test',
      serverSideEncryption: 'aws:kms',
    });
    var upload = multer({ storage: storage });
    var parser = upload.single('image');
    var image = fs.createReadStream(
      path.join(__dirname, 'files', 'ffffff.png')
    );

    form.append('name', 'Multer');
    form.append('image', image);

    submitForm(parser, form, function (err, req) {
      assert.ifError(err);

      assert.equal(req.body.name, 'Multer');

      assert.equal(req.file.fieldname, 'image');
      assert.equal(req.file.originalname, 'ffffff.png');
      assert.equal(req.file.size, 68);
      assert.equal(req.file.bucket, 'test');
      assert.equal(req.file.etag, 'mock-etag');
      assert.equal(req.file.versionId, 'mock-version');
      assert.equal(req.file.serverSideEncryption, 'aws:kms');

      done();
    });
  });

  it('uploads PNG file with correct content-type', function (done) {
    setupMock(mock);

    var form = new FormData();
    var storage = multerS3({
      s3: s3,
      bucket: 'test',
      serverSideEncryption: 'aws:kms',
      contentType: AUTO_CONTENT_TYPE,
    });
    var upload = multer({ storage: storage });
    var parser = upload.single('image');
    var image = fs.createReadStream(
      path.join(__dirname, 'files', 'ffffff.png')
    );

    form.append('name', 'Multer');
    form.append('image', image);

    submitForm(parser, form, function (err, req) {
      assert.ifError(err);

      assert.equal(req.body.name, 'Multer');

      assert.equal(req.file.fieldname, 'image');
      assert.equal(req.file.contentType, 'image/png');
      assert.equal(req.file.originalname, 'ffffff.png');
      assert.equal(req.file.size, 68);
      assert.equal(req.file.bucket, 'test');
      assert.equal(req.file.etag, 'mock-etag');
      assert.equal(req.file.versionId, 'mock-version');
      assert.equal(req.file.serverSideEncryption, 'aws:kms');

      done();
    });
  });

  it('uploads SVG file with correct content-type', function (done) {
    setupMock(mock);

    var form = new FormData();
    var storage = multerS3({
      s3: s3,
      bucket: 'test',
      serverSideEncryption: 'aws:kms',
      contentType: AUTO_CONTENT_TYPE,
    });
    var upload = multer({ storage: storage });
    var parser = upload.single('image');
    var image = fs.createReadStream(path.join(__dirname, 'files', 'test.svg'));

    form.append('name', 'Multer');
    form.append('image', image);

    submitForm(parser, form, function (err, req) {
      assert.ifError(err);

      assert.equal(req.body.name, 'Multer');

      assert.equal(req.file.fieldname, 'image');
      assert.equal(req.file.contentType, 'image/svg+xml');
      assert.equal(req.file.originalname, 'test.svg');
      assert.equal(req.file.size, 100);
      assert.equal(req.file.bucket, 'test');
      assert.equal(req.file.etag, 'mock-etag');
      assert.equal(req.file.versionId, 'mock-version');
      assert.equal(req.file.serverSideEncryption, 'aws:kms');

      done();
    });
  });

  it('upload transformed files', function (done) {
    setupMock(mock);

    var form = new FormData();
    var storage = multerS3({
      s3: s3,
      bucket: 'test',
      shouldTransform: true,
      transforms: [
        {
          key: 'test',
          transform: function (req, file, cb) {
            cb(null, new stream.PassThrough());
          },
        },
        {
          key: 'test2',
          transform: function (req, file, cb) {
            cb(null, new stream.PassThrough());
          },
        },
      ],
    });
    var upload = multer({ storage: storage });
    var parser = upload.single('image');
    var image = fs.createReadStream(
      path.join(__dirname, 'files', 'ffffff.png')
    );

    form.append('name', 'Multer');
    form.append('image', image);

    submitForm(parser, form, function (err, req) {
      assert.ifError(err);

      assert.equal(req.body.name, 'Multer');
      assert.equal(req.file.fieldname, 'image');
      assert.equal(req.file.originalname, 'ffffff.png');
      assert.equal(req.file.transforms[0].size, 68);
      assert.equal(req.file.transforms[0].bucket, 'test');
      assert.equal(req.file.transforms[0].key, 'test');
      assert.equal(req.file.transforms[0].etag, 'mock-etag');
      assert.equal(req.file.transforms[0].versionId, 'mock-version');
      assert.equal(req.file.transforms[1].key, 'test2');

      done();
    });
  });

  it('correctly makes call to s3 to delete object', function (done) {
    var storage = multerS3({ s3: s3, bucket: 'test' });
    mock.on(DeleteObjectCommand).resolves({ VersionId: 'mock-object-deleted' });
    const file = { key: 'abcd', bucket: 'test' };
    storage._removeFile({}, file, (response) => {
      assert.equal(response.VersionId, 'mock-object-deleted');
    });

    done();
  });
});
