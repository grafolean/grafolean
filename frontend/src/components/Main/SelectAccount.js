import React from 'react';
import { connect } from 'react-redux';
import { withRouter } from 'react-router-dom';

import store from '../../store';
import { onReceiveAccountsListSuccess } from '../../store/actions';
import PersistentFetcher, { havePermission } from '../../utils/fetch';

import LinkButton from '../LinkButton/LinkButton';
import Loading from '../Loading';

import './SelectAccount.scss';

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
      <div className="select-account">
        <PersistentFetcher
          resource="profile/accounts"
          onUpdate={this.handleAccountsUpdate}
          onError={this.handleAccountsUpdateError}
        />
        {!accounts.list ? (
          <Loading />
        ) : (
          <div className="accounts">
            <label>Accounts:</label>
            {accounts.list.map(account => (
              <LinkButton key={account.id} className="blue" to={`/accounts/${account.id}`}>
                {account.name}
              </LinkButton>
            ))}

            {havePermission('admin/accounts', 'POST', user.permissions) && (
              <LinkButton className="add-account green" to={`/account-add`}>
                <i className="fa fa-plus" /> Add account
              </LinkButton>
            )}
          </div>
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
