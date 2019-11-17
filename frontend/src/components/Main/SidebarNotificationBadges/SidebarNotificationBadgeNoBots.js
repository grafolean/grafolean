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
    bots: null,
  };

  onBotsUpdate = json => {
    this.setState({
      bots: json.list,
    });
  };

  render() {
    const accountId = this.props.match.params.accountId;
    const { bots } = this.state;
    const botsAvailable = bots && bots.length > 0;
    const someBotsLoggedIn = bots && bots.filter(b => b.last_login !== null).length > 0;
    return (
      <>
        <PersistentFetcher resource={`accounts/${accountId}/bots`} onUpdate={this.onBotsUpdate} />
        {bots !== null && ((!botsAvailable || !someBotsLoggedIn) && <NotificationBadge />)}
      </>
    );
  }
}
export default withRouter(SidebarNotificationBadgeNoBots);
