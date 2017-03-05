import { workspace, window, OutputChannel, Terminal } from 'vscode';
import { createDeferred } from './common/helpers';
import { SystemVariables } from './common/systemVariables';
import { EventEmitter } from 'events';

export class NotebookManager extends EventEmitter {
    private terminal: Terminal;
    constructor(private outputChannel: OutputChannel) {
        super();
    }
    dispose() {
        if (this.terminal) {
            this.terminal.dispose();
            this.terminal = null;
        }
    }
    private _notebookUrl: string;
    private _notebookUrlStartedByUs: string;
    canShutdown(): boolean {
        return this._notebookUrlStartedByUs === this._notebookUrl;
    }
    startNewNotebook(): Promise<string> {
        this._notebookUrl = null;
        return this.startNotebook().then(url => {
            this.setNotebookUrl(url);
            return url;
        });
    }
    private startNotebook(): Promise<string> {
        let sysVars = new SystemVariables();
        let jupyterSettings = workspace.getConfiguration('jupyter');
        let startupFolder = sysVars.resolve(jupyterSettings.get('notebook.startupFolder', workspace.rootPath || __dirname));

        let args = jupyterSettings.get('notebook.startupArgs', [] as string[]);
        args = args.map(arg => sysVars.resolve(arg));
        if (this.terminal) {
            this.terminal.dispose();
        }
        this.terminal = window.createTerminal('Jupyter');
        this.terminal.sendText('cd ' + `'${startupFolder}'`);
        this.terminal.sendText('jupyter ' + ['notebook'].concat(args).join(' '));
        this.terminal.show();

        let def = createDeferred<any>();
        setTimeout(function () {
            let ipIndex = args.indexOf('--ip');
            let ip = ipIndex > 0 ? args[ipIndex + 1] : 'localhost';
            let portIndex = args.indexOf('--port');
            let port = ipIndex > 0 ? args[portIndex + 1] : '8888';

            let url = `http://${ip}:${port}/`;
            this._notebookUrlStartedByUs = url;
            this.setNotebookUrl(url);
            def.resolve(url);
        }, 5000);

        return def.promise;
    }

    private getExistingNotebookUrl() {
        let def = createDeferred<string>();
        window.showInputBox({
            placeHolder: `E.g. http://localhost:8888/`,
            value: 'http://localhost:8888/',
            prompt: `Please provide the Jupyter Notebook Url 'http://localhost:8888/'`
        }).then(value => {
            def.resolve(value);
        });
        return def.promise;
    }
    setNotebookUrl(url: string) {
        this._notebookUrl = url;
        this.emit('onNotebookUrlChanged', url);
    }
    getNotebookUrl() {
        if (this._notebookUrl && this._notebookUrl.length > 0) {
            return Promise.resolve(this._notebookUrl);
        }
        const startNew = 'Start a new Jupyter Notebook';
        const selectExisting = 'Select an existing (url) Jupyter Notebook';
        let def = createDeferred<string>();
        window.showQuickPick([startNew, selectExisting]).then(option => {
            if (!option) {
                return def.resolve();
            }
            if (option === startNew) {
                this.startNotebook().catch(def.reject.bind(def)).then(def.resolve.bind(def));
            }
            else {
                this.getExistingNotebookUrl().catch(def.reject.bind(def)).then(def.resolve.bind(def));
            }
        });
        def.promise.then(url => {
            this.setNotebookUrl(url);
            return url;
        });
        return def.promise;
    }
}