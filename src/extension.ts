'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { Jupyter } from './main';
import { CellHelper } from './common/cellHelper';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    let outputChannel = vscode.window.createOutputChannel('Jupyter');
    context.subscriptions.push(outputChannel);

    let jupyter = new Jupyter(outputChannel);
    context.subscriptions.push(jupyter);

    return {
        registerCellIdentifier: (language: string, regEx: RegExp) => {
            if (typeof language !== 'string' || language.length === 0) {
            }
            if (!(regEx instanceof RegExp)) {
                throw new Error(`Argument 'regEx' not provided`);
            }
            CellHelper.registerCellIdentifier(language, regEx);
        }
    };
}

// this method is called when your extension is deactivated
export function deactivate() {
}