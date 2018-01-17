import * as React from 'react';
import Result from '../Result'
import { VariableMap, VariableInfo } from '../../reducers/variables';
import { RootState } from '../../reducers/index';
import { connect } from 'react-redux';
import * as Actions from '../../constants/resultActions';

interface ResultState {
  /* empty */
}

interface VariableProps {
  variable: VariableInfo;
  toggleVariable?: () => void;
  toggleCompare?: () => void;
}

class Variable extends React.Component<VariableProps> {
  state = {
    visible: false
  }

  // { this.state.visible && <div>{ this.props.variable.html }</div>}
  render() {
    let result = [];
    
    return (
      <tbody>
        <tr onClick={this.props.toggleVariable} style={{ cursor: 'pointer', fontWeight: 'bold', background: '#666', borderBottom: 'solid 1px #222'}}>
          <td style={{ width: '30px'}}><input type="checkbox" title="Compare" onClick={this.props.toggleCompare} checked={this.props.variable.compared} /></td>
          <td>{ this.props.variable.name }</td>
          <td>{this.props.variable.type}</td>
          <td>{this.props.variable.detail}</td>
        </tr>
        { 
          this.props.variable.toggled && (
            <tr>
              <td colSpan={4}><div style={{ fontFamily: 'Courier', maxHeight: '300px', overflow: 'auto'}} dangerouslySetInnerHTML={{__html: this.props.variable.html}} /></td>
            </tr>
          )
        }
        </tbody>
    )
  }
}

function mapDispatchToProps(dispatch, ownProps: VariableProps) {
  return {
    toggleVariable: (e) => {
      if (e.target.localName === 'input') {
        return;
      }
      dispatch({ type: Actions.TOGGLE_VARIABLE, payload: { name: ownProps.variable.name, toggled: !ownProps.variable.toggled } })
    },
    toggleCompare: (e) => {
      dispatch({ type: Actions.TOGGLE_COMPARE, payload: { name: ownProps.variable.name, compared: !ownProps.variable.compared } });
    }
  };
}

const VariableContainer = connect(
  null,
  mapDispatchToProps
)(Variable as any);

interface VariablesProps {
  variables: VariableMap;
  visible: boolean;
  toggleVariables: (toggle: boolean) => void;
  toggleVariable: (name: string) => void;
}

class VariableList extends React.Component<VariablesProps> {

  toggleVariables = () => {
    this.props.toggleVariables(!this.props.visible);
  }

  render() {
    let variables = this.props.variables;
    let keys = Object.keys(variables);
    let results = keys.map(key =>
      <VariableContainer key={variables[key].name} variable={variables[key]}  />
    );
    let toggled = keys.filter(k => variables[k].compared).map(k => variables[k]);

    return (
      <div>
        { toggled.length > 0 
          ? <div style={{position: 'absolute', top: '12px', right: '12px', background: '#555', color: '#dedede', overflow: 'scroll', maxHeight: '400px'}}>
            <div style={{fontWeight: 'bold', background: '#333', padding: '6px'}}>Watched Variables</div>
            <table>
              <tbody>
                <tr>
                  { toggled.map((t, i) => <th style={{verticalAlign: 'top', padding: '6px', borderRight: '2px dashed #222'}} key={t.name + '_header'}>{t.name}</th>) }
                </tr>
                <tr>
                  { toggled.map((t, i) => <td style={{verticalAlign: 'top', padding: '6px', borderRight: '2px dashed #222' }}><div style={{maxWidth: '200px'}} key={t.name + '_body'} dangerouslySetInnerHTML={{__html: t.html}} /></td>) }
                </tr>
              </tbody>
            </table>
          </div>
          : false
        }
        <div style={{cursor: 'pointer', backgroundColor: '#555', padding: '3px'}} onClick={this.toggleVariables}>{results.length} Variables</div>
        { this.props.visible && <table cellPadding="3" cellSpacing="1">{ results }</table>}
      </div>
    );
  }
}

export default VariableList;