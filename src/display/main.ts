import * as vscode from 'vscode';
import { KernelPicker } from './kernelPicker';
import { Commands } from '../common/constants';
import { TextDocumentContentProvider } from './resultView';
import { CellOptions } from './cellOptions';
import { JupyterCodeLensProvider } from '../editorIntegration/codeLensProvider';
import { Server } from './server';
import { ParsedIOMessage } from '../contracts';
import { createDeferred } from '../common/helpers';
import { Kernel } from '@jupyterlab/services';
import { Notebook } from '../jupyterServices/notebook/contracts';
import { formatErrorForLogging } from '../common/utils';

export { ProgressBar } from './progressBar'

const jupyterSchema = 'jupyter-result-viewer';
const previewUri = vscode.Uri.parse(jupyterSchema + '://authority/jupyter');

export class JupyterDisplay extends vscode.Disposable {
    private disposables: vscode.Disposable[];
    private previewWindow: TextDocumentContentProvider;
    private cellOptions: CellOptions;
    private server: Server;
    constructor(cellCodeLenses: JupyterCodeLensProvider, private outputChannel: vscode.OutputChannel) {
        super(() => { });
        this.disposables = [];
        this.server = new Server();
        this.disposables.push(this.server);
        this.disposables.push(new KernelPicker());
        this.disposables.push(vscode.commands.registerCommand(Commands.Jupyter.Kernel_Options, this.showKernelOptions.bind(this)));
        this.previewWindow = new TextDocumentContentProvider();
        this.disposables.push(vscode.workspace.registerTextDocumentContentProvider(jupyterSchema, this.previewWindow));
        this.cellOptions = new CellOptions(cellCodeLenses);
        this.disposables.push(this.cellOptions);
        this.server.on('settings.appendResults', append => {
            vscode.workspace.getConfiguration('jupyter').update('appendResults', append, true)
                .then(() => {
                    this.server.sendSetting('settings.appendResults', this.appendResults);
                }, reason => {
                    this.outputChannel.appendLine(formatErrorForLogging(reason));
                    vscode.window.showErrorMessage('Failed to update the setting', 'View Errors')
                        .then(item => {
                            if (item === 'View Errors') {
                                this.outputChannel.show();
                            }
                        });
                });
        });
        this.server.on('connected', () => {
            this.clientConnected = true;
            this.server.sendSetting('settings.appendResults', this.appendResults);
        });
    }

    private clientConnected: boolean;
    private get appendResults(): boolean {
        return vscode.workspace.getConfiguration('jupyter').get<boolean>('appendResults', true);
    }
    private notebookUrl: string;
    private canShutdown: boolean;
    public setNotebook(nb: Notebook, canShutdown: boolean) {
        this.notebookUrl = (nb && nb.baseUrl) || '';
        this.canShutdown = canShutdown;
    }
    public showResults(results: Rx.Observable<ParsedIOMessage>): Promise<any> {
        return this.server.start().then(port => {
            this.previewWindow.ServerPort = port;
            // If we need to append the results, then do so if we have any result windows open
            let sendDataToResultView = this.server.clientsConnected(2000);

            return sendDataToResultView.then(clientConnected => {
                // If connected to result view, then send results over sockets as they arrive
                if (clientConnected) {
                    this.server.clearBuffer();
                    results.subscribe(result => {
                        this.server.sendResults([result.data]);
                    });
                    return Promise.resolve();
                }

                // Wait till we have at least one item to be displayed before opening the results view
                const def = createDeferred<any>();
                this.clientConnected = false;
                results.subscribe(result => {
                    this.server.sendResults([result.data]);

                    if (this.clientConnected) {
                        this.server.clearBuffer();
                        return;
                    }

                    this.launchResultViewAndDisplayResults().
                        then(def.resolve.bind(def)).catch(def.reject.bind(def));
                });
                results.subscribeOnCompleted(() => {
                    if (!def.completed) {
                        def.resolve();
                    }
                });
                return def.promise;
            });
        });
    }

    private launchResultViewAndDisplayResults(): Promise<any> {
        const def = createDeferred<any>();

        vscode.commands.executeCommand('vscode.previewHtml', previewUri, vscode.ViewColumn.Two, 'Results')
            .then(() => {
                def.resolve();
            }, reason => {
                def.reject(reason);
                vscode.window.showErrorMessage(reason);
            });
        return def.promise;
    }

    public dispose() {
        this.disposables.forEach(d => d.dispose());
    }

    private async showKernelOptions(selectedKernel: Kernel.IKernel): Promise<any> {
        let description = '';
        let spec = await selectedKernel.getSpec();
        if (spec.display_name.toLowerCase().indexOf(spec.language.toLowerCase()) === -1) {
            description = `${spec.name} for ${spec.language}`;
        }
        const options = [
            {
                label: `Interrupt ${spec.display_name} Kernel`,
                description: description,
                command: Commands.Jupyter.Kernel.Interrupt,
                args: [selectedKernel]
            },
            {
                label: `Restart ${spec.display_name} Kernel`,
                description: description,
                command: Commands.Jupyter.Kernel.Restart,
                args: [selectedKernel]
            },
            {
                label: `Shut Down ${spec.display_name} Kernel`,
                description: description,
                command: Commands.Jupyter.Kernel.Shutdown,
                args: [selectedKernel]
            },
            {
                label: ` `,
                description: ' ',
                command: '',
                args: []
            },
            {
                label: `Select another ${spec.language} Kernel`,
                description: ` `,
                command: Commands.Jupyter.Kernel.Select,
                args: [spec.language]
            }
        ];

        if (this.canShutdown) {
            options.push({
                label: `Shut Down Notebook`,
                description: `Notebook running on ${this.notebookUrl}`,
                command: Commands.Jupyter.Notebook.ShutDown,
                args: []
            });
        }
        return vscode.window.showQuickPick(options).then(option => {
            if (!option || !option.command || option.command.length === 0) {
                return;
            }
            return vscode.commands.executeCommand(option.command, ...option.args);
        });
    }
}