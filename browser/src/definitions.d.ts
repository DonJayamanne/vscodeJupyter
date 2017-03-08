/** TodoMVC model definitions **/
declare interface TodoItemData {
  id?: TodoItemId;
  text?: string;
  completed?: boolean;
}

declare type NotebookOutput = any;
declare interface NotebookResultSettings {
  appendResults?: boolean;
}
declare type TodoItemId = number;

declare type TodoFilterType = 'SHOW_ALL' | 'SHOW_ACTIVE' | 'SHOW_COMPLETED';

declare type TodoStoreState = TodoItemData[];
declare type NotebookResultsState = NotebookOutput[];

declare var module: any;
declare var require: any;
