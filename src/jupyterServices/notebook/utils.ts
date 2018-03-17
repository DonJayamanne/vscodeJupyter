import { Notebook } from './contracts';
import { execSync } from 'child_process';
import { createDeferred } from '../../common/helpers';
import { execPythonFileSync } from '../../common/procUtils';
import { window } from 'vscode';

export function getAvailableNotebooks(): Promise<Notebook[]> {
    return execPythonFileSync('jupyter', ['notebook', 'list'], __dirname)
        .then(resp => {
            var items = resp.split(/\r|\n/)
                .filter(line => line.trim().length > 0)
                .map(parseNotebookListItem)
                .filter(nb => nb != undefined);

            return items;
        });
}

export function waitForNotebookToStart(baseUrl: string, retryInterval: number, timeout: number): Promise<Notebook> {
    baseUrl = baseUrl.toLowerCase();
    let def = createDeferred<Notebook>();
    let stop = setTimeout(() => {
        if (!def.completed) {
            def.reject('Timeout waiting for Notebook to start');
        }
    }, timeout);

    let startTime = Date.now();

    function check() {
        getAvailableNotebooks()
            .catch(ex => {
                console.error('Error in checking if notebook has started');
                console.error(ex);
                return [] as Notebook[];
            })
            .then(items => {
                let index = items.findIndex(item => item.baseUrl.toLowerCase().indexOf(baseUrl) === 0);
                if (index === -1) {
                    if (Date.now() - startTime > timeout) {
                        return def.reject('Timeout waiting for Notebook to start');
                    }
                    setTimeout(() => check(), retryInterval);
                }
                else {
                    def.resolve(items[index]);
                }
            });
    }

    setTimeout(() => check(), 0);
    return def.promise;
}
function parseNotebookListItem(item: string) {
    if (!item.trim().startsWith('http')) {
        return;
    }
    let parts = item.split('::').filter(part => part !== '::').map(part => part.trim());
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
            let items = notebooks.map(item => {
                let details = item.startupFolder && item.startupFolder.length > 0 ? `Startup Folder: ${item.startupFolder}` : '';
                return {
                    label: item.baseUrl,
                    description: '',
                    detail: details,
                    notebook: item
                };
            });
            window.showQuickPick(items)
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

export function inputNotebookDetails(): Promise<Notebook> {
    let def = createDeferred<Notebook>();
    window.showInputBox({
        prompt: 'Provide Url of existing Jupyter Notebook (e.g. http://localhost:888/)',
        value: 'http://localhost:8888/'
    }).then(url => {
        if (!url) {
            return;
        }
        let nb = parseNotebookListItem(url);
        if (!nb) {
            return;
        }
        return nb;
    }).then(nb => {
        if (!nb || nb.token) {
            return def.resolve(nb);
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
