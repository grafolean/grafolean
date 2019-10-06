import React from 'react';
import { PersistentFetcher } from '../../utils/fetch/PersistentFetcher';
import Loading from '../Loading';
import LinkButton from '../LinkButton/LinkButton';

class Entity extends React.Component {
  state = {
    entity: null,
  };

  onEntityUpdate = json => {
    this.setState({
      entity: json,
    });
  };

  render() {
    const { accountId, entityId } = this.props.match.params;
    const { entity } = this.state;
    const numberOfSensors = entity
      ? Object.keys(entity.protocols).reduce(
          (sum, protocolSlug) => sum + entity.protocols[protocolSlug].sensors.length,
          0,
        )
      : 0;
    return (
      <>
        <PersistentFetcher
          resource={`accounts/${accountId}/entities/${entityId}`}
          onUpdate={this.onEntityUpdate}
        />

        {entity === null ? (
          <Loading overlayParent={true} />
        ) : (
          <>
            <div className="frame">
              <span>
                Entity: {entity.name}, type: {entity.entity_type}
              </span>
            </div>

            <div className="frame">
              <LinkButton to={`/accounts/${accountId}/entities/view/${entityId}/protocols`}>
                Settings
              </LinkButton>
              <p>Sensors enabled: {numberOfSensors}</p>
            </div>
          </>
        )}
      </>
    );
  }
}
export default Entity;
