import React from 'react';
import { PersistentFetcher } from '../../utils/fetch/PersistentFetcher';

export default class BotToken extends React.PureComponent {
  state = {
    showToken: false,
    token: null,
    error: false,
  };

  toggleShowToken = () => {
    this.setState(oldState => ({
      showToken: !oldState.showToken,
    }));
  };

  onTokenUpdate = json => {
    this.setState({
      token: json.token,
    });
  };

  onTokenError = () => {
    this.setState({
      error: true,
    });
  };

  render() {
    const { showToken, token, error } = this.state;
    const { botId, isSystemwide, accountId } = this.props;
    return (
      <div className="bot-token">
        {/* if token should be shown but was not fetched yet, make a "temporary persistent fetcher": :) */}
        {showToken &&
          !token &&
          (isSystemwide ? (
            <PersistentFetcher
              resource={`bots/${botId}/token`}
              onUpdate={this.onTokenUpdate}
              onError={this.onTokenError}
            />
          ) : (
            <PersistentFetcher
              resource={`accounts/${accountId}/bots/${botId}/token`}
              onUpdate={this.onTokenUpdate}
              onError={this.onTokenError}
            />
          ))}

        <i className={`fa fa-eye${showToken ? '-slash' : ''} fa-fw`} onClick={this.toggleShowToken} />
        {!showToken ? '*'.repeat(12) : token ? token : error ? 'not allowed' : '.'.repeat(12)}
      </div>
    );
  }
}
