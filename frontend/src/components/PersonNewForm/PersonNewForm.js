import React from 'react';
import { connect } from 'react-redux';
import { Redirect } from 'react-router-dom';

import { ROOT_URL } from '../../store/actions';

import { fetchAuth } from '../../utils/fetch';

import '../form.scss';
import Button from '../Button';

class PersonNewForm extends React.PureComponent {
  state = {
    formValues: {
      username: '',
      password: '',
      name: '',
      email: '',
    },
    submitted: false,
    errorMsg: null,
    posting: false,
  };

  handleChange = event => {
    const fieldName = event.target.name;
    const value = event.target.value;
    this.setState(prevState => ({
      formValues: {
        ...prevState.formValues,
        [fieldName]: value,
      },
    }));
  };

  handleSubmit = async event => {
    try {
      const { formValues } = this.state;
      event.preventDefault();
      this.setState({ posting: true });
      const params = {
        username: formValues.username,
        password: formValues.password,
        email: formValues.email,
        name: formValues.name,
      };
      // create person:
      const responseCreate = await fetchAuth(`${ROOT_URL}/admin/persons/`, {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify(params),
      });
      if (!responseCreate.ok) {
        throw await responseCreate.text();
      }
      const responseJson = await responseCreate.json();

      // assign permissions to person:
      const responsePermissions = await fetchAuth(
        `${ROOT_URL}/admin/persons/${responseJson.id}/permissions/`,
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          method: 'POST',
          body: JSON.stringify({
            resource_prefix: `accounts/${this.props.accounts.selected.id}`,
            methods: null,
          }),
        },
      );
      if (!responsePermissions.ok) {
        throw await responsePermissions.text();
      }

      await this.setState({ submitted: true });
    } catch (errorMsg) {
      this.setState({
        errorMsg: errorMsg.toString(),
      });
    } finally {
      this.setState({
        posting: false,
      });
    }
  };

  areFormValuesValid() {
    const { username, password, email, name } = this.state.formValues;
    if (username.length === 0 || password.length === 0 || email.length === 0 || name.length === 0) {
      return false;
    }
    return true;
  }

  render() {
    const {
      submitted,
      posting,
      errorMsg,
      formValues: { username, password, email, name },
    } = this.state;
    if (submitted) {
      return <Redirect to={`/users`} />;
    }
    return (
      <div className="frame">
        <form>
          <div className="field">
            <label>Username:</label>
            <input type="text" value={username} name="username" onChange={this.handleChange} />
          </div>
          <div className="field">
            <label>Password:</label>
            <input type="text" value={password} name="password" onChange={this.handleChange} />
          </div>
          <div className="field">
            <label>E-mail:</label>
            <input type="text" value={email} name="email" onChange={this.handleChange} />
          </div>
          <div className="field">
            <label>First and last name:</label>
            <input type="text" value={name} name="name" onChange={this.handleChange} />
          </div>
          {errorMsg && (
            <div className="error info">
              <i className="fa fa-exclamation-triangle" /> {errorMsg}
            </div>
          )}
          <Button isLoading={posting} onClick={this.handleSubmit} disabled={!this.areFormValuesValid()}>
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
export default connect(mapStoreToProps)(PersonNewForm);
