import React from 'react';
import { connect } from 'react-redux';
import { Redirect } from 'react-router-dom';

import store from '../../store';
import { ROOT_URL, handleFetchErrors, onFailure } from '../../store/actions';

import { fetchAuth } from '../../utils/fetch';

import '../form.scss';
import Button from '../Button';

class BotNewForm extends React.PureComponent {
  state = {
    name: '',
    submitted: false,
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
      const response = await fetchAuth(`${ROOT_URL}/admin/bots/`, {
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
      const responsePermissions = await fetchAuth(`${ROOT_URL}/admin/bots/${responseJson.id}/permissions`, {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify({
          resource_prefix: `accounts/${this.props.accounts.selected.id}/values`,
          methods: ['POST', 'PUT'],
        }),
      });
      await handleFetchErrors(responsePermissions);

      await this.setState({ submitted: true });
    } catch (e) {
      store.dispatch(onFailure(e.toString()));
    }
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

const mapStoreToProps = store => ({
  accounts: store.accounts,
});
export default connect(mapStoreToProps)(BotNewForm);
