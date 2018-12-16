import React from 'react';
import { Redirect } from 'react-router-dom';

import store from '../../store';
import { ROOT_URL, handleFetchErrors, onFailure, fetchDashboardsList } from '../../store/actions';

import Loading from '../Loading';
import { fetchAuth } from '../../utils/fetch';

class DashboardNewForm extends React.Component {
  state = {
    name: '',
    submitted: false,
    loading: false,
    newSlug: null,
  }

  handleChange = event => {
    this.setState({ [event.target.name]: event.target.value });
  };

  handleSubmit = event => {
    event.preventDefault();
    const params = {
      name: this.state.name,
    };
    fetchAuth(
      `${ROOT_URL}/accounts/1/dashboards/`,
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify(params),
      },
    )
      .then(handleFetchErrors)
      .then(response => {
        response.json().then(json => this.setState({
          submitted: true,
          newSlug: json.slug,
        }));
        store.dispatch(fetchDashboardsList());
      })
      .catch(errorMsg => store.dispatch(onFailure(errorMsg.toString())));
  };

  render() {
    const { submitted, loading, name, newSlug } = this.state;
    return submitted ? (
      <Redirect to={`/dashboards/view/${newSlug}`} />
    ) : (
      <form>
        <label>
          Name:
          <input type="text" name="name" value={name} onChange={this.handleChange} />
        </label>
        {loading ? <Loading /> : <button onClick={this.handleSubmit}>Submit</button>}
      </form>
    );
  }
}

export default DashboardNewForm;
