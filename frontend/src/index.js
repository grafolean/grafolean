import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import '@fortawesome/fontawesome-free/css/all.css';
import '@fortawesome/fontawesome-free/css/v4-shims.css';

import './index.scss';
import MainWrapper from './components/Main/MainWrapper';
import store from './store';
import BackendStatusUpdater from './components/BackendStatusUpdater/BackendStatusUpdater';

ReactDOM.render(
  <Provider store={store}>
    <BrowserRouter>
      <div id="theme" className="dark-mode">
        <BackendStatusUpdater />
        <MainWrapper />
      </div>
    </BrowserRouter>
  </Provider>,
  document.getElementById('root'),
);
//registerServiceWorker();
