import React from 'react';
import { Redirect } from 'react-router-dom';
import xor from 'lodash/xor';

import { ROOT_URL } from '../../store/actions';

import { fetchAuth } from '../../utils/fetch';

import '../form.scss';
import Button from '../Button';
import Checkbox from '../Checkbox/Checkbox';

export default class UserPermissionsNewForm extends React.PureComponent {
  state = {
    formValues: {
      resource_prefix: '',
      methods: [],
    },
    submitted: false,
    errorMsg: null,
    posting: false,
  };

  ALL_METHODS = ['GET', 'POST', 'PUT', 'DELETE'];

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

  toggleMethod = (event, method) => {
    this.setState(prevState => ({
      formValues: {
        ...prevState.formValues,
        methods: xor(prevState.formValues.methods, [method]),
      },
    }));
  };

  handleSubmit = async event => {
    try {
      const { formValues } = this.state;
      const { userId } = this.props.match.params;

      event.preventDefault();
      this.setState({ posting: true });

      // assign permissions to person:
      const responsePermissions = await fetchAuth(`${ROOT_URL}/admin/permissions/`, {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify({
          user_id: Number(userId),
          resource_prefix: formValues.resource_prefix === '/' ? null : formValues.resource_prefix,
          methods: formValues.methods.length === this.ALL_METHODS.length ? null : formValues.methods,
        }),
      });
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
    const { resource_prefix, methods } = this.state.formValues;
    if (methods.length === 0 || resource_prefix.length === 0) {
      return false;
    }
    return true;
  }

  render() {
    const {
      submitted,
      posting,
      errorMsg,
      formValues: { resource_prefix, methods },
    } = this.state;
    if (submitted) {
      const { userId } = this.props.match.params;
      return <Redirect to={`/settings/users/${userId}/permissions`} />;
    }
    return (
      <div className="frame">
        <form>
          <div className="field">
            <label>Resource prefix:</label>
            <input type="text" value={resource_prefix} name="resource_prefix" onChange={this.handleChange} />
          </div>
          <div className="field">
            <label>Methods:</label>
            <div className="checkbox-parent">
              {this.ALL_METHODS.map(method => (
                <Checkbox
                  key={method}
                  color="#4cd074"
                  borderColor="#666"
                  checked={methods.includes(method)}
                  onClick={ev => this.toggleMethod(ev, method)}
                  label={method}
                />
              ))}
            </div>
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
