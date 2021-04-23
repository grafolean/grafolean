import React from 'react';

const MockContext = React.createContext({
  onMount: props => {
    console.error(
      `MockPersistentFetcher: don't know how to mock resource fetching: ${props.resource}`,
      props,
    );
    console.log(props);
    props.onError(`Don't know how to mock resource fetching: ${props.resource}`);
  },
  onUnmount: props => {},
});
export default MockContext;
