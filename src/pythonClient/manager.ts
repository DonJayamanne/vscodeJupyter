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
import { JupyterClientAdapter } from './jupyter_client/main';
import { JupyterClientKernel } from './jupyter_client/jupyter_client_kernel';
import { KernelRestartedError, KernelShutdownError } from './common/errors';

const semver = require('semver');

export class Manager extends KernelManagerImpl {

    public runCodeAsObservable(code: string, kernel: Kernel.IKernel): Rx.Observable<ParsedIOMessage> {
        return this.jupyterClient.runCode(code) as Rx.Observable<ParsedIOMessage>;
    }

    public runCode(code: string, kernel: Kernel.IKernel, messageParser: MessageParser): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            let errorMessage = 'Failed to execute kernel startup code. ';
            this.jupyterClient.runCode(code).subscribe(result => {
                if (result.stream === 'stderr' && result.type === 'text' && typeof result.data['text/plain'] === 'string') {
                    this.outputChannel.appendLine(result.data['text/plain']);
                }
                if (result.stream === 'error' && result.type === 'text' && typeof result.message === 'string') {
                    errorMessage += 'Details: ' + result.message;
                }
                if (result.stream === 'status' && result.type === 'text' && result.data === 'error') {
                    this.outputChannel.appendLine(errorMessage);
                    vscode.window.showWarningMessage(errorMessage);
                }
            }, reason => {
                if (reason instanceof KernelRestartedError || reason instanceof KernelShutdownError) {
                    return resolve();
                }
                // It doesn't matter if startup code execution Failed
                // Possible they have placed some stuff that is invalid or we have some missing packages (e.g. matplot lib)
                this.outputChannel.appendLine(formatErrorForLogging(reason));
                vscode.window.showWarningMessage(errorMessage);
                resolve();
            }, () => {
                resolve();
            });
        });

        // let def = createDeferred<any>();
        // let future: Kernel.IFuture;
        // let observable = new Rx.Subject<ParsedIOMessage>();
        // try {
        //     future = kernel.requestExecute({ code: code, stop_on_error: false });
        //     future.onDone = () => {
        //         def.resolve();
        //     };
        //     future.onIOPub = (msg) => {
        //         messageParser.processResponse(msg, observable);
        //     };
        // }
        // catch (_ex) {
        //     this.executeStartupCode
        // }
        // observable.subscribe(msg => {
        //     if (msg.type === 'text' && msg.data && msg.data['text/plain']) {
        //         if (msg.message) {
        //             this.outputChannel.appendLine(msg.message);
        //         }
        //         this.outputChannel.appendLine(msg.data['text/plain']);
        //     }
        // });
        // return def.promise;
    }

    constructor(outputChannel: vscode.OutputChannel, notebookManager: NotebookManager, jupyterClient: JupyterClientAdapter) {
        super(outputChannel, notebookManager, jupyterClient);
    }

    private getNotebook() {
        return this.notebookManager.getNotebook();
    }

    public async startKernel(kernelSpec: Kernel.ISpecModel, language: string): Promise<Kernel.IKernel> {
        this.destroyRunningKernelFor(language);
        const kernelInfo = await this.jupyterClient.startKernel(kernelSpec);
        const kernelUUID = kernelInfo[0];
        const config = kernelInfo[1];
        const connectionFile = kernelInfo[2];
        const kernel = new JupyterClientKernel(kernelUUID, kernelSpec, config, connectionFile, this.jupyterClient);
        this.setRunningKernelFor(language, kernel);
        await this.executeStartupCode(kernel.kernelSpec.language, kernel);
        return kernel;

        // let nb = await this.getNotebook();
        // if (!nb || nb.baseUrl.length === 0) {
        //     return Promise.reject('Notebook not selected/started');
        // }
        // await this.destroyRunningKernelFor(language);
        // let options: Kernel.IOptions = { baseUrl: nb.baseUrl, name: kernelSpec.name };
        // if (nb.token) { options.token = nb.token };
        // let promise = Kernel.startNew(options)
        //     .then(kernel => {
        //         return this.executeStartupCode(language, kernel).then(() => {
        //             this.setRunningKernelFor(language, kernel);
        //             return kernel;
        //         });
        //     });
        // ProgressBar.Instance.setProgressMessage('Starting Kernel', promise);
        // return promise;
    }
    public getKernelSpecsFromJupyter(): Promise<Kernel.ISpecModels> {
        return this.jupyterClient.getAllKernelSpecs();
    }
}