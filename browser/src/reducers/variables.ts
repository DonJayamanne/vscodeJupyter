import { handleActions } from 'redux-actions';
import * as Actions from '../constants/actions';

export interface VariableInfo {
  name: string;
  type: string;
  detail: string;
  value: string;
  html: string;
  toggled: boolean;
  compared: boolean;
}

export type VariableMap = {[index: string]: VariableInfo };

const initialState: VariableMap = {};

const cellStyle = (value) => `border: 1px solid #777; min-width: 40px; text-align: right;${value == '0' ? "background-color: red; color: white" : (value == '1' ? "background-color: green; color: white" : '')}`;

function createTable(obj: any, dimension: number) {
  if (!Array.isArray(obj)) {
    return dimension % 2 == 1 ? `<td style="${cellStyle(obj.toString())}">${obj.toString()}</td>` : obj.toString();
  }

  const result = `
    ${dimension % 2 === 0 
      ? obj.map(o => `<tr>${createTable(o, dimension + 1)}</tr>`).join('\n')
      : obj.map(o => `<td style="${cellStyle(obj)}">${createTable(o, dimension + 1)}</td>`).join('\n')
    }
  `;

    if (dimension % 2 === 0) {
      return `<table cellSpacing="0" cellPadding="3"><tbody>${result}</tbody></table>`
    } else {
      return result;
    }
}

export default handleActions<NotebookResultSettings, any>({
  [Actions.ADD_VARIABLE]: (state, action) => {
    let val = action.payload[0].value['text/plain'];
    let obj: VariableInfo = JSON.parse(val);
    let existing = state[obj.name];
    if (existing && (existing.value === obj.value)) {
      return state;
    }

    // create html representation
    let text = obj.value;
    let html = text;

    // parse arrays
    if (text && text.indexOf('array(') == 0) {
      text = text.slice(6, -1);

      // use json to parse the value
      try {
        let parsed = JSON.parse(text);
        text = createTable(parsed, 0);
        html = text;
      } catch (ex) {}
    }

    return { ...state, [obj.name]: { ...existing || {}, ...obj, html } };
  },
  [Actions.TOGGLE_VARIABLE]: (state, action) => {
    let name = action.payload.name;
    let toggled = action.payload.toggled;
    return { ...state, [name]: { ...state[name], toggled } };
  },
  [Actions.TOGGLE_COMPARE]: (state, action) => {
    let name = action.payload.name;
    let compared = action.payload.compared;
    return { ...state, [name]: { ...state[name], compared } };
  }
}, initialState);