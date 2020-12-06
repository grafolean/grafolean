import React from 'react';
import { connect } from 'react-redux';
import { withRouter } from 'react-router-dom';

import isWidget from '../isWidget';
import { PersistentFetcher } from '../../../utils/fetch/PersistentFetcher';
import MatchingPaths from '../GLeanChartWidget/ChartForm/MatchingPaths';
import Loading from '../../Loading';

import './NetFlowNavigationWidget.scss';

class NetFlowNavigationWidget extends React.Component {
  /*
    - fetch the IDs of those entities that have ever collected any netflow traffic (check "netflow.1min.ingress.entity.?" paths)
      - when done, set shared value "selectedEntityId"
    - fetch extended information about these entities
    - fetch the IDs of interfaces from paths (check "netflow.1min.ingress.entity.<entity-id>.if.?" paths)
  */
  state = {
    entitiesIds: null,
    entities: null,
    interfaces: null,
  };

  DIRECTIONS = ['ingress', 'egress'];
  INTERVALS = ['1min', '15min', '1h', '4h', '24h'];
  PATH_FILTER_ENTITIES = 'netflow.1min.ingress.entity.?';
  PATH_FILTER_ENTITIES_REGEX = '^netflow[.]1min[.]ingress[.]entity[.]([^.]+)$';
  DEFAULT_DIRECTION = 'ingress';
  DEFAULT_INTERVAL = '1min';

  componentDidMount() {
    this.initDefaultSharedValues();
  }

  initDefaultSharedValues() {
    const { netflowSelectedDirection, netflowSelectedInterval } = this.props.sharedValues;
    if (!netflowSelectedDirection) {
      this.props.setSharedValue('netflowSelectedDirection', this.DEFAULT_DIRECTION);
    }
    if (!netflowSelectedInterval) {
      this.props.setSharedValue('netflowSelectedInterval', this.DEFAULT_INTERVAL);
    }
  }

  onEntityUpdate = json => {
    const entityId = json.id;
    this.setState(prevState => ({
      entities: {
        ...prevState.entities,
        [entityId]: json,
      },
    }));
    const {
      sharedValues: { selectedEntityId = null },
    } = this.props;

    if (selectedEntityId === null) {
      this.props.setSharedValue('selectedEntityId', entityId);
    }
  };

  onEntityUpdateError = errorMsg => {
    console.log(`Could not fetch data about entity: ${errorMsg.toString()}`);
  };

  onEntitiesPathsUpdate = json => {
    let entitiesIds;
    if (Object.keys(json.paths).length === 0) {
      entitiesIds = [];
    } else {
      entitiesIds = json.paths[this.PATH_FILTER_ENTITIES].map(p =>
        parseInt(MatchingPaths.constructChartSerieName(p.path, this.PATH_FILTER_ENTITIES, '$1', [])),
      );
    }
    this.setState({ entitiesIds: entitiesIds });
  };

  onEntitiesPathsNotification = mqttPayload => {
    // extract the ids of entities if the paths match the netflow entities regex:
    const newEntities = mqttPayload
      .map(p => {
        const matches = [...p.p.matchAll(this.PATH_FILTER_ENTITIES_REGEX)];
        if (matches.length === 0) {
          return null;
        }
        return matches[0][1];
      })
      .filter(entityId => entityId !== null);
    this.setState(prevState => ({
      entitiesIds: [...prevState.entitiesIds, ...newEntities],
    }));
    // do not trigger fetch, we got all the information we need:
    return false;
  };

  onEntitiesInterfacesUpdate = json => {
    const {
      sharedValues: { selectedEntityId },
    } = this.props;
    const filter = `netflow.1min.ingress.entity.${selectedEntityId}.if.?`;
    this.setState({
      interfaces: json.paths[filter].map(p =>
        MatchingPaths.constructChartSerieName(p.path, filter, '$1', []),
      ),
    });
  };

  onChangeDirection = ev => {
    this.props.setSharedValue('netflowSelectedDirection', ev.target.value);
  };

  onChangeSelectedInterval = ev => {
    this.props.setSharedValue('netflowSelectedInterval', ev.target.value);
  };

  onChangeEntity = ev => {
    this.props.setSharedValue('selectedEntityId', parseInt(ev.target.value));
    this.props.setSharedValue('selectedInterface', null);
  };

  onChangeInterface = ev => {
    const newInterface = ev.target.value;
    if (newInterface === '') {
      this.props.setPage('default');
    } else {
      this.props.setPage('netflow_interface');
    }
    this.props.setSharedValue('selectedInterface', newInterface);
  };

  renderDirectionsRadios() {
    const {
      widgetId,
      sharedValues: { netflowSelectedDirection = this.DEFAULT_DIRECTION },
    } = this.props;
    return (
      <div className="radios directions">
        {this.DIRECTIONS.map(direction => (
          <div key={direction}>
            <input
              type="radio"
              name={`${widgetId}-direction`}
              value={direction}
              checked={direction === netflowSelectedDirection}
              onChange={this.onChangeDirection}
            />
            {direction}
          </div>
        ))}
      </div>
    );
  }

  renderIntervalsRadios() {
    const {
      widgetId,
      sharedValues: { netflowSelectedInterval = this.DEFAULT_INTERVAL },
    } = this.props;
    return (
      <div className="radios intervals">
        {this.INTERVALS.map(interval => (
          <div key={interval}>
            <input
              type="radio"
              name={`${widgetId}-interval`}
              value={interval}
              checked={interval === netflowSelectedInterval}
              onChange={this.onChangeSelectedInterval}
            />{' '}
            {interval}
          </div>
        ))}
      </div>
    );
  }

  renderEntitiesDropdown() {
    const {
      sharedValues: { selectedEntityId = null },
    } = this.props;
    const { entities } = this.state;
    if (entities === null) {
      return <Loading />;
    }
    if (Object.keys(entities).length === 0) {
      return <select></select>;
    }
    return (
      <select value={selectedEntityId === null ? '' : selectedEntityId} onChange={this.onChangeEntity}>
        {Object.keys(entities).map(entityId => (
          <option key={entityId} value={entityId}>
            {entities[entityId].name}
          </option>
        ))}
      </select>
    );
  }

  renderInterfacesDropdown() {
    const {
      sharedValues,
      sharedValues: { selectedEntityId = null, selectedInterface = null },
      accountEntities,
    } = this.props;
    const { interfaces } = this.state;
    if (selectedEntityId === null) {
      return null;
    }
    if (interfaces === null) {
      return <Loading />;
    }
    if (interfaces.length === 0) {
      return <select></select>;
    }
    return (
      <select value={selectedInterface === null ? '' : selectedInterface} onChange={this.onChangeInterface}>
        <option value="">-- all interfaces --</option>
        {interfaces.map(iface => (
          <option key={iface} value={iface}>
            Interface:{' '}
            {MatchingPaths.constructChartSerieName(
              '',
              '',
              MatchingPaths.substituteSharedValues(
                `\${interfaceName(${selectedEntityId}, ${iface})}`,
                sharedValues,
              ),
              accountEntities,
            )}
          </option>
        ))}
      </select>
    );
  }

  render() {
    const {
      sharedValues: { selectedEntityId = null },
    } = this.props;
    const { entitiesIds } = this.state;
    const accountId = this.props.match.params.accountId;
    return (
      <div className="netflow-navigation-widget">
        <PersistentFetcher
          resource={`accounts/${accountId}/paths`}
          mqttTopic={`accounts/${accountId}/paths`}
          queryParams={{
            filter: this.PATH_FILTER_ENTITIES,
            limit: 101,
            failover_trailing: false,
          }}
          onUpdate={this.onEntitiesPathsUpdate}
          onNotification={this.onEntitiesPathsNotification}
        />
        {entitiesIds === null ? (
          <Loading />
        ) : entitiesIds.length === 0 ? (
          <div>
            <p>It looks like there is no NetFlow data available for any entity yet.</p>
            <p>How to fix this:</p>
            <ul>
              <li>
                configure the NetFlow exporter of your choice (router, switch,...) to start sending data to
                Grafolean, then
              </li>
              <li>wait a few minutes (this page will automatically refresh).</li>
            </ul>
            For more info, see{' '}
            <a
              href="https://github.com/grafolean/grafolean/blob/master/doc/HOWTO-NetFlow.md"
              target="_blank"
              rel="noopener noreferrer"
            >
              NetFlow guide
            </a>
            .
          </div>
        ) : (
          <>
            {entitiesIds.map(entityId => (
              <PersistentFetcher
                key={entityId}
                resource={`accounts/${accountId}/entities/${entityId}`}
                onUpdate={this.onEntityUpdate}
                onError={this.onEntityUpdateError}
              />
            ))}
            {selectedEntityId !== null && (
              <PersistentFetcher
                key={selectedEntityId}
                resource={`accounts/${accountId}/paths`}
                queryParams={{
                  filter: `netflow.1min.ingress.entity.${selectedEntityId}.if.?`,
                  limit: 101,
                  failover_trailing: false,
                }}
                onUpdate={this.onEntitiesInterfacesUpdate}
              />
            )}
            {this.renderDirectionsRadios()}
            {this.renderIntervalsRadios()}
            {this.renderEntitiesDropdown()}
            {this.renderInterfacesDropdown()}
          </>
        )}
      </div>
    );
  }
}

const mapStoreToProps = store => ({
  accountEntities: store.accountEntities,
});
const _NetFlowNavigationWidget = connect(mapStoreToProps)(NetFlowNavigationWidget);
export default withRouter(isWidget(_NetFlowNavigationWidget));
