import React from 'react';
import { Link } from 'react-router-dom';
import moment from 'moment';

import store from '../../store';
import { ROOT_URL, handleFetchErrors, onFailure } from '../../store/actions';
import { fetchAuth } from '../../utils/fetch';
import { SUPPORTED_PROTOCOLS } from '../../utils/protocols';

import Loading from '../Loading';
import Button from '../Button';
import BotToken from './BotToken';
import LinkButton from '../LinkButton/LinkButton';
import HelpSnippet from '../HelpSnippet';
import When from '../When';

import '../form.scss';
import './bots.scss';

export default class Bots extends React.PureComponent {
  state = {
    bots: null,
  };

  componentDidMount() {
    this.fetchBots();
  }

  fetchBots = () => {
    fetchAuth(`${ROOT_URL}/accounts/${this.props.match.params.accountId}/bots/`)
      .then(handleFetchErrors)
      .then(response => response.json())
      .then(json => {
        // instead of just protocol slug, include all information from SUPPORTED_PROTOCOLS: (like label)
        const bots = json.list.map(bot => ({
          ...bot,
          protocol: SUPPORTED_PROTOCOLS.find(p => p.slug === bot.protocol),
        }));
        this.setState({
          bots: bots,
        });
      })
      .catch(errorMsg => store.dispatch(onFailure(errorMsg.toString())));
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

  renderSnmpBotHelp(bot) {
    const backendUrlHostname = new URL(process.env.REACT_APP_BACKEND_ROOT_URL).hostname;
    const backendUrlIsLocalhost =
      backendUrlHostname === 'localhost' || backendUrlHostname.match(/^127[.]0[.]0[.][0-9]{1,3}$/);
    const backendUrlHostnameInPre = <span className="pre">{backendUrlHostname}</span>;
    return (
      <HelpSnippet
        title={
          <>
            How to send values using <b>"{bot.name}"</b> SNMP bot
          </>
        }
      >
        {backendUrlIsLocalhost && (
          <div className="p warning">
            <i className="fa fa-exclamation-triangle" />
            <b>IMPORTANT:</b> the example URLs below are incorrect. Since browser is accessing backend via
            {backendUrlHostnameInPre}, we can't know how SNMP Collector will be able to access it. However it
            will <i>not</i> be able use the address {backendUrlHostnameInPre}, even if started on the same
            machine (because SNMP Collector runs inside the container). In other words, please change the URLs
            appropriately (replace {backendUrlHostnameInPre} with appropriate domain or IP address), otherwise
            the bot will <b>not be able to connect</b>.
          </div>
        )}

        <div className="p">
          Bot <i>"{bot.name}"</i> is a SNMP bot / collector. It needs to be installed on a server which will
          have access to all the devices it needs to monitor, and it needs to be able to connect to Grafolean
          via HTTP(S) port.
        </div>
        <div className="p">
          The installation instructions are available on{' '}
          <a href="https://gitlab.com/grafolean/grafolean-collector-snmp">Grafolean SNMP collector</a> Git
          repository, but in short:
          <ol>
            <li>
              check that backend is reachable:
              <pre>
                {String.raw`$ curl ${process.env.REACT_APP_BACKEND_ROOT_URL}/status/info
{"alive": true, ...`}
              </pre>
            </li>

            <li>
              install SNMP collector:
              <pre>
                {String.raw`$ mkdir ~/snmpcollector
$ cd ~/snmpcollector
$ curl https://gitlab.com/grafolean/grafolean-collector-snmp/raw/master/docker-compose.yml -o docker-compose.yml
$ echo "BACKEND_URL=${process.env.REACT_APP_BACKEND_ROOT_URL} > .env
$ echo "BOT_TOKEN=${bot.token} >> .env
$ docker-compose up -d
`}
              </pre>
            </li>
          </ol>
        </div>
        <div className="p">
          If installation was successful, you should see the updated "Last successful login" time for this bot
          in a few minutes. Congratulations, now you can configure Entities (since this is SNMP: devices),
          their Credentials and Sensors.
        </div>
        <div className="p">
          If not, the best place to start is the logs:{' '}
          <span className="pre">docker logs -f grafolean-collector-snmp</span>.
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

  renderAboutBots() {
    return (
      <HelpSnippet icon="info-circle" title="About bots">
        <div className="p">
          <b>Bots</b> are external scripts and applications that send values to Grafolean.
        </div>
      </HelpSnippet>
    );
  }

  render() {
    const { bots } = this.state;
    const accountId = this.props.match.params.accountId;
    const helpBotIdParam = new URLSearchParams(this.props.location.search).get('infoAbout');
    const helpBot = bots === null ? null : bots.find(b => b.id === Number(helpBotIdParam));
    return (
      <>
        <div className="bots frame">
          {bots === null ? (
            <Loading />
          ) : (
            bots.length > 0 && (
              <table className="list">
                <tbody>
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
                  {bots.map(bot => (
                    <tr key={bot.id}>
                      <td>{bot.name}</td>
                      <td>{bot.protocol ? bot.protocol.label : 'custom'}</td>
                      <td>
                        <BotToken token={bot.token} />
                      </td>
                      <td>{moment.utc(bot.insert_time * 1000).format('YYYY-MM-DD HH:mm:ss')}</td>
                      <td>
                        {bot.last_login === null ? (
                          'Never'
                        ) : (
                          <>
                            {moment.utc(bot.last_login * 1000).format('YYYY-MM-DD HH:mm:ss')} (
                            <When t={bot.last_login} />)
                          </>
                        )}
                      </td>
                      <td>
                        <LinkButton title="Edit" to={`/accounts/${accountId}/bots/edit/${bot.id}`}>
                          <i className="fa fa-pencil" /> Edit
                        </LinkButton>
                      </td>
                      <td>
                        <Button className="red" onClick={ev => this.handleDelete(ev, bot.id)}>
                          <i className="fa fa-trash" /> Delete
                        </Button>
                      </td>
                      <td>
                        <Link to={`/accounts/${accountId}/bots/?infoAbout=${bot.id}`}>
                          <i className="fa fa-info-circle" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
          <Link className="button green" to={`/accounts/${accountId}/bots/new`}>
            <i className="fa fa-plus" /> Add bot
          </Link>
        </div>

        {helpBot ? (
          <>
            {helpBot.protocol === 'snmp' && this.renderSnmpBotHelp(helpBot)}
            {!helpBot.protocol && this.renderCustomBotHelp(helpBot)}
          </>
        ) : (
          this.renderAboutBots()
        )}
      </>
    );
  }
}
