/// <reference types="node" />
/// <reference types="node" />
import { Readable } from 'stream';
import { Disk } from '@foal/storage';
/**
 * File storage to read, write and delete files in AWS S3.
 *
 * @export
 * @class S3Disk
 * @extends {Disk}
 */
export declare class S3Disk extends Disk {
    private s3;
    write(dirname: string, content: Buffer | NodeJS.ReadableStream, options?: {
        name?: string;
    } | {
        extension?: string;
    }): Promise<{
        path: string;
    }>;
    read<C extends 'buffer' | 'stream'>(path: string, content: C): Promise<{
        file: C extends 'buffer' ? Buffer : C extends 'stream' ? Readable : never;
        size: number;
    }>;
    readSize(path: string): Promise<number>;
    delete(path: string): Promise<void>;
    private getBucket;
    private getS3;
    private getContentType;
}
