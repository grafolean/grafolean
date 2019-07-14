import React from 'react';

export default class EntityDetails extends React.Component {
  render() {
    const { details } = this.props;
    return (
      <>
        {Object.keys(details).map(k => (
          <p key={k}>
            {k}: {details[k].toString()}
          </p>
        ))}
      </>
    );
  }
}
