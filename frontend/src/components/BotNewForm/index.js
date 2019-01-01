import React from 'react';
import { Redirect } from 'react-router-dom';

import store from '../../store';
import { ROOT_URL, handleFetchErrors, onFailure } from '../../store/actions';

import { fetchAuth } from '../../utils/fetch';

import '../form.scss';
import Button from '../Button';

export default class BotNewForm extends React.PureComponent {
  state = {
    name: '',
    submitted: false,
    loading: false,
  };

  handleChange = event => {
    this.setState({ [event.target.name]: event.target.value });
  };

  handleSubmit = event => {
    event.preventDefault();
    this.setState({ loading: true });
    const params = {
      name: this.state.name,
    };
    fetchAuth(`${ROOT_URL}/admin/bots/`, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      method: 'POST',
      body: JSON.stringify(params),
    })
      .then(handleFetchErrors)
      .then(() => this.setState({ submitted: true }))
      .catch(errorMsg => store.dispatch(onFailure(errorMsg.toString())));
  };

  render() {
    const { submitted, loading, name } = this.state;
    if (submitted) {
      return <Redirect to={`/settings/bots`} />;
    }
    return (
      <div className="frame">
        <form>
          <div className="field">
            <label>Name:</label>
            <input type="text" name="name" value={name} onChange={this.handleChange} />
          </div>

          <Button isLoading={loading} onClick={this.handleSubmit} disabled={name.length === 0}>
            Submit
          </Button>
        </form>
      </div>
    );
  }
}
