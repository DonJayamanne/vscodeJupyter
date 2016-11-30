import * as vscode from 'vscode';
import { EventEmitter } from 'events';
import { formatErrorForLogging } from './common/utils';
import { createDeferred } from './common/helpers';
import { Kernel } from '@jupyterlab/services';
import { LanguageProviders } from './common/languageProvider';
import { MessageParser } from './jupyter_client/resultParser';
import * as child_process from 'child_process';
import { ParsedIOMessage } from './contracts';
import * as Rx from 'rx';
const ws = require('ws');
const xhr = require('xmlhttprequest');
const requirejs = require('requirejs');
(global as any).requirejs = requirejs;
(global as any).XMLHttpRequest = xhr.XMLHttpRequest;
(global as any).WebSocket = ws;

// The base url of the notebook server.
const BASE_URL = 'http://localhost:8888';

export class KernelManagerImpl extends EventEmitter {
    private _runningKernels: Map<string, Kernel.IKernel>;
    private _kernelSpecs: { [key: string]: Kernel.ISpecModel };
    private _defaultKernel: string;
    private disposables: vscode.Disposable[];
    constructor(private outputChannel: vscode.OutputChannel) {
        super();
        this.disposables = [];
        this._runningKernels = new Map<string, Kernel.IKernel>();
        this._kernelSpecs = {};
    }

    // private notebookChannel: vscode.OutputChannel;
    // private proc: child_process.ChildProcess;
    // private startNotebookServer(): Promise<string> {
    // this.notebookChannel = vscode.window.createOutputChannel('Jupyter Notebook');
    // let jupyterConfig = vscode.workspace.getConfiguration('jupyter');
    // let pythonPath = jupyterConfig.get('pythonPath') as string;

    // if (pythonPath.length === 0) {
    //     let pyConfig = vscode.workspace.getConfiguration('python');
    //     pythonPath = pyConfig.get('pythonPath') as string;
    // }
    // if (pythonPath.length === 0) {
    //     pythonPath = 'python';
    // }

    // return new Promise<string>((resolve, reject) => {
    //     this.proc = child_process.spawn('pythonPath', ['-m', 'notebook', '--NotebookApp.allow_origin="*"', '--no-browser']);
    //     this.proc.stdout.setEncoding('utf8');
    //     this.proc.on('close', (error: Error) => {

    //     });
    //     this.proc.on('error', error => {

    //     });
    //     this.proc.stdout.on('data', (data: string) => {
    //         let lines = data.split('');
    //         if (lines.some(line => line.indexOf('The Jupyter Notebook is running at') >= 0)) {

    //         }
    //     });
    //     this.proc.stdout.on('error', error => {

    //     });
    // });
    // }
    public dispose() {
        this.removeAllListeners();
        this._runningKernels.forEach(kernel => {
            kernel.dispose();
        });
        this._runningKernels.clear();
    }

    public setRunningKernelFor(language: string, kernel: Kernel.IKernel) {
        this._runningKernels.set(language, kernel);
        this.emit('kernelChanged', kernel, language);
        return kernel;
    }

    public destroyRunningKernelFor(language: string): Promise<any> {
        if (!this._runningKernels.has(language)) {
            return Promise.resolve();
        }
        const kernel = this._runningKernels.get(language);
        this._runningKernels.delete(language);

        const def = createDeferred<any>();
        if (kernel) {
            // ignore errors
            kernel.shutdown()
                .catch(() => { })
                .then(() => kernel.dispose())
                .catch(() => { })
                .then(() => def.resolve());
        }
        else {
            def.resolve();
        }

        return def.promise;
    }

    public destroyKerne(kernel: Kernel.IKernel) {
        let def = createDeferred<any>();
        let found = false;
        this._runningKernels.forEach((value, language) => {
            if (value.id === kernel.id) {
                found = true;
                this.destroyRunningKernelFor(language).then(def.resolve.bind(def));
            }
        });

        if (!found) {
            // ignore errors
            kernel.shutdown()
                .catch(() => { })
                .then(() => kernel.dispose())
                .catch(() => { })
                .then(() => def.resolve());
        }

        return def.promise;
    }

    public restartKernel(kernel: Kernel.IKernel): Promise<Kernel.IKernel> {
        return kernel.restart().then(() => {
            return kernel;
        }).catch(reason => {
            let message = 'Failed to start the kernel.';
            if (reason && reason.message) {
                message = reason.message;
            }
            vscode.window.showErrorMessage(message);
            this.outputChannel.appendLine(formatErrorForLogging(reason));
            return Promise.reject(reason);
        });
    }

    public restartRunningKernelFor(language: string): Promise<Kernel.IKernel> {
        const kernel = this._runningKernels.get(language);
        return this.restartKernel(kernel);
    }

    public startKernelFor(language: string): Promise<Kernel.IKernel> {
        return this.getKernelSpecFor(language).then(kernelSpec => {
            return this.startKernel(kernelSpec, language);
        });
    }

    public startExistingKernel(language: string, connection, connectionFile): Promise<Kernel.IKernel> {
        throw new Error('Start Existing Kernel not implemented');
    }

    public startKernel(kernelSpec: Kernel.ISpecModel, language: string): Promise<Kernel.IKernel> {
        this.destroyRunningKernelFor(language);
        return Kernel.startNew({ baseUrl: BASE_URL, name: kernelSpec.name })
            .then(kernel => {
                return this.executeStartupCode(language, kernel).then(() => {
                    return kernel;
                });
            });
    }

    private executeStartupCode(language: string, kernel: Kernel.IKernel): Promise<any> {
        let startupCode = LanguageProviders.getStartupCode(language);
        if (typeof startupCode !== 'string' || startupCode.length === 0) {
            return Promise.resolve();
        }

        let def = createDeferred<any>();
        let messageParser = new MessageParser(this.outputChannel);
        let future = kernel.requestExecute({ code: startupCode, stop_on_error: false });
        let observable = new Rx.Subject<ParsedIOMessage>();
        future.onDone = () => {
            def.resolve();
        };
        future.onIOPub = (msg) => {
            messageParser.processResponse(msg, observable);
        };
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

    public getAllRunningKernels() {
        return this._runningKernels;
    }

    public getRunningKernelFor(language: string): Kernel.IKernel {
        return this._runningKernels.has(language) ? this._runningKernels.get(language) : null;
    }

    public getAllKernelSpecs(): Promise<Kernel.ISpecModel[]> {
        if (Object.keys(this._kernelSpecs).length === 0) {
            return this.updateKernelSpecs().then(() => {
                return Object.keys(this._kernelSpecs).map(key => this._kernelSpecs[key]);
            });
        } else {
            const result = Object.keys(this._kernelSpecs).map(key => this._kernelSpecs[key]);
            return Promise.resolve(result);
        }
    }

    public getAllKernelSpecsFor(language: string): Promise<Kernel.ISpecModel[]> {
        return this.getAllKernelSpecs().then(kernelSpecs => {
            const lowerLang = language.toLowerCase();
            return kernelSpecs.filter(spec => spec.language.toLowerCase() === lowerLang);
        });
    }

    public getKernelSpecFor(language: string): Promise<Kernel.ISpecModel> {
        return this.getAllKernelSpecsFor(language).then(kernelSpecs => {
            if (kernelSpecs.length === 0) {
                throw new Error('Unable to find a kernel for ' + language);
            }
            if (kernelSpecs.length === 1) {
                return kernelSpecs[0];
            }
            let defaultKernel = LanguageProviders.getDefaultKernel(language);
            if (!defaultKernel) {
                return kernelSpecs[0];
            }

            let foundSpec = kernelSpecs.find(spec => {
                if (spec.language.toLowerCase() !== language.toLowerCase()) {
                    return false;
                }
                return (spec.display_name === defaultKernel || spec.name === defaultKernel);
            });
            return foundSpec ? foundSpec : kernelSpecs[0];
        });
    }

    public updateKernelSpecs(): Promise<Kernel.ISpecModels> {
        this._kernelSpecs = {};
        return this.getKernelSpecsFromJupyter().then(kernelSpecsFromJupyter => {
            this._kernelSpecs = kernelSpecsFromJupyter.kernelspecs;
            if (Object.keys(this._kernelSpecs).length === 0) {
                throw new Error('No kernel specs found, Install or update IPython/Jupyter to a later version');
            }
            return kernelSpecsFromJupyter;
        });
    }

    public getKernelSpecsFromJupyter(): Promise<Kernel.ISpecModels> {
        return Kernel.getSpecs({ baseUrl: BASE_URL }).then(specs => {
            this._defaultKernel = specs.default;
            return specs;
        });
        // return this.jupyterClient.getAllKernelSpecs();
    }
}