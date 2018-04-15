import React from 'react';

export default class TooltipPopup extends React.Component {
    /*
      Place this component inside a properly positioned div (meaning: left top corner of enveloping div
      is exactly where you want the arrow tip to be) and everything else will be taken care of.
    */
    static defaultProps = {
      backgroundColor: '#ffffff',
      borderColor: '#aaaaaa',
      borderWidth: 1,
      borderRadius: 7,
      arrowPercentFromLeft: 5,
      zIndex: 9999999,  // I guess every component thinks it should always be on top :-D
      arrowSpacingHorizontal: 3,
      arrowSpacingVertical: 5,
    }
    render() {
      const isArrowOnRight = this.props.arrowPercentFromLeft > 50;
      const arrowWidth = 10;
      return (
        <div
          style={{
            // "fixed" takes the tooltip out of flow; translate makes it positioned relative to parent container: (yeah, I know...)
            position: 'fixed',
            transform: `translate(-${this.props.arrowPercentFromLeft}%, -100%)`,
            zIndex: this.props.zIndex,
          }}
        >
          <div style={{
              backgroundColor: this.props.backgroundColor,
              borderRadius: this.props.borderRadius,
              padding: '10px 20px',
              border: `${this.props.borderWidth}px solid ${this.props.borderColor}`,
              fontSize: 12,
          }}>
            {this.props.children}
          </div>

          {/* Arrow is actually 2 triangles (borders), one for border and another one for bg color: */}
          <div style={{
            position: 'relative',
            marginLeft: `${this.props.arrowPercentFromLeft}%`,
            paddingBottom: this.props.arrowSpacingVertical,
            paddingLeft: this.props.arrowSpacingHorizontal,
          }}>
            <div
              style={{
                border: '0 solid transparent',
                borderWidth: isArrowOnRight ? `8px 0 0 ${arrowWidth}px` : `8px ${arrowWidth}px 0 0`,
                borderTopColor: this.props.borderColor,
                width: 0,
                marginLeft: isArrowOnRight ? (-arrowWidth - 2*this.props.arrowSpacingHorizontal) : (0),
                // we must not position this absolute, because we need the height of this element
              }}
            />
            <div
              style={{
                border: '0 solid transparent',
                borderWidth: isArrowOnRight ? '8px 0px 0 10px' : '8px 10px 0 0px',
                borderTopColor: this.props.backgroundColor,
                width: 0,
                marginLeft: isArrowOnRight ? (-this.props.borderWidth - arrowWidth) : (this.props.borderWidth),
                position: 'absolute',
                left: isArrowOnRight ? (-this.props.arrowSpacingHorizontal) : (this.props.arrowSpacingHorizontal),
                bottom: this.props.arrowSpacingVertical + 2 * this.props.borderWidth,
              }}
            />
          </div>
        </div>
      )
    }
  }
