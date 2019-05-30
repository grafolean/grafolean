import React from 'react';
import { connect } from 'react-redux';

import { havePermission } from '../../utils/fetch';

import './SelectAccountPage.scss';
import { doLogout } from '../../store/helpers';
import store from '../../store';
import { onAccountSelect } from '../../store/actions';

class SelectAccountPage extends React.PureComponent {
  render() {
    const { accounts, user } = this.props;
    return (
      <div className="select-account-page">
        <div className="accounts">
          <button className="logout" onClick={doLogout}>
            <i className="fa fa-sign-out" />
          </button>

          <label>Accounts:</label>
          {accounts.list.map(account => (
            <button
              key={account.id}
              className="blue"
              onClick={() => store.dispatch(onAccountSelect(account.id))}
            >
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
