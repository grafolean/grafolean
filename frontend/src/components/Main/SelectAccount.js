import React from 'react';
import { connect } from 'react-redux';
import { Link, withRouter, Redirect } from 'react-router-dom';

import store from '../../store';
import { onReceiveAccountsListSuccess } from '../../store/actions';
import { havePermission } from '../../utils/fetch';
import { PersistentFetcher } from '../../utils/fetch/PersistentFetcher';

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
    const { canCreateAccount } = havePermission('admin/accounts', 'POST', user.permissions);

    // if user can't add new accounts and only has access to a single account, there is no
    // need for them to select an account - just redirect them to that account:
    if (!!accounts.list && accounts.list.length === 1 && !canCreateAccount) {
      return <Redirect to={`accounts/${accounts.list[0].id}`} />;
    }

    return (
      <div className="frame">
        <PersistentFetcher
          resource="accounts"
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

            {canCreateAccount && (
              <Link className="button add-account green" to={`/accounts-new`}>
                <i className="fa fa-plus" /> Add account
              </Link>
            )}
          </>
        )}
      </div>
    );
  }
}

const mapStoreToProps = store => ({
  accounts: store.accounts,
  user: store.user,
});
export default withRouter(connect(mapStoreToProps)(SelectAccount));
