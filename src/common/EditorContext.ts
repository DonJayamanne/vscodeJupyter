import { commands } from 'vscode';

export class EditorContextKey {
    private _name: string;
    private _lastValue: boolean;

    constructor(name: string) {
        this._name = name;
    }

    public set(value: boolean): void {
        if (this._lastValue === value) {
            return;
        }
        this._lastValue = value;
        commands.executeCommand('setContext', this._name, this._lastValue);
    }
} 
