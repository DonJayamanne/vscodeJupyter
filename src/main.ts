import * as vscode from 'vscode';
import { JupyterDisplay } from './display/main';
import { KernelStatus } from './display/kernelStatus';
import { Commands, PythonLanguage } from './common/constants';
import { JupyterCodeLensProvider } from './editorIntegration/codeLensProvider';
import { JupyterSymbolProvider } from './editorIntegration/symbolProvider';
import { formatErrorForLogging } from './common/utils';
import { CodeHelper } from './common/codeHelper';
import { KernelManagerImpl } from './kernel-manager';
import { ParsedIOMessage } from './contracts';
import { MessageParser } from './jupyter_client/resultParser';
import { LanguageProviders } from './common/languageProvider';
import * as Rx from 'rx';
import { Kernel } from '@jupyterlab/services';
import { NotebookManager } from './notebook-manager';
const ws = require('ws');
const xhr = require('xmlhttprequest');
const requirejs = require('requirejs');
(global as any).requirejs = requirejs;
(global as any).XMLHttpRequest = xhr.XMLHttpRequest;
(global as any).WebSocket = ws;

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
    private createKernelManager() {
        this.kernelManager = new KernelManagerImpl(this.outputChannel, this.notebookManager);

        // This happend when user changes it from status bar
        this.kernelManager.on('kernelChanged', (kernel: Kernel.IKernel, language: string) => {
            this.onKernelChanged(kernel);
        });
    }
    private activate() {
        this.notebookManager = new NotebookManager(this.outputChannel);
        this.disposables.push(this.notebookManager);

        this.createKernelManager();

        this.disposables.push(vscode.window.onDidChangeActiveTextEditor(this.onEditorChanged.bind(this)));
        this.codeLensProvider = new JupyterCodeLensProvider();
        //this.disposables.push(vscode.languages.registerCodeLensProvider(PythonLanguage, this.codeLensProvider));
        let symbolProvider = new JupyterSymbolProvider();
        //this.disposables.push(vscode.languages.registerDocumentSymbolProvider(PythonLanguage, symbolProvider));
        this.status = new KernelStatus();
        this.disposables.push(this.status);
        this.display = new JupyterDisplay(this.codeLensProvider);
        this.disposables.push(this.display);
        this.codeHelper = new CodeHelper(this.codeLensProvider);

        LanguageProviders.getInstance().on('onLanguageProviderRegistered', (language: string) => {
            this.disposables.push(vscode.languages.registerCodeLensProvider(language, this.codeLensProvider));
            this.disposables.push(vscode.languages.registerDocumentSymbolProvider(language, symbolProvider));
        });
        this.handleNotebookEvents();
    }
    private handleNotebookEvents() {
        this.notebookManager.on('onNotebookUrlChanged', (url: string) => {
            this.display.setNotebookUrl(url, this.notebookManager.canShutdown());
        });
        this.notebookManager.on('onShutdown', () => {
            this.kernelManager.clearAllKernels();
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
        const kernel = this.kernelManager.getRunningKernelFor(editor.document.languageId);
        if (this.kernel !== kernel && (this.kernel && kernel && this.kernel.id !== kernel.id)) {
            return this.onKernelChanged(kernel);
        }
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
        // telemetryHelper.sendTelemetryEvent(telemetryContracts.Jupyter.Usage);

        let kernelForExecution: Promise<Kernel.IKernel>;

        const kernelToUse = this.kernelManager.getRunningKernelFor(language);
        if (kernelToUse) {
            if (!this.kernel || kernelToUse.id !== this.kernel.id) {
                this.onKernelChanged(kernelToUse);
            }
            kernelForExecution = Promise.resolve(this.kernel);
        }
        else {
            kernelForExecution = this.kernelManager.startKernelFor(language).then(kernel => {
                this.kernelManager.setRunningKernelFor(language, kernel);
                return kernel;
            });
        }
        return kernelForExecution.then(() => {
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
        this.disposables.push(vscode.commands.registerCommand(Commands.Jupyter.SetExistingNotebook, () => {
            vscode.window.showInputBox({
                prompt: 'Provide the Url of an existing Jupyter Notebook (e.g. http://localhost:888/)',
                value: 'http://localhost:8888/'
            }).then(url => {
                if (!url) {
                    return;
                }
                this.notebookManager.setNotebookUrl(url);
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
            this.kernelManager.restartKernel(this.kernel).then(kernel => {
                kernel.getSpec().then(spec => {
                    this.kernelManager.setRunningKernelFor(spec.language, kernel);
                });
                this.onKernelChanged(kernel);
            });
        }));
        this.disposables.push(vscode.commands.registerCommand(Commands.Jupyter.Kernel.Shutdown, () => {
            this.kernelManager.destroyRunningKernelFor('python');
            this.onKernelChanged();
        }));
    }
};