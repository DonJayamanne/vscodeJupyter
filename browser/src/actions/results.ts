import { createAction } from 'redux-actions';
import * as Actions from '../constants/resultActions';

export const clearResults = createAction(Actions.CLEAR_RESULTS);
export const addResult = createAction<NotebookOutput>(Actions.ADD_RESULT);
export const addResults = createAction<NotebookOutput[]>(Actions.ADD_RESULTS);
export const addVariable = createAction<NotebookOutput[]>(Actions.ADD_VARIABLE);
export const setAppendResults = createAction<boolean>(Actions.SET_APPEND_RESULTS);
export const setShowVariables = createAction<boolean>(Actions.TOGGLE_VARIABLES);
export const setShowVariable = createAction<any>(Actions.TOGGLE_VARIABLE);
