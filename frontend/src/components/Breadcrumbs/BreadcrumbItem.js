import React from 'react';
import { Link } from 'react-router-dom';

export default class BreadcrumbItem extends React.Component {
  render() {
    const { label, separator = true, match } = this.props;
    const path = match.url;
    return (
      <span className="breadcrumb-item">
        {separator && <span className="separator">&gt;</span>}
        {match.isExact ? <b>{label}</b> : <Link to={path}>{label}</Link>}
      </span>
    );
  }
}
