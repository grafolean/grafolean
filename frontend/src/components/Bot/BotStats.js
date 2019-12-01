import React from 'react';
import { Link } from 'react-router-dom';

import { PersistentFetcher } from '../../utils/fetch/PersistentFetcher';
import NotificationBadge from '../Main/SidebarNotificationBadges/NotificationBadge';

export default class BotStats extends React.Component {
  state = {
    entitiesCount: null,
  };

  onEntitiesUpdate = json => {
    const { bot } = this.props;
    const entitiesWithCorrectProtocol = json.list.filter(e => !!e.protocols[bot.protocol.slug]);
    let sensorsCount = 0;
    entitiesWithCorrectProtocol.forEach(e => {
      sensorsCount += e.protocols[bot.protocol.slug].sensors.length;
    });
    this.setState({
      entitiesCount: entitiesWithCorrectProtocol.length,
      sensorsCount: sensorsCount,
    });
  };

  render() {
    const { bot, accountId } = this.props;
    const { entitiesCount, sensorsCount } = this.state;
    return (
      <div>
        <PersistentFetcher resource={`accounts/${accountId}/entities`} onUpdate={this.onEntitiesUpdate} />
        {entitiesCount !== null && (
          <>
            Entities: {entitiesCount}
            <br />
            Sensors: {sensorsCount}
            <Link to={`/accounts/${accountId}/bots/${bot.id}/view`}>
              <NotificationBadge />
            </Link>
          </>
        )}
      </div>
    );
  }
}
