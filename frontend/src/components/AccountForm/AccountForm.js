import React from 'react';
import AccountFormRender from './AccountFormRender';

class AccountForm extends React.Component {
  render() {
    const { accountId } = this.props.match.params;
    const editing = Boolean(accountId);
    const resource = editing ? `accounts/${accountId}` : `admin/accounts`;
    return (
      <AccountFormRender
        initialFormValues={{}}
        editing={editing}
        resource={resource}
        afterSubmitRedirectTo="/"
      />
    );
  }
}
export default AccountForm;
