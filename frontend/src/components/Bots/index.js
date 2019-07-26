import React from 'react';
import { Link } from 'react-router-dom';
import moment from 'moment';

import store from '../../store';
import { ROOT_URL, handleFetchErrors, onFailure } from '../../store/actions';

import { fetchAuth } from '../../utils/fetch';

import '../form.scss';
import './bots.scss';
import Loading from '../Loading';
import Button from '../Button';
import BotToken from './BotToken';
import LinkButton from '../LinkButton/LinkButton';

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
      .then(json =>
        this.setState({
          bots: json.list,
        }),
      )
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

  renderHelp() {
    const { bots } = this.state;
    const accountId = this.props.match.params.accountId;
    const helpBotIdParam = new URLSearchParams(this.props.location.search).get('infoAbout');
    if (!helpBotIdParam || !bots) {
      return null;
    }
    const bot = bots.find(b => b.id === Number(helpBotIdParam));
    if (!bot) {
      return null;
    }
    return (
      <div className="bot-help frame">
        <h1>
          <i className="fa fa-question-circle" /> How to send values using <b>"{bot.name}"</b> bot
        </h1>
        <p>
          To send values to Grafolean, you need to use a bot. Below instructions assume you will be using{' '}
          <i>"{bot.name}"</i> bot.
        </p>
        <p>
          Sending values using current time uses <i>POST</i> method:
          <pre>
            {String.raw`$ curl \
  -X POST \
  '${ROOT_URL}/accounts/${accountId}/values/?p=myhouse.livingroom.humidity&v=57.3&b=${bot.token}'`}
          </pre>
        </p>
        <p>
          Sending more values at once is also possible:
          <pre>
            {String.raw`$ curl \
  -X POST \
  -H 'Content-Type: application/json' \
  -d '[ { "p": "myhouse.livingroom.humidity", "v": 57.3 }, { "p": "myhouse.livingroom.temperature.kelvin", "v": 293.2 } ]' \
  '${ROOT_URL}/accounts/${accountId}/values/?b=${bot.token}'`}
          </pre>
        </p>
        <p>
          For sending historical data you must use <i>PUT</i> method and specify the time explicitly:
          <pre>
            {String.raw`$ curl \
  -X POST \
  -H 'Content-Type: application/json' \
  -d '[ { "p": "myhouse.livingroom.humidity", "v": 57.3, "t": 1234567890.012345 }, { "p": "myhouse.livingroom.humidity", "v": 57.2, "t": 1234567899 } ]' \
  '${ROOT_URL}/accounts/${accountId}/values/?b=${bot.token}'`}
          </pre>
        </p>
      </div>
    );
  }

  render() {
    const { bots } = this.state;
    const accountId = this.props.match.params.accountId;
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
                    <th />
                    <th />
                    <th />
                  </tr>
                  {bots.map(bot => (
                    <tr key={bot.id}>
                      <td>{bot.name}</td>
                      <td>{bot.bot_type || 'custom'}</td>
                      <td>
                        <BotToken token={bot.token} />
                      </td>
                      <td>{moment.utc(bot.insert_time * 1000).format('YYYY-MM-DD HH:mm:ss')}</td>
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
                          <i className="fa fa-question-circle" />
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

        {this.renderHelp()}
      </>
    );
  }
}
