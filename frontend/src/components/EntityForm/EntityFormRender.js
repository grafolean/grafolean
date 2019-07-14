import React from 'react';
import { Redirect } from 'react-router-dom';

import { ROOT_URL, handleFetchErrors } from '../../store/actions';
import { fetchAuth } from '../../utils/fetch';

import '../form.scss';
import Button from '../Button';
import EntityDetailsForm from './EntityDetailsForm';

export default class EntityFormRender extends React.PureComponent {
  state = {
    formValues: this.props.initialFormValues,
    submitted: false,
    errorMsg: null,
    posting: false,
  };

  handleChangeEventOnInput = event => {
    const fieldName = event.target.name;
    const value = event.target.value;
    this.handleChange(fieldName, value);
  };

  handleChange = (fieldName, value) => {
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
      const params = formValues;
      // create entity:
      const responseCreate = await fetchAuth(
        `${ROOT_URL}/accounts/${this.props.match.params.accountId}/entities/${
          this.props.recordId ? this.props.recordId : ''
        }`,
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          method: this.props.recordId ? 'PUT' : 'POST',
          body: JSON.stringify(params),
        },
      );
      if (!responseCreate.ok) {
        throw await responseCreate.text();
      }
      await handleFetchErrors(responseCreate);
      this.setState({ submitted: true });
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
    const { name, entity_type } = this.state.formValues;
    if (name.length === 0 || entity_type.length === 0) {
      return false;
    }
    return true;
  }

  render() {
    const {
      submitted,
      posting,
      formValues: { name, entity_type, details },
    } = this.state;
    const { warnChangedOnServer } = this.props;

    if (submitted) {
      return <Redirect to={`/accounts/${this.props.match.params.accountId}/entities`} />;
    }

    return (
      <div className="frame">
        <form>
          <div className="field">
            <label>Name:</label>
            <input type="text" value={name} name="name" onChange={this.handleChangeEventOnInput} />
          </div>
          <div className="field">
            <label>Monitored entity type:</label>
            <select value={entity_type} name="entity_type" onChange={this.handleChangeEventOnInput}>
              <option value="">-- please select entity type --</option>
              <option value="device">Device</option>
            </select>
          </div>
          {entity_type && (
            <EntityDetailsForm
              entityType={entity_type}
              value={details}
              onChange={details => this.handleChange('details', details)}
            />
          )}

          {warnChangedOnServer && (
            <div className="warn-changed-on-server">
              <i className="fa fa-exclamation-triangle" /> WARNING: careful, this record might have been
              changed on server!
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
