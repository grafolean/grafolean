import React from 'react';
import CredentialsFormRender from './CredentialsFormRender';

class CredentialsForm extends React.Component {
  render() {
    const { accountId, entityId } = this.props.match.params;
    const editing = Boolean(entityId);
    const resource = editing
      ? `accounts/${accountId}/credentials/${entityId}`
      : `accounts/${accountId}/credentials`;
    return (
      <CredentialsFormRender
        initialFormValues={{}}
        editing={editing}
        resource={resource}
        afterSubmitRedirectTo={`/accounts/${accountId}/credentials`}
      />
    );
  }
}
export default CredentialsForm;
