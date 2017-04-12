import * as vscode from 'vscode';
import { JupyterDisplay } from './display/main';
import { KernelStatus } from './display/kernelStatus';
import { Commands } from './common/constants';
import { JupyterCodeLensProvider } from './editorIntegration/codeLensProvider';
import { JupyterSymbolProvider } from './editorIntegration/symbolProvider';
import { formatErrorForLogging } from './common/utils';
import { CodeHelper } from './common/codeHelper';
import { KernelManagerImpl } from './kernel-manager';
import { ParsedIOMessage } from './contracts';
import { MessageParser } from './jupyterServices/jupyter_client/resultParser';
import { LanguageProviders } from './common/languageProvider';
import * as Rx from 'rx';
import { Kernel } from '@jupyterlab/services';
import { NotebookManager, Notebook, inputNotebookDetails, selectExistingNotebook } from './jupyterServices/notebook/manager';
import { Manager } from './jupyterServices/manager';
import * as PyManager from './pythonClient/manager';
import { Deferred, createDeferred } from './common/helpers';
import { JupyterClientAdapter } from "./pythonClient/jupyter_client/main";

// Todo: Refactor the error handling and displaying of messages
export class Jupyter extends vscode.Disposable {
    public kernelManager: KernelManagerImpl;
    public kernel: Kernel.IKernel = null;
    private status: KernelStatus;
    private disposables: vscode.Disposable[];
    private display: JupyterDisplay;
    private codeLensProvider: JupyterCodeLensProvider;
    private codeHelper: CodeHelper;
    private messageParser: MessageParser;
    private notebookManager: NotebookManager;
    constructor(private outputChannel: vscode.OutputChannel) {
        super(() => { });
        this.disposables = [];
        this.registerCommands();
        this.registerKernelCommands();
        this.messageParser = new MessageParser(this.outputChannel);
        this.activate();
    }
    public dispose() {
        this.kernelManager.dispose();
        this.disposables.forEach(d => d.dispose());
    }
    private kernelCreationPromise: Deferred<KernelManagerImpl>;
    private getKernelManager(): Promise<KernelManagerImpl> {
        return this.createKernelManager();
    }
    private jupyterVersionWorksWithJSServices: boolean;
    private createKernelManager(): Promise<KernelManagerImpl> {
        if (this.kernelCreationPromise) {
            return this.kernelCreationPromise.promise;
        }

        this.kernelCreationPromise = createDeferred<any>();

        KernelManagerImpl.jupyterVersionWorksWithJSServices(this.outputChannel)
            .then(yes => {
                this.jupyterVersionWorksWithJSServices = yes;
                if (yes) {
                    this.kernelManager = new Manager(this.outputChannel, this.notebookManager);
                }
                else {
                    const jupyterClient = new JupyterClientAdapter(this.outputChannel, vscode.workspace.rootPath);
                    this.kernelManager = new PyManager.Manager(this.outputChannel, this.notebookManager, jupyterClient);
                }

                this.kernelCreationPromise.resolve(this.kernelManager);

                // This happend when user changes it from status bar
                this.kernelManager.on('kernelChanged', (kernel: Kernel.IKernel, language: string) => {
                    this.onKernelChanged(kernel);
                });
            })
            .catch(error => {
                this.kernelCreationPromise.reject(error);
                throw error;
            });
    }

    private activate() {
        this.notebookManager = new NotebookManager(this.outputChannel);
        this.disposables.push(this.notebookManager);

        this.createKernelManager();

        this.disposables.push(vscode.window.onDidChangeActiveTextEditor(this.onEditorChanged.bind(this)));
        this.codeLensProvider = new JupyterCodeLensProvider();
        let symbolProvider = new JupyterSymbolProvider();
        this.status = new KernelStatus();
        this.disposables.push(this.status);
        this.display = new JupyterDisplay(this.codeLensProvider, this.outputChannel);
        this.disposables.push(this.display);
        this.codeHelper = new CodeHelper(this.codeLensProvider);

        LanguageProviders.getInstance().on('onLanguageProviderRegistered', (language: string) => {
            this.disposables.push(vscode.languages.registerCodeLensProvider(language, this.codeLensProvider));
            this.disposables.push(vscode.languages.registerDocumentSymbolProvider(language, symbolProvider));
        });
        this.handleNotebookEvents();
    }
    private handleNotebookEvents() {
        this.notebookManager.on('onNotebookChanged', (nb: Notebook) => {
            this.display.setNotebook(nb, this.notebookManager.canShutdown(nb));
        });
        this.notebookManager.on('onShutdown', () => {
            this.getKernelManager().then(k => k.clearAllKernels());
            this.onKernelChanged(null);
        });
    }
    public hasCodeCells(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<boolean> {
        return new Promise<boolean>(resolve => {
            this.codeLensProvider.provideCodeLenses(document, token).then(codeLenses => {
                resolve(Array.isArray(codeLenses) && codeLenses.length > 0);
            }, reason => {
                console.error('Failed to detect code cells in document');
                console.error(reason);
                resolve(false);
            });
        });
    }
    private onEditorChanged(editor: vscode.TextEditor) {
        if (!editor || !editor.document) {
            return;
        }
        this.getKernelManager()
            .then(kernelManager => {
                const kernel = kernelManager.getRunningKernelFor(editor.document.languageId);
                if (this.kernel !== kernel && (this.kernel && kernel && this.kernel.id !== kernel.id)) {
                    return this.onKernelChanged(kernel);
                }
            });
    }
    onKernelChanged(kernel?: Kernel.IKernel) {
        if (kernel) {
            kernel.statusChanged.connect((sender, status) => {
                // We're only interested in status of the active kernels
                if (this.kernel && (sender.id === this.kernel.id)) {
                    this.status.setKernelStatus(status);
                }
            });
        }
        this.kernel = kernel;
        this.status.setActiveKernel(this.kernel);
    }
    executeCode(code: string, language: string): Promise<any> {
        return this.getKernelManager()
            .then(kernelManager => {
                const kernelToUse = kernelManager.getRunningKernelFor(language);
                if (kernelToUse) {
                    if (!this.kernel || kernelToUse.id !== this.kernel.id) {
                        this.onKernelChanged(kernelToUse);
                    }
                    return Promise.resolve(this.kernel);
                }
                else {
                    return kernelManager.startKernelFor(language).then(kernel => {
                        kernelManager.setRunningKernelFor(language, kernel);
                        return kernel;
                    });
                }
            })
            .then(() => {
                return this.executeAndDisplay(this.kernel, code).catch(reason => {
                    const message = typeof reason === 'string' ? reason : reason.message;
                    vscode.window.showErrorMessage(message);
                    this.outputChannel.appendLine(formatErrorForLogging(reason));
                });
            }).catch(reason => {
                let message = typeof reason === 'string' ? reason : reason.message;
                if (reason.xhr && reason.xhr.responseText) {
                    message = reason.xhr && reason.xhr.responseText;
                }
                if (!message) {
                    message = 'Unknown error';
                }
                this.outputChannel.appendLine(formatErrorForLogging(reason));
                vscode.window.showErrorMessage(message, 'View Errors').then(item => {
                    if (item === 'View Errors') {
                        this.outputChannel.show();
                    }
                });
            });
    }
    private executeAndDisplay(kernel: Kernel.IKernel, code: string): Promise<any> {
        let observable = this.executeCodeInKernel(kernel, code);
        return this.display.showResults(observable);
    }
    private executeCodeInKernel(kernel: Kernel.IKernel, code: string): Rx.Observable<ParsedIOMessage> {
        if (this.jupyterVersionWorksWithJSServices) {
            let source = Rx.Observable.create<ParsedIOMessage>(observer => {
                let future = kernel.requestExecute({ code: code });
                future.onDone = () => {
                    observer.onCompleted();
                };
                future.onIOPub = (msg) => {
                    this.messageParser.processResponse(msg, observer);
                };
            });
            return source;
        }
        else {
            return this.kernelManager.runCodeAsObservable(code, kernel);
        }
    }
    async executeSelection(): Promise<any> {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor || !activeEditor.document) {
            return Promise.resolve();
        }
        let code = await this.codeHelper.getSelectedCode();
        let cellRange = await this.codeHelper.getActiveCell();
        let selectedCode = await LanguageProviders.getSelectedCode(activeEditor.document.languageId, code, cellRange);
        return this.executeCode(selectedCode, activeEditor.document.languageId);
    }
    private registerCommands() {
        this.disposables.push(vscode.commands.registerCommand(Commands.Jupyter.ExecuteRangeInKernel, (document: vscode.TextDocument, range: vscode.Range) => {
            if (!document || !range || range.isEmpty) {
                return Promise.resolve();
            }
            const code = document.getText(range);
            return this.executeCode(code, document.languageId);
        }));
        this.disposables.push(vscode.commands.registerCommand(Commands.Jupyter.ExecuteSelectionOrLineInKernel,
            this.executeSelection.bind(this)));
        this.disposables.push(vscode.commands.registerCommand(Commands.Jupyter.Get_All_KernelSpecs_For_Language, (language: string) => {
            if (this.kernelManager) {
                return this.kernelManager.getAllKernelSpecsFor(language);
            }
            return Promise.resolve();
        }));
        this.disposables.push(vscode.commands.registerCommand(Commands.Jupyter.StartKernelForKernelSpeck, (kernelSpec: Kernel.ISpecModel, language: string) => {
            if (this.kernelManager) {
                return this.kernelManager.startKernel(kernelSpec, language);
            }
            return Promise.resolve();
        }));
        this.disposables.push(vscode.commands.registerCommand(Commands.Jupyter.StartNotebook, () => {
            this.notebookManager.startNewNotebook();
        }));
        this.disposables.push(vscode.commands.registerCommand(Commands.Jupyter.ProvideNotebookDetails, () => {
            inputNotebookDetails()
                .then(nb => {
                    if (!nb) { return; }
                    this.notebookManager.setNotebook(nb);
                });
        }));
        this.disposables.push(vscode.commands.registerCommand(Commands.Jupyter.SelectExistingNotebook, () => {
            selectExistingNotebook()
                .then(nb => {
                    if (!nb) { return; }
                    this.notebookManager.setNotebook(nb);
                });
        }));
        this.disposables.push(vscode.commands.registerCommand(Commands.Jupyter.Notebook.ShutDown, () => {
            this.notebookManager.shutdown();
        }));
    }
    private registerKernelCommands() {
        this.disposables.push(vscode.commands.registerCommand(Commands.Jupyter.Kernel.Interrupt, () => {
            this.kernel.interrupt();
        }));
        this.disposables.push(vscode.commands.registerCommand(Commands.Jupyter.Kernel.Restart, () => {
            if (this.kernelManager) {
                this.kernelManager.restartKernel(this.kernel).then(kernel => {
                    kernel.getSpec().then(spec => {
                        this.kernelManager.setRunningKernelFor(spec.language, kernel);
                    });
                    this.onKernelChanged(kernel);
                });
            }
        }));
        this.disposables.push(vscode.commands.registerCommand(Commands.Jupyter.Kernel.Shutdown, (kernel: Kernel.IKernel) => {
            kernel.getSpec().then(spec => {
                this.kernelManager.destroyRunningKernelFor(spec.language);
                this.onKernelChanged();
            });
        }));
    }
};