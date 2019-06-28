import React from 'react';
import { connect } from 'react-redux';
import { Link, withRouter } from 'react-router-dom';

import store from '../../store';
import { onReceiveAccountsListSuccess } from '../../store/actions';
import PersistentFetcher, { havePermission } from '../../utils/fetch';

import Loading from '../Loading';

class SelectAccount extends React.Component {
  handleAccountsUpdate = json => {
    store.dispatch(onReceiveAccountsListSuccess(json));
  };

  handleAccountsUpdateError = err => {
    console.err(err);
  };

  render() {
    const { accounts, user } = this.props;
    return (
      <>
        <PersistentFetcher
          resource="profile/accounts"
          onUpdate={this.handleAccountsUpdate}
          onError={this.handleAccountsUpdateError}
        />
        {!accounts.list ? (
          <Loading />
        ) : (
          <>
            <label>Accounts:</label>
            {accounts.list.map(account => (
              <Link key={account.id} className="button blue" to={`/accounts/${account.id}`}>
                {account.name}
              </Link>
            ))}

            {havePermission('admin/accounts', 'POST', user.permissions) && (
              <Link className="button add-account green" to={`/account-add`}>
                <i className="fa fa-plus" /> Add account
              </Link>
            )}
          </>
        )}
      </>
    );
  }
}

const mapStoreToProps = store => ({
  accounts: store.accounts,
  user: store.user,
});
export default withRouter(connect(mapStoreToProps)(SelectAccount));