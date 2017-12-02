'use strict';

import * as vscode from 'vscode';
import { Disposable } from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as helpers from '../common/helpers';

export class TextDocumentContentProvider extends Disposable implements vscode.TextDocumentContentProvider {
    private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
    private lastUri: vscode.Uri;
    private serverPort: number;
    constructor() {
        super(() => { });
    }
    public dispose() {
    }
    public set ServerPort(value: number) {
        this.serverPort = value;
    }
    public provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken): Thenable<string> {
        this.lastUri = uri;
        return this.generateResultsView();
    }

    get onDidChange(): vscode.Event<vscode.Uri> {
        return this._onDidChange.event;
    }

    private generateResultsView(): Promise<string> {

        // Fix for issue #669 "Results Panel not Refreshing Automatically" - always include a unique time
        // so that the content returned is different. Otherwise VSCode will not refresh the document since it
        // thinks that there is nothing to be updated.
        let timeNow = new Date().getTime();
        const htmlContent = `
                    <!DOCTYPE html>
                    <head>
                        <style>
                            html, body {
                                height: 100%;
                                width: 100%;
                            }
                        </style>
                        <script>
                            function start() {
                                console.log('reloaded results window at time ${timeNow}ms');
                                var color = '';
                                var fontFamily = '';
                                var fontSize = '';
                                var theme = '';
                                var fontWeight = '';
                                try {
                                    computedStyle = window.getComputedStyle(document.body);
                                    color = computedStyle.color + '';
                                    backgroundColor = computedStyle.backgroundColor + '';
                                    fontFamily = computedStyle.fontFamily;
                                    fontSize = computedStyle.fontSize;
                                    fontWeight = computedStyle.fontWeight;
                                    theme = document.body.className;
                                } catch(ex) { }
                                document.getElementById('myframe').src = 'http://localhost:${this.serverPort}/?theme=' + theme + '&color=' + encodeURIComponent(color) + "&backgroundColor=" + encodeURIComponent(backgroundColor) + "&fontFamily=" + encodeURIComponent(fontFamily) + "&fontWeight=" + encodeURIComponent(fontWeight) + "&fontSize=" + encodeURIComponent(fontSize);
                            }
                        </script>
                    </head>
                    <body onload="start()">
                        <iframe id="myframe" frameborder="0" style="border: 0px solid transparent; height:100%; width:100%;" src="" seamless></iframe>
                    </body>
                    </html>`;
        return Promise.resolve(htmlContent);
    }
}
