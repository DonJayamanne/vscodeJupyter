import { window, StatusBarItem, Disposable } from 'vscode';

export class ProgressBar {
    private static _instance = new ProgressBar();
    public static get Instance(): ProgressBar {
        return ProgressBar._instance;
    }
    private progressStatusBar: StatusBarItem;
    constructor() {
        this.progressStatusBar = window.createStatusBarItem();
    }
    dispose() {
        this.progressStatusBar.dispose();
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
    }
    private progressInterval: NodeJS.Timer;
    private promises: Promise<any>[] = [];
    setProgressMessage(message: string, promise: Promise<any>) {
        this.promises.push(promise);
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
        }
        this.progressStatusBar.text = message;
        this.progressStatusBar.show();
        let counter = 1;
        const suffix = ['', '.', '..'];
        this.progressInterval = setInterval(() => {
            this.progressStatusBar.text = message + suffix[counter % 3];
            counter++;
            if (counter > 3) {
                counter = 0;
            }
        }, 250);

        promise
            .then(() => {
                this.progressStatusBar.text = '';
                this.progressStatusBar.hide();
                clearInterval(this.progressInterval);
                this.progressInterval = null;
            })
            .catch(() => {
                this.progressStatusBar.text = '';
                this.progressStatusBar.hide();
                clearInterval(this.progressInterval);
                this.progressInterval = null;
            });
    }
}