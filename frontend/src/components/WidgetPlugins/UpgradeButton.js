import React from 'react';

import store from '../../store';
import { fetchAuth } from '../../utils/fetch';
import { handleFetchErrors, onFailure, ROOT_URL } from '../../store/actions';
import Button from '../Button';

export default class UpgradeButton extends React.Component {
  state = {
    upgrading: false,
  };

  handleUpgrade = async ev => {
    ev.preventDefault();
    const { widgetPluginId } = this.props;
    this.setState({ upgrading: true });
    try {
      const response = await fetchAuth(`${ROOT_URL}/plugins/widgets/${widgetPluginId}`, { method: 'POST' });
      handleFetchErrors(response);
    } catch (errorMsg) {
      store.dispatch(onFailure(errorMsg.toString()));
    }
    this.setState({ upgrading: false });
  };

  render() {
    const { upgrading } = this.state;
    return (
      <Button isLoading={upgrading} className="green" onClick={this.handleUpgrade}>
        <i className="fa fa-fw fa-level-up" /> Upgrade
      </Button>
    );
  }
}
