import React from 'react';
import { Link } from 'react-router-dom';

import { fetchAuth, PersistentFetcher } from '../../utils/fetch';
import { ROOT_URL } from '../../store/actions';

import LinkButton from '../LinkButton/LinkButton';
import Loading from '../Loading';
import Button from '../Button';

export default class Credentials extends React.Component {
  state = {
    credentials: null,
    fetchError: false,
  };

  onCredentialsUpdate = credentials => {
    this.setState({
      credentials: credentials.list,
      fetchError: false,
    });
  };

  onCredentialsUpdateError = errMsg => {
    this.setState({
      credentials: [],
      fetchError: true,
    });
  };

  performDelete = (ev, credId) => {
    ev.preventDefault();

    const cred = this.state.credentials.find(cred => cred.id === credId);
    if (
      !window.confirm(`Are you sure you want to delete credentials "${cred.name}" ? This can't be undone!`)
    ) {
      return;
    }

    fetchAuth(`${ROOT_URL}/accounts/${this.props.match.params.accountId}/credentials/${credId}`, {
      method: 'DELETE',
    });
  };

  render() {
    const { credentials, fetchError } = this.state;
    const accountId = this.props.match.params.accountId;

    return (
      <div className="credentials frame">
        <PersistentFetcher
          resource={`accounts/${accountId}/credentials`}
          onUpdate={this.onCredentialsUpdate}
          onError={this.onCredentialsUpdateError}
        />

        {credentials === null ? (
          <Loading />
        ) : fetchError ? (
          <>
            <i className="fa fa-exclamation-triangle" /> Error fetching credentials
          </>
        ) : (
          <>
            {credentials.length > 0 && (
              <table className="list">
                <tbody>
                  <tr>
                    <th>Type</th>
                    <th>Name</th>
                    <th>Details</th>
                    <th />
                    <th />
                  </tr>
                  {credentials.map(cred => (
                    <tr key={cred.id}>
                      <td>{cred.credentials_type}</td>
                      <td>{cred.name}</td>
                      <td>/</td>
                      <td>
                        <LinkButton title="Edit" to={`/accounts/${accountId}/credentials/edit/${cred.id}`}>
                          <i className="fa fa-pencil" /> Edit
                        </LinkButton>
                      </td>
                      <td>
                        <Button className="red" onClick={ev => this.performDelete(ev, cred.id)}>
                          <i className="fa fa-trash" /> Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <Link className="button green" to={`/accounts/${accountId}/credentials/new`}>
              <i className="fa fa-plus" /> Add credentials
            </Link>
          </>
        )}
      </div>
    );
  }
}
