'use strict';

import * as vscode from 'vscode';
import { Disposable } from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as helpers from '../common/helpers';

export class TextDocumentContentProvider extends Disposable implements vscode.TextDocumentContentProvider {
    private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
    private lastUri: vscode.Uri;
    private results: any[];
    private serverPort: number;
    private tmpFileCleanup: Function[] = [];
    private appendResults: boolean;
    constructor() {
        super(() => { });
    }
    public dispose() {
        this.tmpFileCleanup.forEach(fn => {
            try {
                fn();
            }
            catch (ex) { }
        });
    }
    public set ServerPort(value: number) {
        this.serverPort = value;
    }
    public set AppendResults(value: boolean) {
        this.appendResults = value;
    }
    public provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken): Thenable<string> {
        this.lastUri = uri;
        return this.generateResultsView();
    }

    get onDidChange(): vscode.Event<vscode.Uri> {
        return this._onDidChange.event;
    }

    public setResult(results: any[]) {
        this.results = results;
    }
    public update() {
        this._onDidChange.fire(this.lastUri);
    }

    private getScriptFilePath(resourceName: string): string {
        return vscode.Uri.file(path.join(__dirname, '..', 'browser', resourceName)).toString();
    }

    private tmpHtmlFile: string;

    private generateResultsView(): Promise<string> {

        // Fix for issue #669 "Results Panel not Refreshing Automatically" - always include a unique time
        // so that the content returned is different. Otherwise VSCode will not refresh the document since it
        // thinks that there is nothing to be updated.
        let timeNow = new Date().getTime();
        const htmlContent = `
                    <!DOCTYPE html>
                    <head><style type="text/css"> html, body{ height:100%; width:100%; } </style>
                    <script type="text/javascript">
                        function start(){
                            console.log('reloaded results window at time ${timeNow}ms');
                            var color = '';
                            var fontFamily = '';
                            var fontSize = '';
                            try {
                                computedStyle = window.getComputedStyle(document.body);
                                color = computedStyle.color + '';
                                fontFamily = computedStyle.fontFamily;
                                fontSize = computedStyle.fontSize;
                            }
                            catch(ex){
                            }
                            document.getElementById('myframe').src = 'http://localhost:${this.serverPort}/?color=' + encodeURIComponent(color) + "&fontFamily=" + encodeURIComponent(fontFamily) + "&fontSize=" + encodeURIComponent(fontSize);
                        }
                    </script>
                    </head>
                    <body onload="start()">
                    <iframe id="myframe" frameborder="0" style="border: 0px solid transparent;height:100%;width:100%;" src="" seamless></iframe></body></html>`;
        return Promise.resolve(htmlContent);
    }
}
