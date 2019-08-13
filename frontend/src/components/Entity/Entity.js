import React from 'react';
import { PersistentFetcher } from '../../utils/fetch';
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
              <LinkButton to={`/accounts/${accountId}/entities/view/${entityId}/sensors`}>Sensors</LinkButton>
            </div>
          </>
        )}
      </>
    );
  }
}
export default Entity;
