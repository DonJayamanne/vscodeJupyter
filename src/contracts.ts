import * as vscode from 'vscode';
// http://jupyter-client.readthedocs.io/en/latest/messaging.html#to-do

export interface ParsedIOMessage {
    data: { [key: string]: any } | string;
    type: string;
    stream: string;
    message?: string;
}

export interface Cell {
    range: vscode.Range;
    title: string;
}