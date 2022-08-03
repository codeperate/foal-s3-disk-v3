import { Readable } from 'stream';

// 3p
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Config, generateToken } from '@foal/core';
import { Disk, FileDoesNotExist } from '@foal/storage';

/**
 * File storage to read, write and delete files in AWS S3.
 *
 * @export
 * @class S3Disk
 * @extends {Disk}
 */
export class S3Disk extends Disk {
    private s3: S3Client;
    async write(dirname: string, content: Buffer | NodeJS.ReadableStream, options: { name?: string } | { extension?: string } = {}): Promise<{ path: string }> {
        let name = this.hasName(options) ? options.name : await generateToken();

        if (this.hasExtension(options)) {
            name = `${name}.${options.extension}`;
        }

        const path = `${dirname}/${name}`;
        const ext = name.split('.')[name.split('.').length - 1];
        await this.getS3().send(
            new PutObjectCommand({
                Body: content,
                Bucket: this.getBucket(),
                Key: path,
                ContentType: this.getContentType(ext),
                ServerSideEncryption: Config.get('settings.disk.s3.serverSideEncryption', 'string'),
            }),
        );
        return { path };
    }

    async read<C extends 'buffer' | 'stream'>(
        path: string,
        content: C,
    ): Promise<{
        file: C extends 'buffer' ? Buffer : C extends 'stream' ? Readable : never;
        size: number;
    }> {
        try {
            if (content === 'buffer') {
                const { Body, ContentLength } = await this.getS3().send(
                    new GetObjectCommand({
                        Bucket: this.getBucket(),
                        Key: path,
                    }),
                );
                return {
                    file: Body as any,
                    size: ContentLength as number,
                };
            }

            const { ContentLength } = await this.getS3().send(
                new HeadObjectCommand({
                    Bucket: this.getBucket(),
                    Key: path,
                }),
            );

            const stream = await this.getS3().send(new GetObjectCommand({ Bucket: this.getBucket(), Key: path }));

            // Do not kill the process (and crash the server) if the stream emits an error.
            // Note: users can still add other listeners to the stream to "catch" the error.
            // Note: error streams are unlikely to occur ("headObject" may have thrown these errors previously).
            // TODO: test this line.
            //.on('error', () => {});

            return {
                file: stream.Body as any,
                size: ContentLength as number,
            };
        } catch (error: any) {
            if (error.code === 'NoSuchKey' || error.code === 'NotFound') {
                throw new FileDoesNotExist(path);
            }
            // TODO: test this line.
            throw error;
        }
    }

    async readSize(path: string): Promise<number> {
        try {
            const { ContentLength } = await this.getS3().send(new HeadObjectCommand({ Bucket: this.getBucket(), Key: path }));
            return ContentLength as number;
        } catch (error: any) {
            if (error.code === 'NotFound') {
                throw new FileDoesNotExist(path);
            }
            // TODO: test this line.
            throw error;
        }
    }

    async delete(path: string): Promise<void> {
        await this.getS3().send(
            new DeleteObjectCommand({
                Bucket: this.getBucket(),
                Key: path,
            }),
        );
    }

    private getBucket(): string {
        return Config.getOrThrow('settings.disk.s3.bucket', 'string', 'You must provide a bucket name when using AWS S3 file storage (S3Disk).');
    }

    private getS3(): S3Client {
        if (!this.s3) {
            this.s3 = new S3Client({
                credentials: {
                    accessKeyId: Config.get('settings.aws.accessKeyId', 'string'),
                    secretAccessKey: Config.get('settings.aws.secretAccessKey', 'string'),
                },
                endpoint: Config.get('settings.aws.endpoint', 'string'),
                region: Config.get('settings.aws.region', 'string'),
            });
        }
        return this.s3;
    }
    private getContentType(ext) {
        const extMap = Config.get('settings.disk.s3.extMap') || {
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
