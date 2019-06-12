import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import '@fortawesome/fontawesome-free/css/all.css';
import '@fortawesome/fontawesome-free/css/v4-shims.css';

import './index.scss';
import Main from './components/Main/Main';
// import registerServiceWorker from './registerServiceWorker';
import store from './store';

ReactDOM.render(
  <Provider store={store}>
    <Main />
  </Provider>,
  document.getElementById('root'),
);
// We might re-enable this when app is stable enough that cache won't waste our time anymore:
//registerServiceWorker();
