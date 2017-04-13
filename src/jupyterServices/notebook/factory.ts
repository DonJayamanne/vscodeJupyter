import { workspace, window, OutputChannel, Terminal, Disposable } from 'vscode';
import { createDeferred } from '../../common/helpers';
import { SystemVariables } from '../../common/systemVariables';
import { EventEmitter } from 'events';
import { Notebook } from './contracts';
import { getAvailablePort } from './portUtils';
import { getAvailableNotebooks, waitForNotebookToStart } from './utils';
import { spawn, ChildProcess } from 'child_process';
import { ProgressBar } from '../../display/progressBar';
import { spanwPythonFile } from '../../common/procUtils';

const tcpPortUsed = require('tcp-port-used');
export class NotebookFactory extends EventEmitter {
    private proc: ChildProcess;
    private notebookOutputChannel: OutputChannel;
    private disposables: Disposable[] = [];
    constructor(private outputChannel: OutputChannel) {
        super();
        this.notebookOutputChannel = window.createOutputChannel('Jupyter Notebook');
        this.disposables.push(this.notebookOutputChannel);
    }
    dispose() {
        this.disposables.forEach(d => {
            d.dispose();
        });
        this.disposables = [];
        this.shutdown();
    }
    private _notebookUrlInfo: Notebook;

    canShutdown(url: string): boolean {
        if (!this._notebookUrlInfo) {
            return false;
        }
        let ourUrl = this._notebookUrlInfo.baseUrl.toLowerCase();
        url = url.toUpperCase();

        // Assuming we have '/' at the ends of the urls
        return ourUrl.indexOf(url) === 0 || url.indexOf(ourUrl) === 0;
    }
    shutdown() {
        if (this.proc) {
            try {
                this.proc.kill();
            }
            catch (ex) { }
            this.proc = null;
            this._notebookUrlInfo = null;
        }
        this.notebookOutputChannel.clear();
        this.emit('onShutdown');
    }
    private startJupyterNotebookInTerminal(startupFolder: string, args: string[]) {
        this.notebookOutputChannel.appendLine('Starting Jupyter Notebook');
        this.notebookOutputChannel.appendLine('jupyter ' + ['notebook'].concat(args).join(' '));

        return spanwPythonFile('jupyter', ['notebook'].concat(args), startupFolder)
            .then(proc => {
                this.proc = proc;
                this.proc.stderr.on('data', data => {
                    this.notebookOutputChannel.append(data.toString());
                });
            });
    }
    startNewNotebook(): Promise<Notebook> {
        this._notebookUrlInfo = null;
        this.notebookOutputChannel.clear();
        let prom = this.startNotebook().then(url => {
            return url;
        });
        ProgressBar.Instance.setProgressMessage('Starting Notebook', prom);
        return prom;
    }
    private startNotebook(): Promise<Notebook> {
        let sysVars = new SystemVariables();
        let jupyterSettings = workspace.getConfiguration('jupyter');
        let startupFolder = sysVars.resolve(jupyterSettings.get('notebook.startupFolder', workspace.rootPath || __dirname));

        let args = jupyterSettings.get('notebook.startupArgs', [] as string[]);
        args = args.map(arg => sysVars.resolve(arg));
        if (this.proc) {
            this.shutdown();
        }

        let ipIndex = args.findIndex(arg => arg.indexOf('--ip') === 0);
        let ip = ipIndex > 0 ? args[ipIndex].trim().split('=')[1] : 'localhost';
        let portIndex = args.findIndex(arg => arg.indexOf('--port') === 0);
        let port = portIndex > 0 ? parseInt(args[portIndex].trim().split('=')[1]) : 8888;
        let protocol = args.filter(arg => arg.indexOf('--certfile') === 0).length > 0 ? 'https' : 'http';

        // Ensure CORS
        if (args.findIndex(arg => arg.indexOf('--NotebookApp.allow_origin') === -1)) {
            args.push('--NotebookApp.allow_origin="*"');
        }

        let def = createDeferred<Notebook>();
        const retryIntervalMs = 250;
        const timeoutMs = 20000;
        let url = `${protocol}://${ip}:${port}`;

        getAvailablePort(protocol, ip, port)
            .catch(() => Promise.resolve(port))
            .then(nextAvailablePort => this.startJupyterNotebookInTerminal(startupFolder, args).then(() => nextAvailablePort))
            .then(nextAvailablePort => {
                url = `${protocol}://${ip}:${nextAvailablePort}`;
                return tcpPortUsed.waitUntilUsed(nextAvailablePort, retryIntervalMs, timeoutMs);
            })
            .then(() => {
                // Just because the port is in use doesn't mean Notebook has fully started
                // Now try to get a list of available notebooks
                return waitForNotebookToStart(url, retryIntervalMs, timeoutMs);
            }).then(nb => {
                def.resolve(nb);
            })
            .catch(() => {
                def.reject(`Failed to detect Jupyter Notebook. Please use 'Select Jupyter Notebook' command`);
            });

        return def.promise;
    }
}