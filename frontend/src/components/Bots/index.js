import React from 'react';
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
import LinkButton from '../LinkButton/LinkButton';
import HelpSnippet from '../HelpSnippets/HelpSnippet';
import NotificationBadge from '../Main/SidebarNotificationBadges/NotificationBadge';
import When from '../When';

import '../form.scss';
import './bots.scss';

export default class Bots extends React.PureComponent {
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

    fetchAuth(`${ROOT_URL}/accounts/${this.props.match.params.accountId}/bots/${botId}`, { method: 'DELETE' })
      .then(handleFetchErrors)
      .then(() =>
        this.setState(
          {
            bots: null,
          },
          this.fetchBots,
        ),
      )
      .catch(errorMsg => store.dispatch(onFailure(errorMsg.toString())));
  };

  renderPingBotHelp(bot) {
    const backendUrlHostname = new URL(process.env.REACT_APP_BACKEND_ROOT_URL).hostname;
    const backendUrlIsLocalhost =
      backendUrlHostname === 'localhost' || backendUrlHostname.match(/^127[.]0[.]0[.][0-9]{1,3}$/);
    const backendUrlHostnameInPre = <span className="pre">{backendUrlHostname}</span>;
    return (
      <HelpSnippet
        title={
          <>
            How to send values using <b>"{bot.name}"</b> ICMP Ping bot
          </>
        }
      >
        {backendUrlIsLocalhost && (
          <div className="p warning">
            <i className="fa fa-exclamation-triangle" />
            <b>IMPORTANT:</b> the example URLs below are incorrect. Since browser is accessing backend via
            {backendUrlHostnameInPre}, we can't know how ICMP Ping Collector will be able to access it.
            However it will <i>not</i> be able use the address {backendUrlHostnameInPre}, even if started on
            the same machine (because ICMP Ping Collector runs inside the container). In other words, please
            change the URLs appropriately (replace {backendUrlHostnameInPre} with appropriate domain or IP
            address), otherwise the bot will <b>not be able to connect</b>.
          </div>
        )}

        <div className="p">
          Bot <i>"{bot.name}"</i> is a ICMP Ping bot / collector. It needs to be installed on a server which
          will have access to all the devices it needs to monitor, and it needs to be able to connect to
          Grafolean via HTTP(S) port.
        </div>
        <div className="p">
          The installation instructions are available on{' '}
          <a href="https://gitlab.com/grafolean/grafolean-collector-ping">Grafolean ICMP Ping collector</a>{' '}
          Git repository, but in short:
          <ol>
            <li>
              check that backend is reachable:
              <pre>
                {String.raw`$ curl ${process.env.REACT_APP_BACKEND_ROOT_URL}/status/info
{"alive": true, ...`}
              </pre>
            </li>

            <li>
              install ICMP Ping collector:
              <pre>
                {String.raw`$ mkdir ~/pingcollector
$ cd ~/pingcollector
$ curl https://gitlab.com/grafolean/grafolean-collector-ping/raw/master/docker-compose.yml -o docker-compose.yml
$ echo "BACKEND_URL=${process.env.REACT_APP_BACKEND_ROOT_URL}" > .env
$ echo "BOT_TOKEN=${bot.token}" >> .env
$ docker-compose up -d
`}
              </pre>
            </li>
          </ol>
        </div>
        <div className="p">
          If installation was successful, you should see the updated "Last successful login" time for this bot
          in a few minutes. Congratulations, now you can configure Entities (devices), their Credentials and
          Sensors.
        </div>
        <div className="p">
          If not, the best place to start is the logs:{' '}
          <span className="pre">docker logs -f grafolean-collector-ping</span>.
        </div>
      </HelpSnippet>
    );
  }

  renderCustomBotHelp(bot) {
    const accountId = this.props.match.params.accountId;
    const backendUrlHostname = new URL(process.env.REACT_APP_BACKEND_ROOT_URL).hostname;
    const backendUrlIsLocalhost =
      backendUrlHostname === 'localhost' || backendUrlHostname.match(/^127[.]0[.]0[.][0-9]{1,3}$/);
    const backendUrlHostnameInPre = <span className="pre">{backendUrlHostname}</span>;
    return (
      <HelpSnippet
        title={
          <>
            How to send values using <b>"{bot.name}"</b> custom bot
          </>
        }
      >
        {backendUrlIsLocalhost && (
          <div className="p warning">
            <i className="fa fa-exclamation-triangle" />
            <b>IMPORTANT:</b> the example URLs below might be incorrect. Since browser is accessing backend
            via {backendUrlHostnameInPre}, we can't know how the bot will be able to access it. In other
            words, please change the URLs appropriately (replace {backendUrlHostnameInPre} with externally
            accessible domain or IP address), otherwise the bot might not be able to connect.
          </div>
        )}

        <div className="p">
          Bot <i>"{bot.name}"</i> is a "custom" bot, which means that it is <strong>not</strong> configured
          via Grafolean UI. Instead, it should simply periodically send data to Grafolean. Usually this is
          done with <a href="https://en.wikipedia.org/wiki/Cron">cron</a> jobs, but you can use any other
          scheduler / platform / script / programming language - we are using regular HTTP(S) API to receive
          values.
        </div>
        <div className="p">
          Sending values using current time uses <i>POST</i> method:
          <pre>
            {String.raw`$ curl \
  -X POST \
  '${ROOT_URL}/accounts/${accountId}/values/?p=myhouse.livingroom.humidity&v=57.3&b=${bot.token}'`}
          </pre>
        </div>
        <div className="p">
          Sending more values at once is also possible:
          <pre>
            {String.raw`$ curl \
  -X POST \
  -H 'Content-Type: application/json' \
  -d '[ { "p": "myhouse.livingroom.humidity", "v": 57.3 }, { "p": "myhouse.livingroom.temperature.kelvin", "v": 293.2 } ]' \
  '${ROOT_URL}/accounts/${accountId}/values/?b=${bot.token}'`}
          </pre>
        </div>
        <div className="p">
          For sending historical data you must use <i>PUT</i> method and specify the time explicitly:
          <pre>
            {String.raw`$ curl \
  -X PUT \
  -H 'Content-Type: application/json' \
  -d '[ { "p": "myhouse.livingroom.humidity", "v": 57.3, "t": 1234567890.012345 }, { "p": "myhouse.livingroom.humidity", "v": 57.2, "t": 1234567899 } ]' \
  '${ROOT_URL}/accounts/${accountId}/values/?b=${bot.token}'`}
          </pre>
        </div>
      </HelpSnippet>
    );
  }

  render() {
    const { bots } = this.state;
    const accountId = this.props.match.params.accountId;
    // const helpBotIdParam = new URLSearchParams(this.props.location.search).get('infoAbout');
    // const helpBot = bots === null ? null : bots.find(b => b.id === Number(helpBotIdParam));
    return (
      <>
        <PersistentFetcher resource={`accounts/${accountId}/bots`} onUpdate={this.onBotsUpdate} />
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
                  <th />
                </tr>
              </thead>
              <tbody>
                {bots.map(bot => (
                  <tr key={bot.id}>
                    <td data-label="Name">
                      <Link className="button green" to={`/accounts/${accountId}/bots/view/${bot.id}`}>
                        <i className="fa fa-robot" /> {bot.name}
                      </Link>
                    </td>
                    <td data-label="Type">{bot.protocol ? bot.protocol.label : 'custom'}</td>
                    <td data-label="Token">
                      <BotToken token={bot.token} />
                    </td>
                    <td data-label="Insert time (UTC)">
                      {moment.utc(bot.insert_time * 1000).format('YYYY-MM-DD HH:mm:ss')}
                    </td>
                    <td data-label="Last successful login (UTC)">
                      {bot.last_login === null ? (
                        <>
                          Never
                          <Link to={`/accounts/${accountId}/bots/view/${bot.id}`}>
                            <NotificationBadge />
                          </Link>
                        </>
                      ) : (
                        <>
                          {moment.utc(bot.last_login * 1000).format('YYYY-MM-DD HH:mm:ss')} (
                          <When t={bot.last_login} />)
                        </>
                      )}
                    </td>
                    <td data-label="">
                      <LinkButton title="Edit" to={`/accounts/${accountId}/bots/edit/${bot.id}`}>
                        <i className="fa fa-pencil" /> Edit
                      </LinkButton>
                    </td>
                    <td data-label="">
                      <Button className="red" onClick={ev => this.handleDelete(ev, bot.id)}>
                        <i className="fa fa-trash" /> Delete
                      </Button>
                    </td>
                    <td data-label="">
                      <Link to={`/accounts/${accountId}/bots/?infoAbout=${bot.id}`}>
                        <i className="fa fa-info-circle" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Link className="button green" to={`/accounts/${accountId}/bots/new`}>
              <i className="fa fa-plus" /> Add bot
            </Link>
          </div>
        ) : (
          <HelpSnippet title="There are no bots (data collectors) yet" className="first-steps">
            <p>
              <b>Bots</b> are external scripts and applications that send values to Grafolean.
            </p>
            <Link className="button green" to={`/accounts/${accountId}/bots/new`}>
              <i className="fa fa-plus" /> Add bot
            </Link>
          </HelpSnippet>
        )}

        {/* {helpBot ? (
          <div id="help-snippet">
            {helpBot.protocol && helpBot.protocol.slug === 'ping' && this.renderPingBotHelp(helpBot)}
            {!helpBot.protocol && this.renderCustomBotHelp(helpBot)}
          </div>
        ) : ( */}
      </>
    );
  }
}
