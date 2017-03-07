import { workspace, window, OutputChannel, Terminal, Disposable } from 'vscode';
import { createDeferred } from '../common/helpers';
import { SystemVariables } from '../common/systemVariables';
import { EventEmitter } from 'events';
import { Notebook } from './contracts';
import { getAvailablePort } from './portUtils';
import { getAvailableNotebooks } from './utils';

const waitOn = require('wait-on');
export class NotebookFactory extends EventEmitter {
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
    private _notebookUrlInfo: Notebook;

    canShutdown(url: string): boolean {
        return this._notebookUrl.toLowerCase() === url.toLowerCase();
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
            this._notebookUrl = null;
            this._notebookUrlInfo = null;
        }
        this.emit('onShutdown');
    }
    private startJupyterNotebookInTerminal(startupFolder: string, args: string[]) {
        this.terminal = window.createTerminal('Jupyter');
        this.terminal.sendText('cd ' + `'${startupFolder}'`);
        this.terminal.sendText('jupyter ' + ['notebook'].concat(args).join(' '));
        this.terminal.show();
    }
    startNewNotebook(): Promise<Notebook> {
        this._notebookUrl = null;
        this._notebookUrlInfo = null;
        return this.startNotebook().then(url => {
            return url;
        });
    }
<<<<<<< HEAD
    
=======

>>>>>>> 59ed4b312bad8a4f08c90f1f28bd6a68c20b8e3b
    private startNotebook(): Promise<Notebook> {
        let sysVars = new SystemVariables();
        let jupyterSettings = workspace.getConfiguration('jupyter');
        let startupFolder = sysVars.resolve(jupyterSettings.get('notebook.startupFolder', workspace.rootPath || __dirname));

        let args = jupyterSettings.get('notebook.startupArgs', [] as string[]);
        args = args.map(arg => sysVars.resolve(arg));
        if (this.terminal) {
            this.shutdown();
        }

        let ipIndex = args.findIndex(arg => arg.indexOf('--ip') === 0);
        let ip = ipIndex > 0 ? args[ipIndex + 1].trim().split('=')[1] : 'localhost';
        let portIndex = args.findIndex(arg => arg.indexOf('--port') === 0);
        let port = portIndex > 0 ? args[portIndex + 1].trim().split('=')[1] : '8888';
        let protocol = args.filter(arg => arg.indexOf('--certfile') === 0).length > 0 ? 'https' : 'http';

        let def = createDeferred<Notebook>();

        getAvailablePort(protocol, ip, parseInt(port))
            .catch(() => Promise.resolve(parseInt(port)))
            .then(nextAvailablePort => {
                this.startJupyterNotebookInTerminal(startupFolder, args);

                let url = `${protocol}://${ip}:${nextAvailablePort}`;
                waitOn({
                    resources: [url],
<<<<<<< HEAD
                    delay: 1000, // initial delay in ms, default 0 
                    interval: 100, // poll interval in ms, default 250ms 
                    timeout: 5000, // timeout in ms, default Infinity 
=======
                    delay: 1000, // initial delay in ms, default 0
                    interval: 100, // poll interval in ms, default 250ms
                    timeout: 5000, // timeout in ms, default Infinity
>>>>>>> 59ed4b312bad8a4f08c90f1f28bd6a68c20b8e3b
                    reverse: true // optional flag to reverse operation so checks are for resources being NOT available, default false
                }, (err) => {
                    if (err) {
                        def.reject(`Failed to detect Jupyter Notebook. Please use 'Select Jupyter Notebook' command`);
                        return;
                    }

                    // wait for a second (too soon, and we get errors, cuz jupyter may not have initialized completely)
                    // Yes dirty hack... (hopefully these hack don't pile up)
                    setTimeout(() => {
                        this._notebookUrl = url;
                        let startedNotebookInfo: Notebook = {
                            startupFolder: startupFolder,
                            token: '',
                            baseUrl: url
                        }
                        getAvailableNotebooks()
                            .catch(ex => {
                                this.outputChannel.appendLine('Unable to find the started Jupyter Notebook, assuming defaults');
                                return Promise.resolve([]);
                            })
                            .then(items => {
                                items.forEach(item => {
                                    if (item.baseUrl.indexOf(url) === 0) {
                                        startedNotebookInfo = item;
                                    }
                                });
                                def.resolve(startedNotebookInfo);
                            });
                    }, 2000);

                });
            });

        return def.promise;
    }
}