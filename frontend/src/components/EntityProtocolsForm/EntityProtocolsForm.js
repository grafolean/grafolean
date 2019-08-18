import React from 'react';
import pickBy from 'lodash/pickBy';

import EntityProtocolsFormRender from './EntityProtocolsFormRender';

class EntityProtocolsForm extends React.Component {
  fixValuesBeforeSubmit = formValues => {
    return {
      ...formValues,
      // if credential is not selected, filter out the protocol:
      protocols: pickBy(formValues.protocols, p => Boolean(p.credential)),
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
