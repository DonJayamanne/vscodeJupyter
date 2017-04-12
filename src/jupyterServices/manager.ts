import * as vscode from 'vscode';
import { EventEmitter } from 'events';
import { formatErrorForLogging } from '../common/utils';
import { execPythonFileSync } from '../common/procUtils';
import { createDeferred } from '../common/helpers';
import { Kernel } from '@jupyterlab/services';
import { LanguageProviders } from '../common/languageProvider';
import { MessageParser } from '../jupyterServices/jupyter_client/resultParser';
import { ParsedIOMessage } from '../contracts';
import * as Rx from 'rx';
import { NotebookManager } from '../jupyterServices/notebook/manager';
import { ProgressBar } from '../display/progressBar';
import { KernelManagerImpl } from "../kernel-manager";
const semver = require('semver');

export class Manager extends KernelManagerImpl {
    constructor(outputChannel: vscode.OutputChannel, notebookManager: NotebookManager) {
        super(outputChannel, notebookManager, null);
    }

    private getNotebook() {
        return this.notebookManager.getNotebook();
    }

    public runCode(code: string, kernel: Kernel.IKernel, messageParser: MessageParser): Promise<any> {
        let def = createDeferred<any>();
        let future: Kernel.IFuture;
        let observable = new Rx.Subject<ParsedIOMessage>();
        try {
            future = kernel.requestExecute({ code: code, stop_on_error: false });
            future.onDone = () => {
                def.resolve();
            };
            future.onIOPub = (msg) => {
                messageParser.processResponse(msg, observable);
            };
        }
        catch (_ex) {
            this.executeStartupCode
        }
        observable.subscribe(msg => {
            if (msg.type === 'text' && msg.data && msg.data['text/plain']) {
                if (msg.message) {
                    this.outputChannel.appendLine(msg.message);
                }
                this.outputChannel.appendLine(msg.data['text/plain']);
            }
        });
        return def.promise;
    }
    public async startKernel(kernelSpec: Kernel.ISpecModel, language: string): Promise<Kernel.IKernel> {
        let nb = await this.getNotebook();
        if (!nb || nb.baseUrl.length === 0) {
            return Promise.reject('Notebook not selected/started');
        }
        await this.destroyRunningKernelFor(language);
        let options: Kernel.IOptions = { baseUrl: nb.baseUrl, name: kernelSpec.name };
        if (nb.token) { options.token = nb.token };
        let promise = Kernel.startNew(options)
            .then(kernel => {
                return this.executeStartupCode(language, kernel).then(() => {
                    this.setRunningKernelFor(language, kernel);
                    return kernel;
                });
            });
        ProgressBar.Instance.setProgressMessage('Starting Kernel', promise);
        return promise;
    }
    public getKernelSpecsFromJupyter(): Promise<Kernel.ISpecModels> {
        return this.getNotebook().then(nb => {
            if (!nb || nb.baseUrl.length === 0) {
                return Promise.reject<Kernel.ISpecModels>('Notebook not selected/started');
            }
            let options: Kernel.IOptions = { baseUrl: nb.baseUrl };
            if (nb.token) { options.token = nb.token };
            let promise = Kernel.getSpecs(options).then(specs => {
                this._defaultKernel = specs.default;
                return specs;
            });
            ProgressBar.Instance.setProgressMessage('Getting Kernel Specs', promise);
            return promise;
        });
    }
}