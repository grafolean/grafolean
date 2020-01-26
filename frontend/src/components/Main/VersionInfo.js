import React from 'react';
import { VERSION_INFO } from '../../VERSION';

export default class VersionInfo extends React.PureComponent {
  render() {
    return <div className="version-info">{VERSION_INFO.ciCommitTag || 'unknown'}</div>;
  }
}
