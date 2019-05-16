import React from 'react';
import { connect } from 'react-redux';

import { havePermission } from '../../utils/fetch';

import './SelectAccountPage.scss';

class SelectAccountPage extends React.PureComponent {
  render() {
    const { accounts, user } = this.props;
    return (
      <div className="select-account-page">
        <div className="accounts">
          <label>Accounts:</label>
          {accounts.list.map(account => (
            <button key={account.id} className="account">
              {account.name}
            </button>
          ))}
          {havePermission('admin/accounts', 'POST', user.permissions) && (
            <button className="add-account green">
              <i className="fa fa-plus" /> Add account
            </button>
          )}
        </div>
      </div>
    );
  }
}

const mapStoreToProps = store => ({
  accounts: store.accounts,
  user: store.user,
});
export default connect(mapStoreToProps)(SelectAccountPage);
