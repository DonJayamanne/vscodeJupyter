import * as vscode from 'vscode';
import { EventEmitter } from 'events';
import { formatErrorForLogging } from './common/utils';
import { createDeferred } from './common/helpers';
import { Kernel } from '@jupyterlab/services';
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
                return this.executeStartupCode(kernel).then(() => {
                    return kernel;
                });
            });
    }

    private executeStartupCode(kernel: Kernel.IKernel): Promise<any> {
        // TODO: settings for startup code
        // if (pythonSettings.jupyter.startupCode.length === 0) {
        return Promise.resolve();
        // }
        // const suffix = ' ' + os.EOL;
        // let startupCode = pythonSettings.jupyter.startupCode.join(suffix) + suffix;
        // return new Promise<any>((resolve, reject) => {
        //     let errorMessage = 'Failed to execute kernel startup code. ';
        //     kernel.execute(startupCode).subscribe(result => {
        //         if (result.stream === 'error' && result.type === 'text' && typeof result.message === 'string') {
        //             errorMessage += 'Details: ' + result.message;
        //         }
        //         if (result.stream === 'status' && result.type === 'text' && result.data === 'error') {
        //             this.outputChannel.appendLine(errorMessage);
        //             vscode.window.showWarningMessage(errorMessage);
        //         }
        //     }, reason => {
        //         if (reason instanceof KernelRestartedError || reason instanceof KernelShutdownError) {
        //             return resolve();
        //         }
        //         // It doesn't matter if startup code execution Failed
        //         // Possible they have placed some stuff that is invalid or we have some missing packages (e.g. matplot lib)
        //         this.outputChannel.appendLine(formatErrorForLogging(reason));
        //         vscode.window.showWarningMessage(errorMessage);
        //         resolve();
        //     }, () => {
        //         resolve();
        //     });
        // });
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
            // Todo: default kernel in config
            // this._defaultKernel
            // if (pythonSettings.jupyter.defaultKernel.length > 0) {
            //     const defaultKernel = kernelSpecs.find(spec => spec.display_name === pythonSettings.jupyter.defaultKernel);
            //     if (defaultKernel) {
            //         return defaultKernel;
            //     }
            // }
            return kernelSpecs[0];
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