import * as React from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { RootState } from '../../reducers';
import * as TodoActions from '../../actions/todos';
import * as ResultActions from '../../actions/results';
import Header from '../../components/Header';
import MainSection from '../../components/MainSection';
import * as style from './style.css';

import * as io from 'socket.io-client';

interface AppProps {
  todos: TodoItemData[];
  settings: NotebookResultSettings;
  actions: typeof TodoActions;
  resultActions: typeof ResultActions
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
  }
  render() {
    const { todos, actions, children, resultActions, settings } = this.props;

    return (
      <div className={style.normal}>
        <Header
          appendResults={settings.appendResults}
          clearResults={() => resultActions.clearResults()}
          toggleAppendResults={() => resultActions.setAppendResults()}>
        </Header>
        {children}
      </div>
    );
  }
}

function mapStateToProps(state: RootState) {
  return {
    todos: state.todos,
    settings: state.settings
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(TodoActions as any, dispatch),
    resultActions: bindActionCreators(ResultActions as any, dispatch)
  };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(App);
