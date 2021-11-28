import React from 'react';
import { connect } from 'react-redux';
import { RouteComponentProps, withRouter } from 'react-router-dom';
import { stringify } from 'qs';

import { ROOT_URL, handleFetchErrors } from '../../../../store/actions';
import { fetchAuth } from '../../../../utils/fetch';

interface Sensor {
  sensor: number;
  interval: number;
}

interface Protocols {
  [protocol: string]: {
    credential: number;
    sensors: Sensor[];
  };
}

interface AccountEntity {
  id: number;
  name: string;
  entity_type: string; // 'device' / 'interface'
  parent: number;
  details: any;
  protocols: Protocols;
}

interface RouterProps {
  accountId: string;
}

interface MatchingPathsProps extends RouteComponentProps<RouterProps> {
  pathFilter: string;
  onClick: React.MouseEventHandler<HTMLDivElement> | undefined;
  pathRenamer: string;
  accountEntities: AccountEntity[];
}

class MatchingPaths extends React.Component<MatchingPathsProps, any> {
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
    fetchingError: false,
  };
  fetchInProgressAbortController: AbortController | null = null;
  fetchTimeoutHandle: ReturnType<typeof setTimeout> | null = null;

  static MATCH_EXACT = 0;
  static MATCH_WILDCARD = 1;
  static MATCH_RESIDUAL = 2;

  static FETCH_DELAY_MS = 100;

  componentDidMount() {
    this.onPathFilterChange(this.props.pathFilter);
  }

  componentDidUpdate(prevProps: MatchingPathsProps) {
    if (prevProps.pathFilter !== this.props.pathFilter) {
      this.onPathFilterChange(this.props.pathFilter);
    }
  }

  componentWillUnmount() {
    const fetchInProgressAbortController = this.fetchInProgressAbortController;
    if (fetchInProgressAbortController !== null) {
      fetchInProgressAbortController.abort();
      this.fetchInProgressAbortController = null;
    }
  }

  onPathFilterChange(newPathFilter: string) {
    // if fetch is being scheduled, cancel it:
    if (this.fetchTimeoutHandle !== null) {
      clearTimeout(this.fetchTimeoutHandle);
      this.fetchTimeoutHandle = null;
    }
    // if fetch is in progress, abort it:
    if (this.fetchInProgressAbortController !== null) {
      this.fetchInProgressAbortController.abort();
      this.fetchInProgressAbortController = null;
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
              paths:
                json.paths && json.paths[newPathFilter]
                  ? json.paths[newPathFilter].map((p: any) => p.path)
                  : [],
              pathsWithTrailing: json.paths_with_trailing
                ? json.paths_with_trailing[newPathFilter].map((p: any) => p.path)
                : [],
              pathFilter: newPathFilter,
            },
          });
        })
        .catch(errorMsg => {
          console.error(errorMsg);
          this.setState({
            fetchingError: true,
          });
        })
        .then(() => {
          this.fetchInProgressAbortController = null;
        });
    }, MatchingPaths.FETCH_DELAY_MS);
  }

  static breakMatchingPath(path: string, partialPathFilter: string) {
    const regex = `^(${partialPathFilter
      .replace(/[.]/g, '[.]') // escape '.'
      .replace(/[*]/g, ')(.+)(') // escape '*'
      .replace(/[?]/g, ')([^.]+)(')})(.*)$` // escape '?'
      .replace(/[(][)]/g, ''); // get rid of empty parenthesis, if any
    const regexGroupPatterns = regex.substr(2, regex.length - 4).split(')('); // remove leading and trailing 2 chars and split by parenthesis
    if (!path) {
      return [];
    }
    const allMatches = path.match(new RegExp(regex));
    if (!allMatches) {
      return [];
    }
    const matches = allMatches.slice(1);
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
  static constructChartSerieName(
    path: string,
    partialPathFilter: string,
    pathRenamer: string,
    accountEntities: AccountEntity[],
  ) {
    if (!pathRenamer) {
      return path;
    }
    const parts = this.breakMatchingPath(path, partialPathFilter);
    const wildcardParts = parts.filter(p => p.match === this.MATCH_WILDCARD);
    let ret = pathRenamer;
    for (let i = 0; i < wildcardParts.length; i++) {
      ret = ret.replace(
        new RegExp(`[$]${i + 1}`, 'g'),
        wildcardParts[i].part.replace(/[%]2e/g, '.').replace(/[%]3a/g, ':'),
      );
    }
    if (!ret.includes('$')) {
      return ret;
    }

    // Sometimes, we wish to replace parts of the result with some other information. Example of this is replacing the SNMP indexes
    // of network interfaces with their names, as gathered from entities (interfaces are entities with entity_type == 'interface' and
    // parent == device entity id).
    // This is not the cleanest solution, we might need to re-implement it later a bit more nicely when we know more about other
    // possible use-cases.
    const PATH_RENAMING_MODIFIERS = [
      {
        regex: /[$][{]interfaceName[(]([0-9]+)[,][ ]*([^)]+)[)][}]/g,
        replacementFunc: (match: string, parentEntityId: any, interfaceSNMPIndex: any) => {
          const parentEntityIdInt = parseInt(parentEntityId);
          if (!accountEntities) {
            return `interface ${interfaceSNMPIndex}`;
          }
          const ifEntity = accountEntities.find(
            e =>
              e.parent === parentEntityIdInt &&
              e.entity_type === 'interface' &&
              e.details.snmp_index === interfaceSNMPIndex,
          );
          if (!ifEntity) {
            return `interface ${interfaceSNMPIndex}`;
          }
          return ifEntity.name;
        },
      },
      {
        regex: /[$][{]deviceName[(]([0-9]+)[)][}]/g,
        replacementFunc: (match: string, deviceEntityId: any) => {
          const deviceEntityIdInt = parseInt(deviceEntityId);
          if (!accountEntities) {
            return `device ${deviceEntityId}`;
          }
          const entity = accountEntities.find(e => e.id === deviceEntityIdInt && e.entity_type === 'device');
          if (!entity) {
            return `device ${deviceEntityId}`;
          }
          return entity.name;
        },
      },
    ];

    for (let i = 0; i < PATH_RENAMING_MODIFIERS.length; i++) {
      ret = ret.replace(PATH_RENAMING_MODIFIERS[i].regex, PATH_RENAMING_MODIFIERS[i].replacementFunc);
    }
    return ret;
  }

  static substituteSharedValues(path: string, sharedValues: Record<string, string>) {
    let result = path;
    for (const k in sharedValues) {
      result = result.replace(new RegExp(`[$]${k}`, 'g'), String(sharedValues[k]));
    }
    return result;
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
                      this.props.accountEntities,
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

const mapStoreToProps = (store: any) => ({
  accountEntities: store.accountEntities,
});
export default withRouter(connect(mapStoreToProps)(MatchingPaths));
