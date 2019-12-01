import React from 'react';
import { withRouter } from 'react-router-dom';

import { PersistentFetcher } from '../../../utils/fetch/PersistentFetcher';
import NotificationBadge from './NotificationBadge';

class SidebarNotificationBadgeNoBots extends React.Component {
  /*
    There is something wrong with the bots:
    - there aren't any
    - none of them have successfully logged-in yet (ever)
  */
  state = {
    accountBots: null,
    systemwideBots: null,
  };

  onAccountBotsUpdate = json => {
    this.setState({
      accountBots: json.list,
    });
  };
  onSystemwideBotsUpdate = json => {
    this.setState({
      systemwideBots: json.list,
    });
  };

  render() {
    const accountId = this.props.match.params.accountId;
    const { accountBots, systemwideBots } = this.state;
    const bots = accountBots === null || systemwideBots === null ? null : accountBots.concat(systemwideBots);
    const botsAvailable = bots && bots.length > 0;
    const someBotsLoggedIn = bots && bots.filter(b => b.last_login !== null).length > 0;
    return (
      <>
        <PersistentFetcher resource={`accounts/${accountId}/bots`} onUpdate={this.onAccountBotsUpdate} />
        <PersistentFetcher resource={`bots`} onUpdate={this.onSystemwideBotsUpdate} />
        {bots !== null && ((!botsAvailable || !someBotsLoggedIn) && <NotificationBadge />)}
      </>
    );
  }
}
export default withRouter(SidebarNotificationBadgeNoBots);
