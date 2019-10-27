import React from 'react';

import { PersistentFetcher } from '../../utils/fetch/PersistentFetcher';
import BreadcrumbItem from './BreadcrumbItem';

export default class FetchedLabelBreadcrumbItem extends React.Component {
  state = {
    label: null,
  };

  handleRecordUpdate = json => {
    this.setState({
      label: json.name,
    });
  };

  render() {
    const { resource, ...rest } = this.props;
    const { label } = this.state;
    return (
      <>
        <PersistentFetcher key={resource} resource={resource} onUpdate={this.handleRecordUpdate} />
        <BreadcrumbItem label={label || '...'} {...rest} />
      </>
    );
  }
}
