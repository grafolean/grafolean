import React from 'react';
import CredentialsFormRender from './CredentialsFormRender';

class CredentialsForm extends React.Component {
  render() {
    const { accountId, credentialsId } = this.props.match.params;
    const editing = Boolean(credentialsId);
    const resource = editing
      ? `accounts/${accountId}/credentials/${credentialsId}`
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
