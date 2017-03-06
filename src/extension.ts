'use strict';
import * as vscode from 'vscode';
import { Jupyter } from './main';
import { LanguageProvider, LanguageProviders } from './common/languageProvider';
import { registerDefaults } from './languages/main';
import { sendTelemetryEvent } from './telemetry/main';
import { EVENT_LOAD } from './telemetry/contracts';

export function activate(context: vscode.ExtensionContext) {
    sendTelemetryEvent(EVENT_LOAD);
    let outputChannel = vscode.window.createOutputChannel('Jupyter');
    context.subscriptions.push(outputChannel);

    let jupyter = new Jupyter(outputChannel);
    context.subscriptions.push(jupyter);
    registerDefaults();

    return {
        registerLanguageProvider: (language: string, provider: LanguageProvider) => {
            LanguageProviders.registerLanguageProvider(language, provider);
        },
        hasCodeCells: (document: vscode.TextDocument, token: vscode.CancellationToken) => {
            return jupyter.hasCodeCells(document, token);
        }
    };
}

export function deactivate() {
}