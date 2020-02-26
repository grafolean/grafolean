import React from 'react';
import { withRouter } from 'react-router-dom';
import isWidget from '../isWidget';
import { PersistentFetcher } from '../../../utils/fetch/PersistentFetcher';
import MatchingPaths from '../GLeanChartWidget/ChartForm/MatchingPaths';
import Loading from '../../Loading';

class NetFlowNavigationWidget extends React.Component {
  state = {
    entitiesIds: null,
    entities: null,
    selectedEntityId: null,
    interfaces: null,
    selectedInterface: '',
  };

  PATH_FILTER_ENTITIES = 'netflow.15min.ingress.entity.?';
  PATH_FILTER_ENTITIES = 'netflow.15min.ingress.entity.?';

  onEntitiesPathsUpdate = json => {
    this.setState({
      entitiesIds: json.paths[this.PATH_FILTER_ENTITIES].map(p =>
        parseInt(MatchingPaths.constructChartSerieName(p.path, this.PATH_FILTER_ENTITIES, '$1')),
      ),
    });
  };

  onEntitiesUpdate = json => {
    const { entitiesIds } = this.state;
    const entities = json.list.filter(e => entitiesIds.includes(e.id));
    this.setState({
      entities: entities,
      selectedEntityId: entities.length > 0 ? entities[0].id : null,
    });
  };

  onEntitiesInterfacesUpdate = json => {
    const { selectedEntityId } = this.state;
    const filter = `netflow.15min.ingress.entity.${selectedEntityId}.if.?`;
    this.setState({
      interfaces: json.paths[filter].map(p =>
        parseInt(MatchingPaths.constructChartSerieName(p.path, filter, '$1')),
      ),
    });
  };

  onChangeEntity = ev => {
    this.setState({
      selectedEntityId: parseInt(ev.target.value),
      selectedInterface: '',
    });
  };

  onChangeInterface = ev => {
    const newInterface = ev.target.value;
    if (newInterface === '') {
      this.props.setPage('default');
    } else {
      this.props.setPage('netflow_interface');
    }
    this.setState({
      selectedInterface: newInterface,
    });
  };

  renderEntitiesDropdown() {
    const { entities, selectedEntityId } = this.state;
    if (entities === null) {
      return <Loading overlayParent={true} />;
    }
    if (entities.length === 0) {
      return <select></select>;
    }
    return (
      <select value={selectedEntityId} onChange={this.onChangeEntity}>
        {entities.map(e => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </select>
    );
  }

  renderInterfacesDropdown() {
    const { interfaces, selectedInterface } = this.state;
    if (interfaces === null) {
      return <Loading overlayParent={true} />;
    }
    if (interfaces.length === 0) {
      return <select></select>;
    }
    return (
      <select value={selectedInterface} onChange={this.onChangeInterface}>
        <option value="">-- all interfaces --</option>
        {interfaces.map(iface => (
          <option key={iface} value={iface}>
            Interface index: {iface}
          </option>
        ))}
      </select>
    );
  }

  render() {
    const { widgetId } = this.props;
    const { entitiesIds, selectedEntityId } = this.state;
    const accountId = this.props.match.params.accountId;
    return (
      <div className="netflow-navigation-widget">
        <PersistentFetcher
          resource={`accounts/${accountId}/paths`}
          queryParams={{
            filter: this.PATH_FILTER_ENTITIES,
            limit: 101,
            failover_trailing: false,
          }}
          onUpdate={this.onEntitiesPathsUpdate}
        />
        {entitiesIds && (
          <>
            <PersistentFetcher resource={`accounts/${accountId}/entities`} onUpdate={this.onEntitiesUpdate} />
            {selectedEntityId && (
              <PersistentFetcher
                resource={`accounts/${accountId}/paths`}
                queryParams={{
                  filter: `netflow.15min.ingress.entity.${selectedEntityId}.if.?`,
                  limit: 101,
                  failover_trailing: false,
                }}
                onUpdate={this.onEntitiesInterfacesUpdate}
              />
            )}
          </>
        )}

        <div>
          <input type="radio" name={`${widgetId}-direction`} defaultChecked={true} />
          INGRESS
          <input type="radio" name={`${widgetId}-direction`} />
          EGRESS
        </div>
        <div>
          <input type="radio" name={`${widgetId}-interval`} value="1min" defaultChecked={true} /> 1min
          <input type="radio" name={`${widgetId}-interval`} value="15min" /> 15min
          <input type="radio" name={`${widgetId}-interval`} value="1h" /> 1h
          <input type="radio" name={`${widgetId}-interval`} value="6h" /> 6h
          <input type="radio" name={`${widgetId}-interval`} value="24h" /> 24h
        </div>

        {this.renderEntitiesDropdown()}
        {this.renderInterfacesDropdown()}
      </div>
    );
  }
}

export default withRouter(isWidget(NetFlowNavigationWidget));
