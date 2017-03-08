import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Router, Route, browserHistory } from 'react-router';
import { syncHistoryWithStore } from 'react-router-redux';
import { Provider } from 'react-redux';

import App from './containers/App';
import configureStore from './store';

const store = configureStore();
const history = syncHistoryWithStore(browserHistory, store);

// Hack hack hack
try {
  let color = decodeURIComponent(window.location.search.substring(window.location.search.indexOf('?color=') + 7));
  color = color.substring(0, color.indexOf('&fontFamily='));
  if (color.length > 0) {
    window.document.body.style.color = color;
  }
  let fontFamily = decodeURIComponent(window.location.search.substring(window.location.search.indexOf('&fontFamily=') + 12));
  fontFamily = fontFamily.substring(0, fontFamily.indexOf('&fontSize='));
  if (fontFamily.length > 0) {
    window.document.body.style.fontFamily = fontFamily;
  }
  const fontSize = decodeURIComponent(window.location.search.substring(window.location.search.indexOf('&fontSize=') + 10));
  if (fontSize.length > 0) {
    window.document.body.style.fontSize = fontSize;
  }
}
catch (ex) {
}

ReactDOM.render(
  <Provider store={store}>
    <Router history={history}>
      <Route path="/" component={App}>
      </Route>
    </Router>
  </Provider>,
  document.getElementById('root')
);
