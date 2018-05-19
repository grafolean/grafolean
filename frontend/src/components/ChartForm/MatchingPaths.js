import React from 'react';
import { stringify } from 'qs';

import { ROOT_URL, handleFetchErrors } from '../../store/actions';

export default class MatchingPaths extends React.Component {

  static MATCH_EXACT = 0;
  static MATCH_WILDCARD = 1;
  static MATCH_RESIDUAL = 2;

  /*
    Given the pathFilter, this component fetches the data needed to display the matching paths. When
    props.pathFilter changes, new fetch request is issued (after some small timeout).
  */
  static defaultProps = {
    pathFilter: '',
    pathRenamer: '',
    displayPaths: false,
    initialMatchingPaths: [],  // to save on a request and to display data directly, we get the initial set of matchingPaths (from dashboard)
  };
  static FETCH_DELAY_MS = 100;

  constructor(props) {
    super(props);
    this.state = {
      fetched: {
        matchingPaths: this.props.initialMatchingPaths,
        pathFilter: this.props.pathFilter,
      }
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
            fetched: {
              matchingPaths: json.paths,
              pathFilter: newPathFilter,
            }
          })
        })
        .catch(errorMsg => {
          this.setState({
            fetched: {
              error: true,
            },
          });
        })
        .then(() => {
          this.fetchInProgressAbortController = undefined;
        });

    }, this.FETCH_DELAY_MS);
  }

  static breakMatchingPath(path, partialPathFilter) {
    const regex = `^(${partialPathFilter
      .replace(/[.]/g, '[.]')     // escape '.'
      .replace(/[*]/g, ')(.+)(')  // escape '*'
      .replace(/[?]/g, ')([^.]+)(')})(.*)$`    // escape '?'
      .replace(/[(][)]/g, '');    // get rid of empty parenthesis, if any
    const regexGroupPatterns = regex.substr(2, regex.length - 4).split(")("); // remove leading and trailing 2 chars and split by parenthesis
    const matches = path.match(new RegExp(regex)).slice(1)
    return matches.map((m, i) => ({
      part: m,
      match: regexGroupPatterns[i].endsWith('+') ? this.MATCH_WILDCARD : (
          regexGroupPatterns[i] === '.*' ? this.MATCH_RESIDUAL : this.MATCH_EXACT
        ),
    }));
  }

  // given a path, path filter and path renamer, construct a name:
  static constructPathName(path, partialPathFilter, pathRenamer) {
    const parts = this.breakMatchingPath(path, partialPathFilter);
    const wildcardParts = parts.filter(p => p.match === this.MATCH_WILDCARD);
    let ret = pathRenamer;
    for (let i=0; i<wildcardParts.length; i++) {
      ret = ret.replace(new RegExp(`[$]${i+1}`, 'g'), wildcardParts[i].part);
    }
    return ret;
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
        {this.state.fetched.error ? (
          <div>
            Invalid path filter
          </div>
        ) : (
          <div>
            <div style={{
              fontStyle: 'italic',
            }}>
              Matching paths: {this.state.fetched.matchingPaths.length}
            </div>
            {this.props.displayPaths && (
              this.state.fetched.matchingPaths.map(path => (
                <div key={path}>
                  {path}<br />
                  {this.props.pathRenamer && (
                    <div
                      style={{
                        marginLeft: 20,
                      }}
                    >
                      ⤷ {MatchingPaths.constructPathName(path, this.state.fetched.pathFilter, this.props.pathRenamer)}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    )
  }
}