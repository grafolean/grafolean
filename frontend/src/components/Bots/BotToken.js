import React from 'react';

export default class BotToken extends React.PureComponent {
  state = {
    showToken: false,
  }

  toggleShowToken = () => {
    this.setState(oldState => ({
      showToken: !oldState.showToken,
    }))
  }

  render() {
    const { showToken } = this.state;
    const { token } = this.props;
    return(
      <div className="bot-token">
        <i className={`fa fa-eye${showToken ? '-slash' : ''}`} onClick={this.toggleShowToken} />
        {showToken ? token : '*'.repeat(12)}
      </div>
    )
  }
}