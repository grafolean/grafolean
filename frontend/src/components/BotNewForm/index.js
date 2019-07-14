import React from 'react';
import { Redirect } from 'react-router-dom';

import store from '../../store';
import { ROOT_URL, handleFetchErrors, onFailure } from '../../store/actions';

import { fetchAuth } from '../../utils/fetch';

import '../form.scss';
import Button from '../Button';

export default class BotNewForm extends React.Component {
  state = {
    name: '',
    newId: null,
    loading: false,
  };

  handleChange = event => {
    this.setState({ [event.target.name]: event.target.value });
  };

  handleSubmit = async event => {
    try {
      event.preventDefault();
      this.setState({ loading: true });
      const params = {
        name: this.state.name,
      };
      // create bot:
      const response = await fetchAuth(`${ROOT_URL}/accounts/${this.props.match.params.accountId}/bots/`, {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify(params),
      });
      await handleFetchErrors(response);
      const responseJson = await response.json();

      // assign permissions to bot:
      const responsePermissions = await fetchAuth(
        `${ROOT_URL}/accounts/${this.props.match.params.accountId}/bots/${responseJson.id}/permissions`,
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          method: 'POST',
          body: JSON.stringify({
            resource_prefix: `accounts/${this.props.match.params.accountId}/values`,
            methods: ['POST', 'PUT'],
          }),
        },
      );
      await handleFetchErrors(responsePermissions);

      this.setState({ newId: responseJson.id });
    } catch (e) {
      store.dispatch(onFailure(e.toString()));
    }
  };

  render() {
    const { newId, loading, name } = this.state;
    if (newId) {
      return <Redirect to={`/accounts/${this.props.match.params.accountId}/bots?infoAbout=${newId}`} />;
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
