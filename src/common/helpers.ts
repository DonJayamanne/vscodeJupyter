import { ParsedIOMessage } from '../contracts';
import { KernelMessage } from '@jupyterlab/services';
const tmp = require('tmp');

export interface Deferred<T> {
    resolve(value?: T | PromiseLike<T>);
    reject(reason?: any);
    readonly promise: Promise<T>;
    readonly resolved: boolean;
    readonly rejected: boolean;
    readonly completed: boolean;
}

class DeferredImpl<T> implements Deferred<T> {
    private _resolve: (value?: T | PromiseLike<T>) => void;
    private _reject: (reason?: any) => void;
    private _resolved: boolean = false;
    private _rejected: boolean = false;
    private _promise: Promise<T>;
    constructor(private scope: any = null) {
        this._promise = new Promise<T>((res, rej) => {
            this._resolve = res;
            this._reject = rej;
        });
    }
    resolve(value?: T | PromiseLike<T>) {
        this._resolve.apply(this.scope ? this.scope : this, arguments);
        this._resolved = true;
    }
    reject(reason?: any) {
        this._reject.apply(this.scope ? this.scope : this, arguments);
        this._rejected = true;
    }
    get promise(): Promise<T> {
        return this._promise;
    }
    get resolved(): boolean {
        return this._resolved;
    }
    get rejected(): boolean {
        return this._rejected;
    }
    get completed(): boolean {
        return this._rejected || this._resolved;
    }
}
export function createDeferred<T>(scope: any = null): Deferred<T> {
    return new DeferredImpl<T>(scope);
}

export class Helpers {
    public static parseIOMessage(message: KernelMessage.IIOPubMessage): ParsedIOMessage {
        if (!Helpers.isValidMessag(message)) {
            return;
        }
        const msg_id = (message.parent_header as any).msg_id;
        if (!msg_id) {
            return;
        }
        let result = Helpers.parseDisplayIOMessage(message);
        if (!result) {
            result = Helpers.parseResultIOMessage(message);
        }
        if (!result) {
            result = Helpers.parseErrorIOMessage(message);
        }
        if (!result) {
            result = Helpers.parseStreamIOMessage(message);
        }
        return result;
    };

    public static isValidMessag(message: KernelMessage.IIOPubMessage) {
        if (!message) {
            return false;
        }
        if (!message.content) {
            return false;
        }
        if ((message.content as any).execution_state === 'starting') {
            return false;
        }
        if (!message.parent_header) {
            return false;
        }
        if (typeof (message.parent_header as any).msg_id !== 'string') {
            return false;
        }
        if (typeof (message.parent_header as any).msg_type !== 'string') {
            return false;
        }
        if (!message.header) {
            return false;
        }
        if (typeof message.header.msg_id !== 'string') {
            return false;
        }
        if (typeof message.header.msg_type !== 'string') {
            return false;
        }
        return true;
    };

    private static parseDisplayIOMessage(message: KernelMessage.IIOPubMessage): ParsedIOMessage {
        if (message.header.msg_type === 'display_data') {
            return Helpers.parseDataMime((message.content as any).data);
        }
        return;
    }

    private static parseResultIOMessage(message: KernelMessage.IIOPubMessage): ParsedIOMessage {
        const msg_type = message.header.msg_type;
        if (msg_type === 'execute_result' || msg_type === 'pyout' || msg_type === 'execution_result') {
            return Helpers.parseDataMime((message.content as any).data);
        }
        return null;
    }

    private static parseDataMime(data: KernelMessage.IIOPubMessage): ParsedIOMessage {
        if (!data) {
            return null;
        }
        const mime = Helpers.getMimeType(data);
        if (typeof mime !== 'string') {
            return null;
        }
        let result;
        if (mime === 'text/plain') {
            result = {
                data: {
                    'text/plain': data[mime]
                },
                type: 'text',
                stream: 'pyout'
            };
            result.data['text/plain'] = result.data['text/plain'].trim();
        } else {
            result = {
                data: {},
                type: mime,
                stream: 'pyout'
            };
            result.data[mime] = data[mime];
        }
        return result;
    }

    private static getMimeType(data: KernelMessage.IIOPubMessage): string {
        const imageMimes = Object.getOwnPropertyNames(data).filter(mime => {
            return typeof mime === 'string' && mime.startsWith('image/');
        });
        let mime;
        if (data.hasOwnProperty('text/html')) {
            mime = 'text/html';
        } else if (data.hasOwnProperty('image/svg+xml')) {
            mime = 'image/svg+xml';
        } else if (!(imageMimes.length === 0)) {
            mime = imageMimes[0];
        } else if (data.hasOwnProperty('text/markdown')) {
            mime = 'text/markdown';
        } else if (data.hasOwnProperty('application/pdf')) {
            mime = 'application/pdf';
        } else if (data.hasOwnProperty('text/latex')) {
            mime = 'text/latex';
        } else if (data.hasOwnProperty('application/javascript')) {
            mime = 'application/javascript';
        } else if (data.hasOwnProperty('application/json')) {
            mime = 'application/json';
        } else if (data.hasOwnProperty('text/plain')) {
            mime = 'text/plain';
        }
        return mime;
    }

    private static parseErrorIOMessage(message: KernelMessage.IIOPubMessage): ParsedIOMessage {
        const msg_type = message.header.msg_type;
        if (msg_type === 'error' || msg_type === 'pyerr') {
            return Helpers.parseErrorMessage(message);
        }
        return null;
    }

    private static parseErrorMessage(message: KernelMessage.IIOPubMessage): ParsedIOMessage {
        let errorString: string;
        const messageContent = (message.content as any);
        const ename = typeof messageContent.ename === 'string' ? messageContent.ename : '';
        const evalue = typeof messageContent.evalue === 'string' ? messageContent.evalue : '';
        const errorMessage = ename + ': ' + evalue;
        errorString = errorMessage;
        try {
            errorString = messageContent.traceback.join('\n');
        } catch (err) {
        }
        return {
            data: {
                'text/plain': errorString,
            },
            message: errorMessage,
            type: 'text',
            stream: 'error'
        };
    }

    private static parseStreamIOMessage(message: KernelMessage.IIOPubMessage): ParsedIOMessage {
        let result;
        const messageContent = (message.content as any);
        const idents = (message as any).idents;
        if (message.header.msg_type === 'stream') {
            result = {
                data: {
                    'text/plain': typeof messageContent.text === 'string' ? messageContent.text : messageContent.data
                },
                type: 'text',
                stream: messageContent.name
            };
        } else if (idents === 'stdout' || idents === 'stream.stdout' || messageContent.name === 'stdout') {
            result = {
                data: {
                    'text/plain': typeof messageContent.text === 'string' ? messageContent.text : messageContent.data
                },
                type: 'text',
                stream: 'stdout'
            };
        } else if (idents === 'stderr' || idents === 'stream.stderr' || messageContent.name === 'stderr') {
            result = {
                data: {
                    'text/plain': typeof messageContent.text === 'string' ? messageContent.text : messageContent.data
                },
                type: 'text',
                stream: 'stderr'
            };
        }
        if (result) {
            result.data['text/plain'] = result.data['text/plain'].trim();
        }
        return result;
    }
}


export function createTemporaryFile(extension: string, temporaryDirectory?: string): Promise<{ filePath: string, cleanupCallback: Function }> {
    let options: any = { postfix: extension };
    if (temporaryDirectory) {
        options.dir = temporaryDirectory;
    }

    return new Promise<{ filePath: string, cleanupCallback: Function }>((resolve, reject) => {
        tmp.file(options, function _tempFileCreated(err, tmpFile, fd, cleanupCallback) {
            if (err) {
                return reject(err);
            }
            resolve({ filePath: tmpFile, cleanupCallback: cleanupCallback });
        });
    });
}

export function isNotInstalledError(error: Error): boolean {
    return typeof (error) === 'object' && error !== null && ((<any>error).code === 'ENOENT' || (<any>error).code === 127);
}
