import React from 'react';
import { withRouter } from 'react-router-dom';
import { resolve } from '../../remote-component.config.js';
import { createRequires, createUseRemoteComponent } from '@paciolan/remote-component';

import { PersistentFetcher } from '../../utils/fetch/PersistentFetcher';

const useRemoteComponent = createUseRemoteComponent({ requires: createRequires(resolve) });

// we need to use a function component because of React hooks:
const RemoteComponent = props => {
  const { url, ...rest } = props;

  const [loading, err, Component] = useRemoteComponent(url);
  if (loading) {
    return <div>Loading component...</div>;
  }
  if (err != null) {
    return <div>Unknown Error: {err.toString()}</div>;
  }

  const g = {
    components: {
      PersistentFetcher: props => <PersistentFetcher {...props} />,
    },
    urlParams: props.match.params,
  };

  return <Component g={g} {...rest} />;
};
export default withRouter(RemoteComponent);
