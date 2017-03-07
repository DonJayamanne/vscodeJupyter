import { getAvailableNotebooks } from './utils';
import { workspace, window, OutputChannel, Terminal, Disposable, QuickPickItem } from 'vscode';
import { createDeferred } from '../common/helpers';
import { SystemVariables } from '../common/systemVariables';
import { EventEmitter } from 'events';
import { NotebookFactory } from './factory';
import { Notebook } from './contracts';

export class NotebookManager extends EventEmitter {
    private factory: NotebookFactory;
    private disposables: Disposable[] = [];
    constructor(private outputChannel: OutputChannel) {
        super();
        this.factory = new NotebookFactory(outputChannel);
        this.disposables.push(this.factory);
    }
    dispose() {
        this.disposables.forEach(d => {
            d.dispose();
        });
        this.disposables = [];
    }
    private _currentNotebook: Notebook;
    private selectExistingNotebook() {
        let def = createDeferred<Notebook>();
        getAvailableNotebooks()
            .then(notebooks => {
                window.showQuickPick(notebooks.map(item => {
                    var desc = item.startupFolder && item.startupFolder.length > 0 ? `Starup Folder: ${item.startupFolder}` : '';
                    return {
                        label: item.baseUrl,
                        description: desc,
                        notebook: item
                    };
                }))
                    .then(item => {
                        if (item) {
                            def.resolve(item.notebook);
                        }
                        else {
                            def.resolve();
                        }
                    });
            });

        return def.promise;
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
                this.factory.startNewNotebook().catch(def.reject.bind(def)).then(def.resolve.bind(def));
            }
            else {
                this.selectExistingNotebook().catch(def.reject.bind(def)).then(def.resolve.bind(def));
            }
        });
        def.promise.then(nb => {
            this._currentNotebook = nb;
            return nb;
        });
        return def.promise;
    }
}