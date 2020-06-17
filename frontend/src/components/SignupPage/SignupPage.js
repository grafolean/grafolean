import React from 'react';
import { Link } from 'react-router-dom';

import Button from '../Button';
import { VERSION_INFO } from '../../VERSION';

import '../auth-form-page.scss';
import './SignupPage.scss';

class SignupPage extends React.Component {
  state = {
    formValues: {
      email: '',
    },
  };

  changeFormValue = ev => {
    const fieldName = ev.target.name;
    const value = ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value;
    this.setState(prevState => ({
      formValues: {
        ...prevState.formValues,
        [fieldName]: value,
      },
    }));
  };

  handleSubmit = async ev => {
    ev.preventDefault();
    this.setState({
      processing: true,
      errorMsg: undefined,
    });

    await new Promise((resolve, reject) => {
      setTimeout(() => {
        this.setState({
          errorMsg: '',
          processing: false,
        });
        resolve();
      }, 2000);
    });
  };

  render() {
    const {
      formValues: { email, agree },
      processing,
      errorMsg,
    } = this.state;
    return (
      <div className="signup-page auth-form-page">
        <form className="box" onSubmit={this.handleSubmit}>
          <div className="grafolean">
            <img className="grafolean-logo" src="/grafolean.svg" alt="Grafolean" />
          </div>

          <div className="form">
            <h3>Create your account</h3>

            <div className="field">
              <label>E-mail:</label>
              <input type="text" name="email" value={email} onChange={this.changeFormValue} autoFocus />
            </div>

            <div className="field agree">
              <input type="checkbox" name="agree" value={agree} onChange={this.changeFormValue} />
              <label htmlFor="agree">
                I agree to the{' '}
                <a href="https://grafolean.com/terms" target="_blank" rel="noopener noreferrer">
                  Terms of Use
                </a>
              </label>
            </div>

            <Button type="submit" isLoading={processing} disabled={email.length === 0 || !agree}>
              Create account
            </Button>

            {errorMsg && (
              <div className="error-msg">
                <i className="fa fa-exclamation-triangle" />
                &nbsp;
                {errorMsg}
              </div>
            )}

            <div className="signup-text">
              Already have an account? <Link to="/">Login.</Link>
            </div>
          </div>
        </form>

        <div className="version">Grafolean version: {VERSION_INFO.ciCommitTag || 'unknown'}</div>
      </div>
    );
  }
}
export default SignupPage;
