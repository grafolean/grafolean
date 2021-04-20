import React from 'react';

const MockContext = React.createContext({
  onMount: props => {
    console.error(`Don't know how to mock resource fetching: ${props.resource}`);
    console.log({ queryParams });
    props.onError(`Don't know how to mock resource fetching: ${props.resource}`);
  },
  onUnmount: props => {},
});
export default MockContext;
