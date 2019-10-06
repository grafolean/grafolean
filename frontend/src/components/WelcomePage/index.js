import React from 'react';
import { Link } from 'react-router-dom';

import { PersistentFetcher } from '../../utils/fetch/PersistentFetcher';

import Loading from '../Loading';

export default class WelcomePage extends React.Component {
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

    if (botsAvailable === null) {
      return <Loading />;
    }

    return (
      <>
        <h3>Welcome!</h3>
        {botsAvailable ? (
          <p>
            Use <Link to={`/accounts/${accountId}/bots`}>bots</Link> to post data and{' '}
            <Link to={`/accounts/${accountId}/dashboards/new`}>dashboards</Link> to view it.
          </p>
        ) : (
          <p>
            To send data to this account, you need to setup at least one{' '}
            <Link to={`/accounts/${accountId}/bots`}>bot</Link>.
          </p>
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
