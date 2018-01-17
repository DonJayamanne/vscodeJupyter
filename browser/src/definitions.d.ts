declare type NotebookOutput = {
  id: string;
  value: { [key: string]: any } | string;
}
declare interface NotebookResultSettings {
  appendResults?: boolean;
  showVariables?: boolean;
  toggledVariables?: { [index: string]: boolean };
}
declare type NotebookResultsState = NotebookOutput[];

declare var module: any;
declare var require: any;
