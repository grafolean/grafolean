import React from 'react';
import { connect } from 'react-redux';
import { Link } from 'react-router-dom';

import { PersistentFetcher } from '../../utils/fetch/PersistentFetcher';

import Loading from '../Loading';
import { havePermission } from '../../utils/fetch';

class WelcomePage extends React.Component {
  state = {
    botsAvailable: null,
  };

  onBotsUpdate = json => {
    this.setState({
      botsAvailable: json.list.length > 0,
    });
  };

  renderContent() {
    const { botsAvailable } = this.state;
    const accountId = this.props.match.params.accountId;
    const { user } = this.props;

    if (botsAvailable === null) {
      return <Loading />;
    }

    return (
      <>
        {!botsAvailable ? (
          <>
            <h3>Welcome to your account!</h3>
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
    const accountId = this.props.match.params.accountId;
    return (
      <div>
        <PersistentFetcher resource={`accounts/${accountId}/bots`} onUpdate={this.onBotsUpdate} />
        {this.renderContent()}
      </div>
    );
  }
}
const mapStoreToProps = store => ({
  user: store.user,
});
export default connect(mapStoreToProps)(WelcomePage);
