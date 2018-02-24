import React from 'react';
import styled from 'styled-components';

const StyledButton = styled.button`
    background: #335533;
    border: none;
    cursor: pointer;
    color: #fff;
    margin: 20px;
`
StyledButton.displayName = "StyledButton"

export default class Button extends React.Component {
  render() {
    return (
      <StyledButton {...this.props}>
        {this.props.children}
      </StyledButton>
    )
  }
}
