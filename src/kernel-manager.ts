import * as vscode from 'vscode';
import { EventEmitter } from 'events';
import { formatErrorForLogging } from './common/utils';
import { execPythonFileSync } from './common/procUtils';
import { createDeferred } from './common/helpers';
import { Kernel } from '@jupyterlab/services';
import { LanguageProviders } from './common/languageProvider';
import { MessageParser } from './jupyterServices/jupyter_client/resultParser';
import { ParsedIOMessage } from './contracts';
import * as Rx from 'rx';
import { NotebookManager } from './jupyterServices/notebook/manager';
import { ProgressBar } from './display/progressBar';
import { JupyterClientAdapter } from "./pythonClient/jupyter_client/main";
const semver = require('semver');

export abstract class KernelManagerImpl extends EventEmitter {
    private _runningKernels: Map<string, Kernel.IKernel>;
    private _kernelSpecs: { [key: string]: Kernel.ISpecModel };
    protected _defaultKernel: string;
    private disposables: vscode.Disposable[];
    constructor(protected outputChannel: vscode.OutputChannel, protected notebookManager: NotebookManager, protected jupyterClient: JupyterClientAdapter) {
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
        language = language.toLowerCase();
        this._runningKernels.set(language, kernel);
        this.emit('kernelChanged', kernel, language);
        return kernel;
    }

    public clearAllKernels() {
        this._runningKernels.clear();
    }
    public destroyRunningKernelFor(language: string): Promise<any> {
        language = language.toLowerCase();
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
        language = language.toLowerCase();
        const kernel = this._runningKernels.get(language);
        return this.restartKernel(kernel);
    }

    public startKernelFor(language: string): Promise<Kernel.IKernel> {
        return this.getKernelSpecFor(language)
            .then(kernelSpec => {
                return this.startKernel(kernelSpec, language);
            });
    }

    public abstract startKernel(kernelSpec: Kernel.ISpecModel, language: string): Promise<Kernel.IKernel>;

    public startExistingKernel(language: string, connection, connectionFile): Promise<Kernel.IKernel> {
        throw new Error('Start Existing Kernel not implemented');
    }

    public abstract runCode(code: string, kernel: Kernel.IKernel, messageParser: MessageParser): Promise<any>;
    public runCodeAsObservable(code: string, kernel: Kernel.IKernel): Rx.Observable<ParsedIOMessage> {
        return null;
    }
    protected executeStartupCode(language: string, kernel: Kernel.IKernel): Promise<any> {
        let startupCode = LanguageProviders.getStartupCode(language);
        if (typeof startupCode !== 'string' || startupCode.length === 0) {
            return Promise.resolve();
        }

        return this.runCode(startupCode, kernel, new MessageParser(this.outputChannel));
        // let def = createDeferred<any>();
        // let messageParser = new MessageParser(this.outputChannel);
        // let future: Kernel.IFuture;
        // let observable = new Rx.Subject<ParsedIOMessage>();
        // try {
        //     future = kernel.requestExecute({ code: startupCode, stop_on_error: false });
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

    public getAllRunningKernels() {
        return this._runningKernels;
    }

    public getRunningKernelFor(language: string): Kernel.IKernel {
        language = language.toLowerCase();
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
                throw new Error('No kernel specs found, Install or update Jupyter to a later version');
            }
            return kernelSpecsFromJupyter;
        });
    }

    public abstract getKernelSpecsFromJupyter(): Promise<Kernel.ISpecModels>;

    private jupyterVersionRequiresAuthToken(): Promise<boolean> {
        return execPythonFileSync('jupyter', ['--version'], __dirname)
            .then(version => {
                version = version.trim();
                if (semver.valid(version) !== version) {
                    throw 'Unable to determine version of Jupyter';
                }
                return semver.gte(version, '4.3.0');
            });
    }
    public static jupyterVersionWorksWithJSServices(outputChannel: vscode.OutputChannel): Promise<boolean> {
        return execPythonFileSync('jupyter', ['notebook', '--version'], __dirname)
            .then(version => {
                version = version.trim();
                if (semver.valid(version) !== version) {
                    outputChannel.appendLine('Unable to determine version of Jupyter, ' + version);
                    return true;
                }
                return semver.gte(version, '4.2.0');
            })
            .catch(error => {
                outputChannel.appendLine('Unable to determine version of Jupyter, ' + error);
                console.error(error);
                return true;
            });
    }
}