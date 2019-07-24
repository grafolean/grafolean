import React from 'react';
import { Redirect } from 'react-router-dom';

import { fetchAuth, PersistentFetcher } from '../utils/fetch';
import { ROOT_URL, handleFetchErrors } from '../store/actions';
import Loading from './Loading';
import Button from './Button';

const isForm = WrappedComponent => {
  const wrappedComponent = class Form extends React.Component {
    static defaultProps = {
      initialFormValues: {},
      resource: null, // if editing an existing resource, set this to address of the resource, otherwise to address owhere resources can be created
      editing: false,
    };
    state = {
      formValues: this.props.initialFormValues,
      loading: true,
      warnChangedOnServer: false,
      submitted: false,
      errorMsg: null,
    };

    handleValuesBackendChange = formValues => {
      if (!this.state.loading) {
        // oops - someone has changed the record while we are editing it! Let's warn user:
        this.setState({
          warnChangedOnServer: true,
        });
        return;
      }

      delete formValues['id']; // server might return an id too, which we don't need
      this.setState({
        formValues: formValues,
        loading: false,
      });
    };

    handleInputChangeEvent = ev => {
      const fieldName = ev.target.name;
      if (!fieldName) {
        console.error("Attribute 'name' not specified on input field!");
        return;
      }
      const value = ev.target.value;
      this.handleInputChange(fieldName, value);
    };

    handleInputChange = (fieldName, value) => {
      this.setState(prevState => ({
        formValues: {
          ...prevState.formValues,
          [fieldName]: value,
        },
      }));
    };

    handleSubmit = async event => {
      try {
        event.preventDefault();
        this.setState({ posting: true });
        // create new record:
        const responseCreate = await fetchAuth(`${ROOT_URL}/${this.props.resource}`, {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          method: this.props.editing ? 'PUT' : 'POST',
          body: JSON.stringify(this.state.formValues),
        });
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

    setFormValuesValidState = isValid => {
      this.setState({
        valid: isValid,
      });
    };

    render() {
      const { editing, resource, afterSubmitRedirectTo, ...passThroughProps } = this.props;
      const { formValues, loading, posting, valid, warnChangedOnServer, submitted } = this.state;

      if (submitted) {
        return <Redirect to={afterSubmitRedirectTo || '/'} />;
      }

      return (
        <>
          {editing && <PersistentFetcher resource={resource} onUpdate={this.handleValuesBackendChange} />}
          {editing && loading ? (
            <Loading />
          ) : (
            <form>
              <WrappedComponent
                {...passThroughProps}
                formValues={formValues}
                onInputChangeEvent={this.handleInputChangeEvent}
                onInputChange={this.handleInputChange}
                onValidChange={this.setFormValuesValidState}
              />
              {editing && warnChangedOnServer && (
                <p>
                  <i className="fa fa-exclamation-triangle" /> Warning: record has changed on server!
                </p>
              )}
              <Button isLoading={posting} onClick={this.handleSubmit} disabled={valid}>
                Submit
              </Button>
            </form>
          )}
        </>
      );
    }
  };
  return wrappedComponent;
};

export default isForm;
