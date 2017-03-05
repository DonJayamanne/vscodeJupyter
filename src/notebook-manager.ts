import { workspace, window, OutputChannel, Terminal, Disposable } from 'vscode';
import { createDeferred } from './common/helpers';
import { SystemVariables } from './common/systemVariables';
import { EventEmitter } from 'events';
const waitOn = require('wait-on');

export class NotebookManager extends EventEmitter {
    private terminal: Terminal;
    private disposables: Disposable[] = [];
    constructor(private outputChannel: OutputChannel) {
        super();
        window.onDidCloseTerminal(this.onTerminalShutDown, this, this.disposables);
    }
    dispose() {
        this.disposables.forEach(d => {
            d.dispose();
        });
        this.disposables = [];
        if (this.terminal) {
            this.terminal.dispose();
            this.terminal = null;
        }
    }
    private _notebookUrl: string;
    private _notebookUrlStartedByUs: string;
    setNotebookUrl(url: string) {
        this._notebookUrl = url;
        this.emit('onNotebookUrlChanged', url);
    }
    canShutdown(): boolean {
        return this._notebookUrlStartedByUs === this._notebookUrl;
    }
    onTerminalShutDown(e: Terminal) {
        if (this.terminal === e) {
            this.shutdown();
        }
    }
    shutdown() {
        if (this.terminal) {
            this.terminal.dispose();
            this.terminal = null;
            this._notebookUrlStartedByUs = null;
            this.setNotebookUrl(null);
        }
        this.emit('onShutdown');
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
            this.shutdown();
        }
        this.terminal = window.createTerminal('Jupyter');
        this.terminal.sendText('cd ' + `'${startupFolder}'`);
        this.terminal.sendText('jupyter ' + ['notebook'].concat(args).join(' '));
        this.terminal.show();

        let ipIndex = args.indexOf('--ip');
        let ip = ipIndex > 0 ? args[ipIndex + 1] : 'localhost';
        let portIndex = args.indexOf('--port');
        let port = ipIndex > 0 ? args[portIndex + 1] : '8888';
        let url = `http://${ip}:${port}/`;

        this._notebookUrlStartedByUs = null;
        let def = createDeferred<any>();

        waitOn({
            resources: [url],
            delay: 1000, // initial delay in ms, default 0 
            interval: 100, // poll interval in ms, default 250ms 
            timeout: 5000, // timeout in ms, default Infinity 
            reverse: true // optional flag to reverse operation so checks are for resources being NOT available, default false
        }, (err) => {
            if (err) {
                def.reject(`Failed to detect Jupyter Notebook. Set it using 'Set Jupyter Notebook' command`);
            }
            else {
                this._notebookUrlStartedByUs = url;

                // wait for a second (too soon, and we get errors, cuz jupyter may not have initialized completely)
                // Yes dirty hack... (hopefully these hack don't pile up)
                setTimeout(() => {
                    def.resolve(url);
                }, 2000);
            }
        });

        return def.promise;
    }

    private getExistingNotebookUrl() {
        let def = createDeferred<string>();
        window.showInputBox({
            placeHolder: `E.g. http://localhost:8888/`,
            value: 'http://localhost:8888/',
            prompt: `Provide the Jupyter Notebook Url 'http://localhost:8888/'`
        }).then(value => {
            def.resolve(value);
        });
        return def.promise;
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