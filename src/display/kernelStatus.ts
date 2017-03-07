import * as vscode from 'vscode';
import { Commands, PythonLanguage } from '../common/constants';
import { Kernel } from '@jupyterlab/services';

export class KernelStatus extends vscode.Disposable {
    private disposables: vscode.Disposable[];
    private statusBar: vscode.StatusBarItem;

    constructor() {
        super(() => { });
        this.disposables = [];
        this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
        this.statusBar.command = 'jupyter.proxyKernelOptionsCmd';
        this.disposables.push(this.statusBar);
        this.disposables.push(vscode.commands.registerCommand('jupyter.proxyKernelOptionsCmd', () => {
            vscode.commands.executeCommand(Commands.Jupyter.Kernel_Options, this.activeKernal);
        }));

        this.disposables.push(vscode.window.onDidChangeActiveTextEditor(this.onDidChangeActiveTextEditor.bind(this)));
    }
    private onDidChangeActiveTextEditor(editor: vscode.TextEditor) {
        const editorsOpened = vscode.workspace.textDocuments.length > 0;
        if ((!editor && editorsOpened) || (editor && editor.document.languageId === PythonLanguage.language)) {
            if (this.activeKernal) {
                this.statusBar.show();
            }
        }
        else {
            this.statusBar.hide();
        }
    }
    private activeKernal: Kernel.IKernel;
    private displayName: string;
    public setActiveKernel(kernel: Kernel.IKernel) {
        if (!kernel) {
            this.activeKernal = null;
            return this.statusBar.hide();
        }
        this.activeKernal = kernel;
        this.displayName = kernel.name;
        this.statusBar.tooltip = `Running on ${kernel.baseUrl}`;
        kernel.getSpec().then(spec => {
            this.statusBar.tooltip = `${spec.display_name}(${spec.name}) Kernel for ${spec.language}` +
                `\nRunning on ${kernel.baseUrl}\nClick for options`;
            this.displayName = spec.display_name;
            this.statusBar.text = `$(flame)${this.displayName} Kernel`;
        });
        this.statusBar.text = `$(flame)${this.displayName} Kernel`;
        this.statusBar.show();
    }
    public setKernelStatus(status: string) {
        this.statusBar.text = `$(flame)${this.displayName} Kernel (${status})`;
    }
    public dispose() {
        this.disposables.forEach(d => d.dispose());
    }
}