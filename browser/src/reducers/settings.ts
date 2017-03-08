import { handleActions } from 'redux-actions';
import * as Actions from '../constants/actions';

const initialState: NotebookResultSettings = {
  appendResults: true
};

export default handleActions<NotebookResultSettings, any>({
  [Actions.TOGGLE_APPEND_RESULTS]: (state, action) => {
    return { ...state, appendResults: !state.appendResults };
  }
}, initialState);
