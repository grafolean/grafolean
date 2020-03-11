import React from 'react';
import { withRouter } from 'react-router-dom';
import { PersistentFetcher } from '../../utils/fetch/PersistentFetcher';
import { setAccountEntities } from '../../store/actions';
import store from '../../store';

class AccountEntitiesUpdater extends React.Component {
  onEntitiesUpdate = json => {
    store.dispatch(setAccountEntities(json.list));
  };

  componentDidUpdate(prevProps) {
    // reset when account is no longer selected:
    const prevAccountId = prevProps.match.params.accountId;
    const accountId = this.props.match.params.accountId;
    if (prevAccountId && !accountId) {
      store.dispatch(setAccountEntities([]));
    }
  }

  render() {
    const accountId = this.props.match.params.accountId;
    if (!accountId) {
      return null;
    }
    return (
      <>
        <PersistentFetcher
          key={accountId}
          resource={`accounts/${accountId}/entities`}
          onUpdate={this.onEntitiesUpdate}
        />
      </>
    );
  }
}

export default withRouter(AccountEntitiesUpdater);
