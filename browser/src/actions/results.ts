import { createAction } from 'redux-actions';
import * as Actions from '../constants/actions';

export const clearResults = createAction<void>(Actions.CLEAR_RESULTS);
export const appendResult = createAction<NotebookOutput>(Actions.APPEND_RESULT);
export const appendResults = createAction<NotebookOutput[]>(Actions.APPEND_RESULTS);
export const toggleAppendResults = createAction<void>(Actions.TOGGLE_APPEND_RESULTS);
