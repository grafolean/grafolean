import React from 'react';
import CredentialsFormRender from './CredentialsFormRender';

class CredentialsForm extends React.Component {
  render() {
    const { accountId, credentialId } = this.props.match.params;
    const editing = Boolean(credentialId);
    const resource = editing
      ? `accounts/${accountId}/credentials/${credentialId}`
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
