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

export default class Bots extends React.PureComponent {
  state = {
    bots: null,
  };

  componentDidMount() {
    this.fetchBots();
  }

  fetchBots = () => {
    fetchAuth(`${ROOT_URL}/admin/bots/`)
      .then(handleFetchErrors)
      .then(response => response.json())
      .then(json =>
        this.setState({
          bots: json.list,
        }),
      )
      .catch(errorMsg => store.dispatch(onFailure(errorMsg.toString())));
  };

  handleDelete = (ev, bot_id) => {
    ev.preventDefault();
    const bot = this.state.bots.find(bot => bot.id === bot_id);
    if (!window.confirm(`Are you sure you want to delete bot "${bot.name}" ? This can't be undone!`)) {
      return;
    }

    fetchAuth(`${ROOT_URL}/admin/bots/${bot_id}`, { method: 'DELETE' })
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

  render() {
    const { bots } = this.state;
    return (
      <div className="bots frame">
        {bots ? (
          <table className="list">
            <tbody>
              <tr>
                <th>Name</th>
                <th>Token</th>
                <th>Insert time</th>
                <th />
              </tr>
              {bots.map(bot => (
                <tr>
                  <td>{bot.name}</td>
                  <td>{bot.token}</td>
                  {/* <td>{bot.insert_time}</td> */}
                  <td>{moment(bot.insert_time * 1000).format('YYYY-MM-DD HH:mm:ss')}</td>
                  <td>
                    <Button className="red" onClick={ev => this.handleDelete(ev, bot.id)}>
                      <i className="fa fa-trash" /> Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Loading />
        )}
        <Link className="button green" to="/settings/bots/new">
          <i className="fa fa-plus" /> Add bot
        </Link>
      </div>
    );
  }
}
