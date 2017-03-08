import { handleActions } from 'redux-actions';
import * as Actions from '../constants/actions';

const initialState: NotebookResultsState = [];

export default handleActions<NotebookResultsState, NotebookOutput>({
  [Actions.APPEND_RESULT]: (state, action) => {
    return [action.payload, ...state];
  },

  [Actions.APPEND_RESULTS]: (state, action) => {
    return [...action.payload, ...state];
  },

  [Actions.CLEAR_RESULTS]: (state, action) => {
    return [];
  }
}, initialState);
