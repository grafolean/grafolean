import React from 'react';
import EntityFormRender from './EntityFormRender';

class EntityForm extends React.Component {
  render() {
    const { accountId, entityId } = this.props.match.params;
    const editing = Boolean(entityId);
    const resource = editing
      ? `accounts/${accountId}/entities/${entityId}`
      : `accounts/${accountId}/entities`;
    return (
      <EntityFormRender
        initialFormValues={{}}
        editing={editing}
        resource={resource}
        afterSubmitRedirectTo={`/accounts/${accountId}/entities`}
      />
    );
  }
}
export default EntityForm;
