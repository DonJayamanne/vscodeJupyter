import { Notebook } from './contracts';
import { execSync } from 'child_process';
import { createDeferred } from '../common/helpers';
import { window } from 'vscode';

export function getAvailableNotebooks(): Promise<Notebook[]> {
    return new Promise<Notebook[]>((resolve, reject) => {
        var resp = execSync('jupyter notebook list');
        var items = resp.toString('utf8').split(/\r|\n/)
            .filter(line => line.trim().length > 0)
            .map(parseNotebookListItem)
            .filter(nb => nb != undefined);

        resolve(items);
    });
}

export function waitForNotebookToStart(baseUrl: string, retryInterval: number, timeout: number): Promise<Notebook> {
    baseUrl = baseUrl.toLowerCase();
    let def = createDeferred<Notebook>();
    let stop = setTimeout(() => {
        if (!def.completed) {
            def.reject();
        }
    }, timeout);

    let interval = setInterval(() => {
        getAvailableNotebooks()
            .catch(() => Promise.resolve([]))
            .then(items => {
                let index = items.findIndex(item => item.baseUrl.toLowerCase().indexOf(baseUrl) === 0);

                if (index >= 0) {
                    clearInterval(interval);
                    def.resolve(items[index]);
                }
            });
    }, retryInterval);

    return def.promise;
}
function parseNotebookListItem(item: string) {
    if (!item.trim().startsWith('http')) {
        return;
    }
    let parts = item.split('::').filter(part => part !== '::');
    let url = parts.shift();
    let startupFolder = item.indexOf('::') > 0 ? parts[0].trim() : null;
    let token = '';
    let urlOnly = url;
    if (url.indexOf('token=') > 0) {
        token = url.split('=')[1].trim();
        urlOnly = url.split('?')[0].trim();
    }
    return <Notebook>{
        startupFolder: startupFolder,
        token: token,
        baseUrl: urlOnly
    }
}
export function selectExistingNotebook() {
    let def = createDeferred<Notebook>();
    getAvailableNotebooks()
        .then(notebooks => {
            window.showQuickPick(notebooks.map(item => {
                let details = item.startupFolder && item.startupFolder.length > 0 ? `Starup Folder: ${item.startupFolder}` : '';
                return {
                    label: item.baseUrl,
                    description: '',
                    detail: details,
                    notebook: item
                };
            }))
                .then(item => {
                    if (item) {
                        def.resolve(item.notebook);
                    }
                    else {
                        def.reject();
                    }
                });
        });

    return def.promise;
}

export function inputNotebookDetails(): Promise<Notebook> {
    let def = createDeferred<Notebook>();
    window.showInputBox({
        prompt: 'Provide the Url of an existing Jupyter Notebook (e.g. http://localhost:888/)',
        value: 'http://localhost:8888/'
    }).then(url => {
        if (!url) {
            return;
        }
        let nb = parseNotebookListItem(url);
        if (!nb) {
            return def.reject();
        }
        if (nb.token) {
            def.resolve(nb);
        }
        else {
            return nb;
        }
    }).then(nb => {
        if (!nb) {
            return;
        }
        window.showInputBox({
            prompt: 'Provide the token to connect to the Jupyter Notebook'
        }).then(token => {
            if (token) {
                nb.token = token;
            }
            def.resolve(nb);
        });
    });

    return def.promise;
}