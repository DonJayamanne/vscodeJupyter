import * as vscode from 'vscode';
import { JupyterCodeLensProvider } from '../editorIntegration/codeLensProvider';
import { CellHelper } from './cellHelper';

export class CodeHelper {
    private cellHelper: CellHelper;
    constructor(private cellCodeLenses: JupyterCodeLensProvider) {
        this.cellHelper = new CellHelper(cellCodeLenses);
    }

    public getActiveCell(): Promise<vscode.Range> {
        return new Promise<vscode.Range>((resolve, reject) => {
            this.cellHelper.getActiveCell().then(info => {
                if (info && info.cell) {
                    resolve(info.cell);
                }
                else {
                    resolve(null);
                }
            }, reason => reject(reason));
        });
    }
    public getSelectedCode(): Promise<string> {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor || !activeEditor.document) {
            return Promise.resolve('');
        }
        if (activeEditor.selection.isEmpty) {
            return Promise.resolve(activeEditor.document.lineAt(activeEditor.selection.start.line).text);
        }
        else {
            return Promise.resolve(activeEditor.document.getText(activeEditor.selection));
        }
    }
}