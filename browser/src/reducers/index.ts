import { routerReducer as routing, RouteActions } from 'react-router-redux';
import { combineReducers, Reducer } from 'redux';
import results from './results';
import variables, { VariableInfo } from './variables';
import settings from './settings';

export interface RootState {
  //routing: RouteActions;
  results: NotebookResultsState;
  settings: NotebookResultSettings;
  variables: {[index: string]: VariableInfo}
}

export default combineReducers<RootState>({
  routing,
  results,
  variables,
  settings
});
