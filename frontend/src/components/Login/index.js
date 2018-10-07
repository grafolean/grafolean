import React from 'react';
import { connect } from 'react-redux';

import { onLoginSuccess, ROOT_URL, handleFetchErrors, onFailure } from '../../store/actions';
import store from '../../store';
import Button from '../Button';
import Loading from '../Loading';
import Redirect from 'react-router-dom/Redirect';

class Login extends React.Component {
  formValues = {};

  constructor(props) {
    super(props);
    this.state = {
      formValues: {
        username: '',
        password: '',
      },
      processingLogin: false,
      redirectToReferrer: this.props.loggedIn ? true : false,
    };
  }

  changeFormValue(fieldName, value) {
    this.setState(oldState => ({
      formValues: {
        ...oldState.formValues,
        [fieldName]: value,
      }
    }));
    this.formValues[fieldName] = value;
  }

  changeUsername = e => {
    this.changeFormValue('username', e.target.value);
  }
  changePassword = e => {
    this.changeFormValue('password', e.target.value);
  }

  onLoginClick = () => {
    const params = {
      username: this.formValues.username,
      password: this.formValues.password,
    }
    this.setState({
      processingLogin: true,
    });
    fetch(`${ROOT_URL}/auth/login`, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      method: 'POST',
      body: JSON.stringify(params),
    })
      .then(handleFetchErrors)
      .then(response => {
        response.json().then(json => {
          const jwtToken = response.headers.get('X-JWT-Token')
          window.sessionStorage.setItem('moonthor_jwt_token', jwtToken);
          store.dispatch(onLoginSuccess(json, jwtToken));
          this.setState({
            processingLogin: false,
            redirectToReferrer: true,
          })
        })
      })
      .catch(errorMsg => store.dispatch(onFailure(errorMsg.toString())))

  }

  render() {
    const { formValues: { username, password }, processingLogin, redirectToReferrer } = this.state;
    if (redirectToReferrer === true) {
      const { fromLocation } = this.props.location.state || { fromLocation: "/" };
      return <Redirect to={fromLocation} />
    }
    if (processingLogin) {
      return <Loading />;
    }
    return (
      <div>
        <div className="login_form">
          <label>Username:</label>
          <input type="text" value={username} onChange={this.changeUsername} />
          <label>Password:</label>
          <input type="text" value={password} onChange={this.changePassword} />
        </div>
        <Button onClick={this.onLoginClick}>Login</Button>
      </div>
    );
  }
}

const mapLoggedInStateToProps = store => ({
  loggedIn: !!store.user,
});
export default connect(mapLoggedInStateToProps)(Login);
