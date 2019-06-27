import React from 'react';
import { connect } from 'react-redux';
import { withRouter } from 'react-router-dom';
import { stringify } from 'qs';

import { ROOT_URL, handleFetchErrors } from '../../../../store/actions';
import { fetchAuth } from '../../../../utils/fetch';

import './index.scss';

class MatchingPaths extends React.Component {
  /*
    Given the pathFilter, this component fetches the data needed to display the matching paths. When
    props.pathFilter changes, new fetch request is issued (after some small timeout).
  */
  static defaultProps = {
    pathFilter: '',
    pathRenamer: '',
  };
  state = {
    fetched: {
      paths: [],
      pathsWithTrailing: [],
      pathFilter: this.props.pathFilter,
    },
  };
  static MATCH_EXACT = 0;
  static MATCH_WILDCARD = 1;
  static MATCH_RESIDUAL = 2;

  static FETCH_DELAY_MS = 100;

  componentDidMount() {
    this.onPathFilterChange(this.props.pathFilter);
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.pathFilter !== this.props.pathFilter) {
      this.onPathFilterChange(nextProps.pathFilter);
    }
  }

  componentWillUnmount() {
    if (this.fetchInProgressAbortController !== undefined) {
      this.fetchInProgressAbortController.abort();
      this.fetchInProgressAbortController = undefined;
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
      this.fetchInProgressAbortController = undefined;
    }
    // now start a new one after a short timeout:
    this.fetchTimeoutHandle = setTimeout(() => {
      this.fetchInProgressAbortController = new window.AbortController();
      const query_params = {
        filter: newPathFilter,
        limit: 101,
        failover_trailing: 'true',
      };
      this.setState({
        fetchingError: false,
      });
      fetchAuth(
        `${ROOT_URL}/accounts/${this.props.match.params.accountId}/paths/?${stringify(query_params)}`,
        {
          signal: this.fetchInProgressAbortController.signal,
        },
      )
        .then(handleFetchErrors)
        .then(response => response.json())
        .then(json => {
          this.setState({
            fetched: {
              paths: json.paths[newPathFilter] || [],
              pathsWithTrailing: (json.paths_with_trailing && json.paths_with_trailing[newPathFilter]) || [],
              pathFilter: newPathFilter,
            },
          });
        })
        .catch(errorMsg => {
          this.setState({
            fetchingError: true,
          });
        })
        .then(() => {
          this.fetchInProgressAbortController = undefined;
        });
    }, this.FETCH_DELAY_MS);
  }

  static breakMatchingPath(path, partialPathFilter) {
    const regex = `^(${partialPathFilter
      .replace(/[.]/g, '[.]') // escape '.'
      .replace(/[*]/g, ')(.+)(') // escape '*'
      .replace(/[?]/g, ')([^.]+)(')})(.*)$` // escape '?'
      .replace(/[(][)]/g, ''); // get rid of empty parenthesis, if any
    const regexGroupPatterns = regex.substr(2, regex.length - 4).split(')('); // remove leading and trailing 2 chars and split by parenthesis
    const matches = path.match(new RegExp(regex)).slice(1);
    return matches.map((m, i) => ({
      part: m,
      match: regexGroupPatterns[i].endsWith('+')
        ? this.MATCH_WILDCARD
        : regexGroupPatterns[i] === '.*'
        ? this.MATCH_RESIDUAL
        : this.MATCH_EXACT,
    }));
  }

  // given a path, path filter and path renamer, construct a name:
  static constructChartSerieName(path, partialPathFilter, pathRenamer) {
    if (!pathRenamer) {
      return path;
    }
    const parts = this.breakMatchingPath(path, partialPathFilter);
    const wildcardParts = parts.filter(p => p.match === this.MATCH_WILDCARD);
    let ret = pathRenamer;
    for (let i = 0; i < wildcardParts.length; i++) {
      ret = ret.replace(new RegExp(`[$]${i + 1}`, 'g'), wildcardParts[i].part);
    }
    return ret;
  }

  render() {
    const pathsToDisplay =
      this.state.fetched.paths.length > 0 ? this.state.fetched.paths : this.state.fetched.pathsWithTrailing;
    return (
      <div className="matching-paths" onClick={this.props.onClick}>
        {this.state.fetchingError ? (
          <div>Error validating filter</div>
        ) : (
          <div>
            <div className="info">
              Matching paths: {this.state.fetched.paths.length}, partial match:{' '}
              {this.state.fetched.pathsWithTrailing.length}
            </div>
            {pathsToDisplay.map(path => (
              <div key={path}>
                {path}
                <br />
                {this.props.pathRenamer && (
                  <div className="renaming">
                    ⤷{' '}
                    {MatchingPaths.constructChartSerieName(
                      path,
                      this.state.fetched.pathFilter,
                      this.props.pathRenamer,
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
}

const mapStoreToProps = store => ({
  accounts: store.accounts,
});
export default withRouter(connect(mapStoreToProps)(MatchingPaths));
