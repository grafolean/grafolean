import React from 'react';
import { connect } from 'react-redux';
import { Link } from 'react-router-dom';

import store from '../../store';
import { ROOT_URL, handleFetchErrors, onFailure } from '../../store/actions';
import { havePermission, fetchAuth } from '../../utils/fetch';
import { PersistentFetcher } from '../../utils/fetch/PersistentFetcher';

import Loading from '../Loading';
import EditableLabel from '../EditableLabel';

class Account extends React.Component {
  state = {
    botsAvailable: null,
    account: null,
  };

  onAccountUpdate = json => {
    this.setState({
      account: json,
    });
  };

  updateAccountName = newAccountName => {
    const accountId = this.props.match.params.accountId;
    const params = {
      name: newAccountName,
    };
    fetchAuth(`${ROOT_URL}/accounts/${accountId}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'PUT',
      body: JSON.stringify(params),
    })
      .then(handleFetchErrors)
      .catch(errorMsg => store.dispatch(onFailure(errorMsg.toString())));
  };

  onBotsUpdate = json => {
    this.setState({
      botsAvailable: json.list.length > 0,
    });
  };

  renderHelp() {
    const { botsAvailable } = this.state;
    const accountId = this.props.match.params.accountId;

    if (botsAvailable === null) {
      return <Loading />;
    }

    return (
      <p>
        Use <Link to={`/accounts/${accountId}/bots`}>bots</Link> to post data and{' '}
        <Link to={`/accounts/${accountId}/dashboards/new`}>dashboards</Link> to view it.
      </p>
    );
  }

  render() {
    const { account } = this.state;
    const { user } = this.props;
    const accountId = this.props.match.params.accountId;

    return (
      <div>
        <PersistentFetcher resource={`accounts/${accountId}`} onUpdate={this.onAccountUpdate} />
        <PersistentFetcher resource={`accounts/${accountId}/bots`} onUpdate={this.onBotsUpdate} />

        {account === null ? (
          <Loading />
        ) : (
          <>
            <div className="account-name">
              <h3>
                <EditableLabel
                  label={account.name}
                  onChange={this.updateAccountName}
                  isEditable={havePermission(`accounts/${accountId}`, 'POST', user.permissions)}
                />
              </h3>
            </div>

            {this.renderHelp()}
          </>
        )}
      </div>
    );
  }
}
const mapStoreToProps = store => ({
  user: store.user,
});
export default connect(mapStoreToProps)(Account);
