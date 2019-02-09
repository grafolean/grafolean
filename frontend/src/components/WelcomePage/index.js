import React from 'react';

export default class WelcomePage extends React.PureComponent {
  render() {
    return (
      <div>
        <h3>Welcome!</h3>
        <p>
          This page displays information about the latest values received and provides guidance on how to post
          these values.
        </p>
      </div>
    );
  }
}
