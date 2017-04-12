// http://jupyter-client.readthedocs.io/en/latest/messaging.html#to-do
import { Kernel, KernelMessage, IAjaxSettings } from '@jupyterlab/services';
import { ISignal, defineSignal } from "phosphor/lib/core/signaling";
import { JupyterClientAdapter } from "./main";

import * as vscode from 'vscode';
import { KernelEvents, ParsedIOMessage } from '../contracts';
import * as Rx from 'rx';
import { IJupyterClientAdapter } from "./contracts";
import { IDisposable } from "phosphor/lib/core/disposable";

import { KernelFutureHandler } from '@jupyterlab/services/lib/kernel/future';

export abstract class KernelImpl extends vscode.Disposable implements KernelEvents, Kernel.IKernel {
    private watchCallbacks: any[];
    constructor(public readonly kernelUUID: string, public kernelSpec: Readonly<Kernel.ISpecModel>, protected jupyterClient: IJupyterClientAdapter) {
        super(() => { });
        this.watchCallbacks = [];

        this.id = this.kernelUUID;
        this.name = this.kernelSpec.name;
        this.baseUrl = '<unknown>';
    }

    // public _onStatusChange = new vscode.EventEmitter<[Kernel.ISpecModel, string]>();
    // get onStatusChange(): vscode.Event<[Kernel.ISpecModel, string]> {
    //     return this._onStatusChange.event;
    // }
    protected raiseOnStatusChange(status: string) {
        //TODO:
        // this._onStatusChange.fire([this.kernelSpec, status]);
        this.status = <Kernel.Status>status;
    }

    public addWatchCallback(watchCallback) {
        return this.watchCallbacks.push(watchCallback);
    };

    public _callWatchCallbacks() {
        return this.watchCallbacks.forEach(watchCallback => {
            watchCallback();
        });
    };

    public abstract execute(code: string): Rx.IObservable<ParsedIOMessage>;

    // Start of IKernel
    terminated: ISignal<Kernel.IKernel, void>;
    statusChanged: ISignal<Kernel.IKernel, Kernel.Status>;
    iopubMessage: ISignal<Kernel.IKernel, KernelMessage.IIOPubMessage>;
    unhandledMessage: ISignal<Kernel.IKernel, KernelMessage.IMessage>;
    id: string;
    name: string;
    model: Kernel.IModel;
    username: string;
    clientId: string;
    baseUrl: string;
    ajaxSettings: IAjaxSettings;
    private _status: Kernel.Status;
    get status(): Kernel.Status {
        return this._status;
    }
    set status(value: Kernel.Status) {
        if (value === this._status) {
            return;
        }
        this._status = value;
        this.statusChanged.emit(value);
    }
    info: KernelMessage.IInfoReply;
    isReady: boolean;
    ready: Promise<void>;
    getSpec(): Promise<Kernel.ISpecModel> {
        return Promise.resolve(this.kernelSpec);
    }
    sendShellMessage(msg: KernelMessage.IShellMessage, expectReply?: boolean, disposeOnDone?: boolean): Kernel.IFuture {
        throw new Error('Method not implemented.');
    }
    interrupt(): Promise<void> {
        throw new Error('Method not implemented.');
    }
    restart(): Promise<void> {
        throw new Error('Method not implemented.');
    }
    reconnect(): Promise<void> {
        throw new Error('Method not implemented.');
    }
    shutdown(): Promise<void> {
        throw new Error('Method not implemented.');
    }
    requestKernelInfo(): Promise<KernelMessage.IInfoReplyMsg> {
        throw new Error('Method not implemented.');
    }
    requestComplete(content: KernelMessage.ICompleteRequest): Promise<KernelMessage.ICompleteReplyMsg> {
        throw new Error('Method not implemented.');
    }
    requestInspect(content: KernelMessage.IInspectRequest): Promise<KernelMessage.IInspectReplyMsg> {
        throw new Error('Method not implemented.');
    }
    requestHistory(content: KernelMessage.IHistoryRequest): Promise<KernelMessage.IHistoryReplyMsg> {
        throw new Error('Method not implemented.');
    }
    requestExecute(content: KernelMessage.IExecuteRequest, disposeOnDone?: boolean): Kernel.IFuture {
        throw new Error('Method not implemented.');
    }
    requestIsComplete(content: KernelMessage.IIsCompleteRequest): Promise<KernelMessage.IIsCompleteReplyMsg> {
        throw new Error('Method not implemented.');
    }
    requestCommInfo(content: KernelMessage.ICommInfoRequest): Promise<KernelMessage.ICommInfoReplyMsg> {
        throw new Error('Method not implemented.');
    }
    sendInputReply(content: KernelMessage.IInputReply): void {
        throw new Error('Method not implemented.');
    }
    connectToComm(targetName: string, commId?: string): Kernel.IComm {
        throw new Error('Method not implemented.');
    }
    registerCommTarget(targetName: string, callback: (comm: Kernel.IComm, msg: KernelMessage.ICommOpenMsg) => void): IDisposable {
        throw new Error('Method not implemented.');
    }
    registerMessageHook(msgId: string, hook: (msg: KernelMessage.IIOPubMessage) => boolean): IDisposable {
        throw new Error('Method not implemented.');
    }
    isDisposed: boolean;
    dispose(): void {
        throw new Error('Method not implemented.');
    }

}

defineSignal(KernelImpl.prototype, 'statusChanged');