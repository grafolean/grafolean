import React from 'react';

import { resolve } from '../../remote-component.config.js';

import { createRequires, createUseRemoteComponent } from '@paciolan/remote-component';

const url = 'http://localhost:3000/RemoteWidget.js';
const requires = createRequires(resolve);
const useRemoteComponent = createUseRemoteComponent({ requires: requires });

const DynamicallyLoadedWidget = props => {
  const [loading, err, Component] = useRemoteComponent(url);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (err != null) {
    return <div>Unknown Error: {err.toString()}</div>;
  }

  return <Component {...props} />;
};
export default DynamicallyLoadedWidget;
