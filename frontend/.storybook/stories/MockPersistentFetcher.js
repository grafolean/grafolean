import React from 'react';
import MockContext from './MockContext';

export class PersistentFetcher extends React.Component {
  static contextType = MockContext;

  componentDidMount() {
    // this component is driven completely from the test, we are just calling appropriate
    // methods provided by the test:
    this.context.onMount(this.props);
  }

  componentWillUnmount() {
    this.context.onUnmount(this.props);
  }

  render() {
    return null;
  }
}
