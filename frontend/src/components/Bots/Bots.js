import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import moment from 'moment';

import store from '../../store';
import { ROOT_URL, handleFetchErrors, onFailure } from '../../store/actions';
import { fetchAuth } from '../../utils/fetch';
import { PersistentFetcher } from '../../utils/fetch/PersistentFetcher';
import { SUPPORTED_PROTOCOLS } from '../../utils/protocols';

import Loading from '../Loading';
import Button from '../Button';
import BotToken from './BotToken';
import HelpSnippet from '../HelpSnippets/HelpSnippet';
import NotificationBadge from '../Main/SidebarNotificationBadges/NotificationBadge';
import When from '../When';

import '../form.scss';
import './Bots.scss';

function Bots(props) {
  const accountId = props.match.params.accountId;
  const [accountBots, setAccountBots] = useState(null);
  const [systemwideBots, setSystemwideBots] = useState(null);

  const onAccountBotsUpdate = json => {
    // instead of just protocol slug, include all information from SUPPORTED_PROTOCOLS: (like label)
    const bots = json.list.map(bot => ({
      ...bot,
      protocol: SUPPORTED_PROTOCOLS.find(p => p.slug === bot.protocol),
      isSystemwide: false,
    }));
    setAccountBots(bots);
  };
  const onSystemwideBotsUpdate = json => {
    const bots = json.list.map(bot => ({
      ...bot,
      protocol: SUPPORTED_PROTOCOLS.find(p => p.slug === bot.protocol),
      isSystemwide: true,
    }));
    setSystemwideBots(bots);
  };

  const handleDelete = (ev, botId) => {
    ev.preventDefault();
    const bot = accountBots.find(bot => bot.id === botId);
    if (!window.confirm(`Are you sure you want to delete bot "${bot.name}" ? This can't be undone!`)) {
      return;
    }

    fetchAuth(`${ROOT_URL}/accounts/${accountId}/bots/${botId}`, { method: 'DELETE' })
      .then(handleFetchErrors)
      .catch(errorMsg => store.dispatch(onFailure(errorMsg.toString())));
  };

  const bots = accountBots === null || systemwideBots === null ? null : accountBots.concat(systemwideBots);
  return (
    <>
      <PersistentFetcher resource={`accounts/${accountId}/bots`} onUpdate={onAccountBotsUpdate} />
      <PersistentFetcher resource={`bots`} onUpdate={onSystemwideBotsUpdate} />
      {bots === null ? (
        <Loading />
      ) : bots.length > 0 ? (
        <div className="bots frame">
          <table className="list">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Token</th>
                <th>Insert time (UTC)</th>
                <th>Last successful login (UTC)</th>
                <th>Removal</th>
              </tr>
            </thead>
            <tbody>
              {bots.map(bot => (
                <tr key={bot.id}>
                  <td data-label="Name">
                    {bot.isSystemwide ? (
                      bot.name
                    ) : (
                      <Link className="button green" to={`/accounts/${accountId}/bots/${bot.id}/view`}>
                        <i className="fa fa-robot" /> {bot.name}
                      </Link>
                    )}
                  </td>
                  <td data-label="Type">{bot.protocol ? bot.protocol.label : 'custom'}</td>
                  <td data-label="Token">
                    {bot.isSystemwide ? (
                      <BotToken botId={bot.id} isSystemwide={true} />
                    ) : (
                      <BotToken botId={bot.id} isSystemwide={false} accountId={accountId} />
                    )}
                  </td>
                  <td data-label="Insert time (UTC)">
                    {moment.utc(bot.insert_time * 1000).format('YYYY-MM-DD HH:mm:ss')}
                  </td>
                  <td data-label="Last successful login (UTC)">
                    {bot.last_login === null ? (
                      <>
                        Never
                        {!bot.isSystemwide && (
                          <Link to={`/accounts/${accountId}/bots/${bot.id}/view`}>
                            <NotificationBadge />
                          </Link>
                        )}
                      </>
                    ) : (
                      <>
                        {moment.utc(bot.last_login * 1000).format('YYYY-MM-DD HH:mm:ss')} (
                        <When t={bot.last_login} />)
                      </>
                    )}
                  </td>
                  <td data-label="">
                    {bot.isSystemwide ? (
                      <i className="systemwide">N/A (systemwide)</i>
                    ) : (
                      <Button className="red" onClick={ev => handleDelete(ev, bot.id)}>
                        <i className="fa fa-trash" /> Delete
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Link className="button green" to={`/accounts/${accountId}/bots-new`}>
            <i className="fa fa-plus" /> Add bot
          </Link>
        </div>
      ) : (
        <HelpSnippet title="There are no bots yet" className="first-steps">
          <p>
            <b>Bots</b> are external scripts and applications that send values to Grafolean.
          </p>
          <Link className="button green" to={`/accounts/${accountId}/bots-new`}>
            <i className="fa fa-plus" /> Add bot
          </Link>
        </HelpSnippet>
      )}
    </>
  );
}

export default Bots;
