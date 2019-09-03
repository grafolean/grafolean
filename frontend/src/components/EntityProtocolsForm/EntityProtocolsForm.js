import React from 'react';
import pickBy from 'lodash/pickBy';

import EntityProtocolsFormRender from './EntityProtocolsFormRender';

class EntityProtocolsForm extends React.Component {
  fixValuesBeforeSubmit = formValues => {
    // if credential is not selected, filter out the protocol:
    let protocols = pickBy(formValues.protocols, p => Boolean(p.credential));
    for (let protocol in protocols) {
      // if user enabled protocol (selected credential) without choosing the sensors, the array might
      // be undefined, which is not allowed by backend:
      if (!protocols[protocol].sensors) {
        protocols[protocol].sensors = [];
      }
      // fix data type of intervals to a number:
      protocols[protocol].sensors = protocols[protocol].sensors.map(s => ({
        sensor: s.sensor,
        interval: s.interval === null ? null : Number(s.interval),
      }));
    }
    return {
      ...formValues,
      protocols: protocols,
    };
  };

  render() {
    const { accountId, entityId } = this.props.match.params;
    const resource = `accounts/${accountId}/entities/${entityId}`;
    return (
      <EntityProtocolsFormRender
        editing={true} // we always edit an existing entity, creating form is done via EntityForm
        resource={resource}
        fixValuesBeforeSubmit={this.fixValuesBeforeSubmit}
        afterSubmitRedirectTo={`/accounts/${accountId}/entities/view/${entityId}`}
      />
    );
  }
}
export default EntityProtocolsForm;
