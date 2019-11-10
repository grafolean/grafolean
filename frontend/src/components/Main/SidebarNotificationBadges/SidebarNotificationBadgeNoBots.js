import React from 'react';
import { withRouter } from 'react-router-dom';

import { PersistentFetcher } from '../../../utils/fetch/PersistentFetcher';
import SidebarNotificationBadge from './SidebarNotificationBadge';

class SidebarNotificationBadgeNoBots extends React.Component {
  state = {
    botsAvailable: null,
  };

  onBotsUpdate = json => {
    this.setState({
      botsAvailable: json.list.length > 0,
    });
  };

  render() {
    const accountId = this.props.match.params.accountId;
    const { botsAvailable } = this.state;
    return (
      <>
        <PersistentFetcher resource={`accounts/${accountId}/bots`} onUpdate={this.onBotsUpdate} />
        {botsAvailable === false && <SidebarNotificationBadge />}
      </>
    );
  }
}
export default withRouter(SidebarNotificationBadgeNoBots);
