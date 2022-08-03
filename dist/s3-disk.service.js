"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.S3Disk = void 0;
// 3p
const client_s3_1 = require("@aws-sdk/client-s3");
const core_1 = require("@foal/core");
const storage_1 = require("@foal/storage");
/**
 * File storage to read, write and delete files in AWS S3.
 *
 * @export
 * @class S3Disk
 * @extends {Disk}
 */
class S3Disk extends storage_1.Disk {
    s3;
    async write(dirname, content, options = {}) {
        let name = this.hasName(options) ? options.name : await (0, core_1.generateToken)();
        if (this.hasExtension(options)) {
            name = `${name}.${options.extension}`;
        }
        const path = `${dirname}/${name}`;
        const ext = name.split('.')[name.split('.').length - 1];
        await this.getS3().send(new client_s3_1.PutObjectCommand({
            Body: content,
            Bucket: this.getBucket(),
            Key: path,
            ContentType: this.getContentType(ext),
            ServerSideEncryption: core_1.Config.get('settings.disk.s3.serverSideEncryption', 'string'),
        }));
        return { path };
    }
    async read(path, content) {
        try {
            if (content === 'buffer') {
                const { Body, ContentLength } = await this.getS3().send(new client_s3_1.GetObjectCommand({
                    Bucket: this.getBucket(),
                    Key: path,
                }));
                return {
                    file: Body,
                    size: ContentLength,
                };
            }
            const { ContentLength } = await this.getS3().send(new client_s3_1.HeadObjectCommand({
                Bucket: this.getBucket(),
                Key: path,
            }));
            const stream = await this.getS3().send(new client_s3_1.GetObjectCommand({ Bucket: this.getBucket(), Key: path }));
            // Do not kill the process (and crash the server) if the stream emits an error.
            // Note: users can still add other listeners to the stream to "catch" the error.
            // Note: error streams are unlikely to occur ("headObject" may have thrown these errors previously).
            // TODO: test this line.
            //.on('error', () => {});
            return {
                file: stream.Body,
                size: ContentLength,
            };
        }
        catch (error) {
            if (error.code === 'NoSuchKey' || error.code === 'NotFound') {
                throw new storage_1.FileDoesNotExist(path);
            }
            // TODO: test this line.
            throw error;
        }
    }
    async readSize(path) {
        try {
            const { ContentLength } = await this.getS3().send(new client_s3_1.HeadObjectCommand({ Bucket: this.getBucket(), Key: path }));
            return ContentLength;
        }
        catch (error) {
            if (error.code === 'NotFound') {
                throw new storage_1.FileDoesNotExist(path);
            }
            // TODO: test this line.
            throw error;
        }
    }
    async delete(path) {
        await this.getS3().send(new client_s3_1.DeleteObjectCommand({
            Bucket: this.getBucket(),
            Key: path,
        }));
    }
    getBucket() {
        return core_1.Config.getOrThrow('settings.disk.s3.bucket', 'string', 'You must provide a bucket name when using AWS S3 file storage (S3Disk).');
    }
    getS3() {
        if (!this.s3) {
            this.s3 = new client_s3_1.S3Client({
                credentials: {
                    accessKeyId: core_1.Config.get('settings.aws.accessKeyId', 'string'),
                    secretAccessKey: core_1.Config.get('settings.aws.secretAccessKey', 'string'),
                },
                endpoint: core_1.Config.get('settings.aws.endpoint', 'string'),
                region: core_1.Config.get('settings.aws.region', 'string'),
            });
        }
        return this.s3;
    }
    getContentType(ext) {
        const extMap = core_1.Config.get('settings.disk.s3.extMap') || {
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            png: 'image/png',
            gif: 'image/gif',
            webp: 'image/webp',
            svg: 'image/svg+xml',
        };
        return extMap[ext] || 'application/octet-stream';
    }
}
exports.S3Disk = S3Disk;
