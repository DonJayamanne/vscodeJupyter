import * as React from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { RootState } from '../../reducers';
import * as ResultActions from '../../actions/results';
import Header from '../../components/Header';
import ResultList from '../../components/ResultList'
import * as style from './style.css';

import * as io from 'socket.io-client';
import { VariableMap } from '../../reducers/variables';
import VariableList from '../../components/Variables';

import * as Actions from '../../constants/resultActions';

interface AppProps {
  settings: NotebookResultSettings;
  resultActions: typeof ResultActions;
  results: NotebookResultsState;
  variables: VariableMap,
  toggleVariables: () => void;
};

interface AppState {
  /* empty */
}

class App extends React.Component<AppProps, AppState>{
  private socket: SocketIOClient.Socket;
  constructor(props?: AppProps, context?: any) {
    super(props, context)
    // Use io (object) available in the script
    this.socket = (window as any).io();
    this.socket.on('connect', () => {
      // Do nothing
    });
    this.socket.on('settings.appendResults', (value: any) => {
      this.props.resultActions.setAppendResults(value);
    });
    this.socket.on('clientExists', (data: any) => {
      this.socket.emit('clientExists', { id: data.id });
    });
    this.socket.on('results', (value: NotebookOutput[]) => {
      if (!this.props.settings.appendResults) {
        this.props.resultActions.clearResults();
      }
      this.socket.emit('results.ack');
      this.props.resultActions.addResults(value);
    });
    this.socket.on('variable', (value: NotebookOutput[]) => {
      this.socket.emit('results.ack');
      this.props.resultActions.addVariable(value);
    });
  }

  toggleAppendResults = () => {
    this.socket.emit('settings.appendResults', !this.props.settings.appendResults);
  }
  toggleVariable = (name: string) => {
    this.socket.emit('settings.showVariable', { [name]: !!!this.props.settings.toggledVariables[name] });
  }
  private clearResults() {
    this.socket.emit('clearResults');
    this.props.resultActions.clearResults();
  }
  render() {
    const { children, variables, resultActions, settings } = this.props;
    return (
      <div>
        <VariableList variables={variables} visible={this.props.settings.showVariables} toggleVariables={this.props.toggleVariables} toggleVariable={this.toggleVariable} />
        <Header
          appendResults={settings.appendResults}
          clearResults={() => this.clearResults()}
          toggleAppendResults={() => this.toggleAppendResults()}>
        </Header>
        <ResultList results={this.props.results}></ResultList>
        {children}
      </div>
    );
  }
}

function mapStateToProps(state: RootState) {
  return {
    settings: state.settings,
    variables: state.variables,
    results: state.results
  };
}

function mapDispatchToProps(dispatch, ownProps) {
  return {
    resultActions: bindActionCreators(ResultActions as any, dispatch),
    toggleVariables: (toggle: boolean) => {
      dispatch({ type: Actions.TOGGLE_VARIABLES, payload: toggle })
    },
    toggleVariable: (name: string, toggle: boolean) => {
      dispatch({ type: Actions.TOGGLE_VARIABLE, payload: { [name]: toggle } })
    }
  };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(App);
