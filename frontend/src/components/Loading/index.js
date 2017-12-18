import React, { Component } from 'react';
import styled from 'styled-components';


const LoadingPlaceholder = styled.div`
  padding: 40px 40px;
`

class Loading extends Component {
  render() {
    return (
      <LoadingPlaceholder>
        <img src="/static/loading.gif" alt="Please wait, loading..." />
      </LoadingPlaceholder>
    );
  }
}

export default Loading;
