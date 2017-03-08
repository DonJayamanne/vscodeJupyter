import { getAvailableNotebooks, selectExistingNotebook } from './utils';
import { workspace, window, OutputChannel, Terminal, Disposable, QuickPickItem } from 'vscode';
import { createDeferred } from '../common/helpers';
import { SystemVariables } from '../common/systemVariables';
import { EventEmitter } from 'events';
import { NotebookFactory } from './factory';
import { Notebook } from './contracts';

export { Notebook } from './contracts';
export { inputNotebookDetails, selectExistingNotebook } from './utils';

export class NotebookManager extends EventEmitter {
    private factory: NotebookFactory;
    private disposables: Disposable[] = [];
    constructor(private outputChannel: OutputChannel) {
        super();
        this.factory = new NotebookFactory(outputChannel);
        this.factory.on('onShutdown', () => {
            this.emit('onShutdown');
        })
        this.disposables.push(this.factory);
    }
    dispose() {
        this.disposables.forEach(d => {
            d.dispose();
        });
        this.disposables = [];
    }
    private _currentNotebook: Notebook;
    setNotebook(notebook: Notebook) {
        this._currentNotebook = notebook;
        this.emit('onNotebookChanged', notebook);
    }
    canShutdown(nb: Notebook): boolean {
        return this.factory.canShutdown(nb.baseUrl);
    }
    shutdown() {
        this.factory.shutdown();
        this.emit('onShutdown');
    }
    startNewNotebook() {
        this.shutdown();
        return this.factory.startNewNotebook().then(nb => {
            this._currentNotebook = nb;
            return nb;
        });
    }

    getNotebook(): Promise<Notebook> {
        if (this._currentNotebook && this._currentNotebook.baseUrl.length > 0) {
            return Promise.resolve(this._currentNotebook);
        }
        const startNew = 'Start a new Notebook';
        const selectExisting = 'Select an existing Notebook';
        let def = createDeferred<Notebook>();
        window.showQuickPick([startNew, selectExisting]).then(option => {
            if (!option) {
                return def.resolve();
            }
            if (option === startNew) {
                this.factory.startNewNotebook()
                    .then(def.resolve.bind(def))
                    .catch(def.reject.bind(def));
            }
            else {
                selectExistingNotebook()
                    .then(def.resolve.bind(def))
                    .catch(def.reject.bind(def));
            }
        });
        def.promise.then(nb => {
            this._currentNotebook = nb;
            return nb;
        });
        return def.promise;
    }
}