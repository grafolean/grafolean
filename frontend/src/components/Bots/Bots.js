import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import moment from 'moment-timezone';

import store from '../../store';
import { ROOT_URL, handleFetchErrors, onFailure } from '../../store/actions';
import { fetchAuth } from '../../utils/fetch';
import { PersistentFetcher } from '../../utils/fetch/PersistentFetcher';
import { SUPPORTED_PROTOCOLS } from '../../utils/protocols';
import { useTableSort } from '../../utils/useTableSort';
import { useTableFilter } from '../../utils/useTableFilter';
import TableFilterInput from '../../utils/TableFilterInput';

import Loading from '../Loading';
import Button from '../Button';
import BotToken from './BotToken';
import HelpSnippet from '../HelpSnippets/HelpSnippet';
import NotificationBadge from '../Main/SidebarNotificationBadges/NotificationBadge';
import When from '../When';

import '../form.scss';
import './Bots.scss';

const DEFAULT_SORT_ORDER = [
  ['isSystemwide', true],
  ['name', true],
  ['id', true],
];
const FILTERABLE_FIELDS = ['name', 'protocol'];

function Bots(props) {
  const accountId = props.match.params.accountId;
  const [accountBots, setAccountBots] = useState(null);
  const [systemwideBots, setSystemwideBots] = useState(null);
  const [firstSortKey, firstSortDirection, applySortFunc, sortCompareFunc] = useTableSort(DEFAULT_SORT_ORDER);
  const [filterTableFunc, filter, setFilter] = useTableFilter(FILTERABLE_FIELDS);

  const onAccountBotsUpdate = json => {
    const bots = json.list.map(bot => ({
      ...bot,
      // instead of a protocol slug, use label from SUPPORTED_PROTOCOLS:
      protocol: (SUPPORTED_PROTOCOLS.find(p => p.slug === bot.protocol) || { label: 'custom' }).label,
      isSystemwide: false,
    }));
    setAccountBots(bots);
  };
  const onSystemwideBotsUpdate = json => {
    const bots = json.list.map(bot => ({
      ...bot,
      protocol: (SUPPORTED_PROTOCOLS.find(p => p.slug === bot.protocol) || { label: 'custom' }).label,
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
  const timezoneAbbr = moment().format('z');
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
                <th className="sortable" onClick={() => applySortFunc('name')}>
                  Name
                  {firstSortKey === 'name' && <i className={`fa fa-sort-${firstSortDirection}`} />}
                </th>
                <th className="sortable" onClick={() => applySortFunc('protocol')}>
                  Type
                  {firstSortKey === 'protocol' && <i className={`fa fa-sort-${firstSortDirection}`} />}
                </th>
                <th>Token</th>
                <th className="sortable" onClick={() => applySortFunc('insert_time')}>
                  Insert time ({timezoneAbbr})
                  {firstSortKey === 'insert_time' && <i className={`fa fa-sort-${firstSortDirection}`} />}
                </th>
                <th className="sortable" onClick={() => applySortFunc('last_login')}>
                  Last successful login ({timezoneAbbr})
                  {firstSortKey === 'last_login' && <i className={`fa fa-sort-${firstSortDirection}`} />}
                </th>
                <th align="right">
                  <TableFilterInput filter={filter} setFilter={setFilter} />
                </th>
              </tr>
            </thead>
            <tbody>
              {bots
                .filter(filterTableFunc)
                .sort(sortCompareFunc)
                .map(bot => (
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
                    <td data-label="Type">{bot.protocol}</td>
                    <td data-label="Token">
                      {bot.isSystemwide ? (
                        <BotToken botId={bot.id} isSystemwide={true} />
                      ) : (
                        <BotToken botId={bot.id} isSystemwide={false} accountId={accountId} />
                      )}
                    </td>
                    <td data-label={`Insert time (${timezoneAbbr})`}>
                      {moment(bot.insert_time * 1000).format('YYYY-MM-DD HH:mm:ss')}
                    </td>
                    <td data-label={`Last successful login (${timezoneAbbr})`}>
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
                          {moment(bot.last_login * 1000).format('YYYY-MM-DD HH:mm:ss')} (
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
