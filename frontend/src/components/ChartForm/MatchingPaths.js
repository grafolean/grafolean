import React from 'react';
import { stringify } from 'qs';

import store from '../../store';
import { ROOT_URL, handleFetchErrors, onFailure } from '../../store/actions';

export default class MatchingPaths extends React.Component {
  /*
    Given the pathFilter, this component fetches the data needed to display the matching paths. When
    props.pathFilter changes, new fetch request is issued (after some small timeout).
  */
  static defaultProps = {
    pathFilter: '',
    displayPaths: false,
    initialMatchingPaths: [],  // to save on a request and to display data directly, we get the initial set of matchingPaths (from dashboard)
  };
  static FETCH_DELAY_MS = 100;

  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      matchingPaths: this.props.initialMatchingPaths,
    };
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.pathFilter !== this.props.pathFilter) {
      this.onPathFilterChange(nextProps.pathFilter);
    }
  }

  onPathFilterChange(newPathFilter) {
    // if fetch is being scheduled, cancel it:
    if (this.fetchTimeoutHandle !== null) {
      clearTimeout(this.fetchTimeoutHandle);
      this.fetchTimeoutHandle = null;
    }
    // if fetch is in progress, abort it:
    if (this.fetchInProgressAbortController !== undefined) {
      this.fetchInProgressAbortController.abort();
      this.fetchInProgressAbortController = null;
    }
    // now start a new one after a short timeout:
    this.fetchTimeoutHandle = setTimeout(() => {
      this.fetchInProgressAbortController = new window.AbortController();
      const query_params = {
        filter: newPathFilter,
        limit: 101,
      }
      fetch(`${ROOT_URL}/paths/?${stringify(query_params)}`, { signal: this.fetchInProgressAbortController.signal })
        .then(handleFetchErrors)
        .then(response => response.json())
        .then(json => {
          this.setState({
            matchingPaths: json.paths,
          })
        })
        .catch(errorMsg => store.dispatch(onFailure(errorMsg.toString())))
        .then(() => {
          this.fetchInProgressAbortController = undefined;
        });

    }, this.FETCH_DELAY_MS);
  }

  render() {
    return (
      <div
        style={{
          border: '1px solid #cccccc',
          padding: '5px 15px',
          backgroundColor: '#dadaff',
          fontSize: 13,
          maxHeight: 100,
          overflow: 'auto',
        }}
        onClick={this.props.onClick}
      >
        <div style={{
          fontStyle: 'italic',
        }}>
          Matching paths: {this.state.matchingPaths.length}
        </div>
        {this.props.displayPaths && (
          this.state.matchingPaths.map(mp => (
            <div key={mp}>
              {mp}
            </div>
          ))
        )}
      </div>
    )
  }
}