import React from 'react';
import { Link } from 'react-router-dom';
import moment from 'moment';

import store from '../../store';
import { SUPPORTED_PROTOCOLS } from '../../utils/protocols';
import { fetchAuth } from '../../utils/fetch';
import { ROOT_URL, handleFetchErrors, onFailure } from '../../store/actions';
import { PersistentFetcher } from '../../utils/fetch/PersistentFetcher';
import Loading from '../Loading';
import BotToken from '../Bots/BotToken';
import When from '../When';
import HelpSnippet from '../HelpSnippets/HelpSnippet';
import Button from '../Button';

export default class SystemwideBots extends React.Component {
  state = {
    bots: null,
  };

  onBotsUpdate = json => {
    // instead of just protocol slug, include all information from SUPPORTED_PROTOCOLS: (like label)
    const bots = json.list.map(bot => ({
      ...bot,
      protocol: SUPPORTED_PROTOCOLS.find(p => p.slug === bot.protocol),
    }));
    this.setState({
      bots: bots,
    });
  };

  handleDelete = (ev, botId) => {
    ev.preventDefault();
    const bot = this.state.bots.find(bot => bot.id === botId);
    if (!window.confirm(`Are you sure you want to delete bot "${bot.name}" ? This can't be undone!`)) {
      return;
    }

    fetchAuth(`${ROOT_URL}/bots/${botId}`, { method: 'DELETE' })
      .then(handleFetchErrors)
      .catch(errorMsg => store.dispatch(onFailure(errorMsg.toString())));
  };

  render() {
    const { bots } = this.state;
    return (
      <>
        <PersistentFetcher resource={`bots`} onUpdate={this.onBotsUpdate} />
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
                  <th />
                  <th />
                </tr>
              </thead>
              <tbody>
                {bots.map(bot => (
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
                      <Button className="red" onClick={ev => this.handleDelete(ev, bot.id)}>
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
}
