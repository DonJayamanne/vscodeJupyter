import { Notebook } from './contracts';
import { execSync } from 'child_process';

export function getAvailableNotebooks(): Promise<Notebook[]> {
    return new Promise<Notebook[]>((resolve, reject) => {
        var resp = execSync('jupyter notebook list');
        var items = resp.toString('utf8').split(/\r|\n/)
            .filter(line => line.trim().length > 0)
            .map(parseNotebookListItem)

        resolve(items);
    });
}

function parseNotebookListItem(item: string) {
    let parts = item.split('::').filter(part => part !== '::');
    let url = parts.shift();
    let startupFolder = item.indexOf('::') > 0 ? parts[1] : null;
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
