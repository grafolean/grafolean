import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import moment from 'moment';

import store from '../../store';
import { SUPPORTED_PROTOCOLS } from '../../utils/protocols';
import { fetchAuth } from '../../utils/fetch';
import { ROOT_URL, handleFetchErrors, onFailure } from '../../store/actions';
import { PersistentFetcher } from '../../utils/fetch/PersistentFetcher';
import { useTableSort } from '../../utils/useTableSort';

import Loading from '../Loading';
import BotToken from '../Bots/BotToken';
import When from '../When';
import HelpSnippet from '../HelpSnippets/HelpSnippet';
import Button from '../Button';

const DEFAULT_SORT_ORDER = [
  ['name', true],
  ['id', true],
];

export default function SystemwideBots(props) {
  const accountId = props.match.params.accountId;
  const [bots, setBots] = useState(null);
  const [firstSortKey, firstSortDirection, applySortFunc, sortCompareFunc] = useTableSort(DEFAULT_SORT_ORDER);

  const onBotsUpdate = json => {
    // instead of just protocol slug, include all information from SUPPORTED_PROTOCOLS: (like label)
    const bots = json.list.map(bot => ({
      ...bot,
      protocol_slug: bot.protocol,
      protocol: SUPPORTED_PROTOCOLS.find(p => p.slug === bot.protocol),
    }));
    setBots(bots);
  };

  const handleDelete = (ev, botId) => {
    ev.preventDefault();
    const bot = bots.find(bot => bot.id === botId);
    if (!window.confirm(`Are you sure you want to delete bot "${bot.name}" ? This can't be undone!`)) {
      return;
    }

    fetchAuth(`${ROOT_URL}/bots/${botId}`, { method: 'DELETE' })
      .then(handleFetchErrors)
      .catch(errorMsg => store.dispatch(onFailure(errorMsg.toString())));
  };

  return (
    <>
      <PersistentFetcher resource={`bots`} onUpdate={onBotsUpdate} />
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
                <th className="sortable" onClick={() => applySortFunc('protocol_slug')}>
                  Type
                  {firstSortKey === 'protocol_slug' && <i className={`fa fa-sort-${firstSortDirection}`} />}
                </th>
                <th>Token</th>
                <th className="sortable" onClick={() => applySortFunc('insert_time')}>
                  Insert time (UTC)
                  {firstSortKey === 'insert_time' && <i className={`fa fa-sort-${firstSortDirection}`} />}
                </th>
                <th className="sortable" onClick={() => applySortFunc('last_login')}>
                  Last successful login (UTC)
                  {firstSortKey === 'last_login' && <i className={`fa fa-sort-${firstSortDirection}`} />}
                </th>
                <th />
                <th />
              </tr>
            </thead>
            <tbody>
              {bots.sort(sortCompareFunc).map(bot => (
                <tr key={bot.id}>
                  <td data-label="Name">
                    <Link className="button green" to={`/bots/${bot.id}/edit`}>
                      <i className="fa fa-robot" /> {bot.name}
                    </Link>
                  </td>
                  <td data-label="Type">{bot.protocol ? bot.protocol.label : 'custom'}</td>
                  <td data-label="Token">
                    <BotToken botId={bot.id} isSystemwide={true} />
                  </td>
                  <td data-label="Insert time (UTC)">
                    {moment.utc(bot.insert_time * 1000).format('YYYY-MM-DD HH:mm:ss')}
                  </td>
                  <td data-label="Last successful login (UTC)">
                    {bot.last_login === null ? (
                      <>Never</>
                    ) : (
                      <>
                        {moment.utc(bot.last_login * 1000).format('YYYY-MM-DD HH:mm:ss')} (
                        <When t={bot.last_login} />)
                      </>
                    )}
                  </td>
                  <td>
                    <Link className="button green" to={`/bots/${bot.id}/permissions`}>
                      <i className="fa fa-user-lock" /> Permissions
                    </Link>
                  </td>
                  <td data-label="">
                    <Button className="red" onClick={ev => handleDelete(ev, bot.id)}>
                      <i className="fa fa-trash" /> Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Link className="button green" to={`/bots-new`}>
            <i className="fa fa-plus" /> Add bot
          </Link>
        </div>
      ) : (
        <HelpSnippet title="There are no systemwide bots yet" className="first-steps">
          <p>
            <b>Bots</b> are external scripts and applications that send values to Grafolean. Systemwide bots
            can be used by multiple accounts.
          </p>
          <Link className="button green" to={`/bots-new`}>
            <i className="fa fa-plus" /> Add a systemwide bot
          </Link>
        </HelpSnippet>
      )}
    </>
  );
}
