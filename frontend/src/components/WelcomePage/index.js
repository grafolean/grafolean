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
        {/* <WebSocketsTest address="wss://echo.websocket.org" /> */}
        <WebSocketsTest address="ws://localhost:9883" />
      </div>
    );
  }
}

class WebSocketsTest extends React.PureComponent {
  ws = undefined;

  componentDidMount() {
    this.ws = new WebSocket(this.props.address);
    this.ws.onopen = this.onSocketOpen;
    this.ws.onmessage = this.onSocketMessage;
    this.ws.onclose = this.onSocketClose;
  }

  componentWillUnmount() {
    if (this.ws) {
      this.ws.close();
    }
  }

  onSocketOpen = () => {
    console.log('Socket opened');
    this.ws.send('test123');
    console.log('Message is sent...');
  };

  onSocketMessage = evt => {
    var received_msg = evt.data;
    console.log('Message received:', received_msg);
  };

  onSocketClose = () => {
    console.log('Connection is closed...');
  };

  render() {
    return <div>See console for messages.</div>;
  }
}
