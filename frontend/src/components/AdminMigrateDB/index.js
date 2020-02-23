import React from 'react';
import { connect } from 'react-redux';

import Button from '../Button';
import { handleFetchErrors, ROOT_URL, onFailure, doRequestBackendStatus } from '../../store/actions';
import store from '../../store';

class AdminMigrateDB extends React.Component {
  state = {
    submitted: false,
  };

  handleSubmit = ev => {
    ev.preventDefault();
    fetch(`${ROOT_URL}/admin/migratedb`, {
      method: 'POST',
    })
      .then(handleFetchErrors)
      // login temporarily, but forget jwt token: (user must login explicitly)
      .then(() => {
        this.setState({
          submitted: true,
        });
        // we are done here, trigger fetching of backend status so that Main component learns about our work:
        store.dispatch(doRequestBackendStatus());
      })
      .catch(errorMsg => store.dispatch(onFailure(errorMsg.toString())));
  };

  render() {
    const { submitted } = this.state;
    const { backendStatus } = this.props;
    if (submitted) {
      return null;
    }
    return (
      <div className="admin_first">
        <form>
          <div>
            <i className="fa fa-exclamation-triangle" /> The database{' '}
            {backendStatus.db_version === 0 ? 'is empty and must be initialized' : 'must be upgraded'} before
            we can proceed.
          </div>
          <Button onClick={this.handleSubmit}>
            {backendStatus.db_version === 0 ? 'Create DB' : 'Upgrade DB'}
          </Button>
        </form>
      </div>
    );
  }
}

const mapBackendStatusToProps = store => ({
  backendStatus: store.backendStatus.status,
});
export default connect(mapBackendStatusToProps)(AdminMigrateDB);
