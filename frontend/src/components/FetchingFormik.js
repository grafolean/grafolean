import { Formik } from 'formik';
import React from 'react';
import { Redirect } from 'react-router-dom';
import { handleFetchErrors, ROOT_URL } from '../store/actions';
import { fetchAuth } from '../utils/fetch';
import { PersistentFetcher } from '../utils/fetch/PersistentFetcher';
import Button from './Button';
import { FormError } from './isFormikForm';
import Loading from './Loading';

export default class FetchingFormik extends React.Component {
  static defaultProps = {
    initialFormValues: {},
    resource: null, // if editing an existing resource, set this to address of the resource, otherwise to address where resources can be created
    editing: false,
    afterSubmitRedirectTo: '',
    convertFetchedFormValues: null,
    fixValuesBeforeSubmit: null,
    validate: null,
  };
  state = {
    fetchedFormValues: null,
    loading: this.props.editing ? true : false,
    submitted: false,
    warnChangedOnServer: false,
    errorMsg: null,
    afterSubmitUrl: null,
  };

  handleValuesBackendChange = fetchedFormValues => {
    if (!this.state.loading) {
      // oops - someone has changed the record while we are editing it! Let's warn user:
      this.setState({
        warnChangedOnServer: true,
      });
      return;
    }

    let convertedFetchedFormValues;
    if (this.props.convertFetchedFormValues) {
      convertedFetchedFormValues = this.props.convertFetchedFormValues(fetchedFormValues);
    } else {
      convertedFetchedFormValues = fetchedFormValues;
      delete convertedFetchedFormValues['id']; // server might return an id too, which we don't need
      delete convertedFetchedFormValues['insert_time'];
      delete convertedFetchedFormValues['token'];
    }
    this.setState({
      fetchedFormValues: convertedFetchedFormValues,
      loading: false,
    });
  };

  handleSubmit = async (formValues, { setSubmitting }) => {
    try {
      this.setState({
        errorMsg: null,
      });
      if (this.props.fixValuesBeforeSubmit) {
        formValues = this.props.fixValuesBeforeSubmit(formValues);
      }
      // create new record:
      const responseCreate = await fetchAuth(`${ROOT_URL}/${this.props.resource}`, {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        method: this.props.editing ? 'PUT' : 'POST',
        body: JSON.stringify(formValues),
      });
      if (!responseCreate.ok) {
        throw await responseCreate.text();
      }
      handleFetchErrors(responseCreate);
      if (this.props.afterSubmit) {
        const afterSubmitUrl = await this.props.afterSubmit(responseCreate);
        this.setState({ afterSubmitUrl: afterSubmitUrl });
      }
      this.setState({ submitted: true });
    } catch (errorMsg) {
      console.error(errorMsg);
      this.setState({
        errorMsg: errorMsg.toString(),
      });
    } finally {
      setSubmitting(false);
    }
  };

  render() {
    const { editing, resource, afterSubmitRedirectTo } = this.props;
    const { fetchedFormValues, loading, warnChangedOnServer, afterSubmitUrl, submitted, errorMsg } =
      this.state;

    return (
      <>
        {editing && <PersistentFetcher resource={resource} onUpdate={this.handleValuesBackendChange} />}
        {editing && loading ? (
          <Loading />
        ) : (
          <Formik
            initialValues={editing ? fetchedFormValues : this.props.initialFormValues}
            validate={this.props.validate}
            onSubmit={this.handleSubmit}
            isInitialValid={editing ? true : false} // we assume that default values are not enough to make form values valid
          >
            {({
              values,
              errors,
              handleChange,
              setFieldValue,
              handleBlur,
              handleSubmit,
              isSubmitting,
              isValid,
            }) =>
              submitted ? (
                <Redirect to={afterSubmitUrl || afterSubmitRedirectTo || '/'} />
              ) : (
                <form onSubmit={handleSubmit}>
                  {this.props.children({
                    values,
                    errors,
                    handleChange,
                    handleBlur,
                    setFieldValue,
                    // deprecated; left here from isFormikForm:
                    onChange: handleChange,
                    onBlur: handleBlur,
                  })}
                  {editing && warnChangedOnServer && (
                    <FormError msg="Warning: record has changed on server!" />
                  )}
                  {errorMsg && <FormError msg={errorMsg} />}
                  {!isValid && <FormError msg={errors} />}
                  <Button
                    className={isValid ? 'green' : 'red'}
                    type="submit"
                    isLoading={isSubmitting}
                    disabled={!isValid}
                  >
                    Submit
                  </Button>
                </form>
              )
            }
          </Formik>
        )}
      </>
    );
  }
}
