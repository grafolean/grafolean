import React from 'react';
import { connect } from 'react-redux';
import { Link } from 'react-router-dom';

import store from '../../store';
import { ROOT_URL, handleFetchErrors, onFailure } from '../../store/actions';
import { havePermission, fetchAuth } from '../../utils/fetch';
import { PersistentFetcher } from '../../utils/fetch/PersistentFetcher';

import Loading from '../Loading';
import EditableLabel from '../EditableLabel';
import HelpSnippet from '../HelpSnippet';

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

  renderNoBotsHelp() {
    const accountId = this.props.match.params.accountId;
    return (
      <HelpSnippet icon="angle-double-right" title="This account doesn't have any bots configured yet">
        <p>
          <b>Bots</b> are external scripts and applications that send values to Grafolean.
        </p>
        <p>To use them, they need to be configured first:</p>
        <Link className="button green" to={`/accounts/${accountId}/bots/new`}>
          <i className="fa fa-plus" /> Add a bot
        </Link>
      </HelpSnippet>
    );
  }

  renderHelp() {
    const { botsAvailable } = this.state;
    const accountId = this.props.match.params.accountId;
    const { user } = this.props;

    if (botsAvailable === null) {
      return <Loading />;
    }

    if (!botsAvailable) {
      return this.renderNoBotsHelp();
    }

    return (
      <>
        {!botsAvailable ? (
          <>
            {havePermission(`/accounts/${accountId}/bots`, 'POST', user.permissions) ? (
              <p>
                Next step is sending some data to Grafolean. To do that, a "bot" needs to be set up - either
                To send data to this account, you need to setup at least one{' '}
                <Link to={`/accounts/${accountId}/bots`}>bot</Link>.
              </p>
            ) : (
              <p>
                The first step would be to set up bots, but you don't seem to have permissions to do that.
                Please contact the account admin.
              </p>
            )}
          </>
        ) : (
          <>
            <p>
              Use <Link to={`/accounts/${accountId}/bots`}>bots</Link> to post data and{' '}
              <Link to={`/accounts/${accountId}/dashboards/new`}>dashboards</Link> to view it.
            </p>
          </>
        )}
      </>
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
