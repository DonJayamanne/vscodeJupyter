import { handleActions } from 'redux-actions';
import * as Actions from '../constants/actions';

const initialState: NotebookResultSettings = {
  appendResults: true,
  showVariables: false
};

export default handleActions<NotebookResultSettings, any>({
  [Actions.SET_APPEND_RESULTS]: (state, action) => {
    return { ...state, appendResults: action.payload };
  },
  [Actions.TOGGLE_VARIABLES]: (state, action) => {
    return { ...state, showVariables: action.payload };
  }
}, initialState);
