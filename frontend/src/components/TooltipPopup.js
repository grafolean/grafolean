import React from 'react';

export default class TooltipPopup extends React.Component {
    /*
      Place this component inside a properly positioned div (meaning: left top corner of enveloping div
      is exactly where you want the arrow tip to be) and everything else will be taken care of.
    */
    static defaultProps = {
      isArrowOnTop: false,
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
      const arrowHeight = 8; // arrow height without its "border" (which is not made by using CSS border)
      const arrowBorderWidth = this.props.isArrowOnTop ? (
          isArrowOnRight ? `0 0 ${arrowHeight}px ${arrowWidth}px` : `0 ${arrowWidth}px ${arrowHeight}px 0`
        ) : (
          isArrowOnRight ? `${arrowHeight}px 0 0 ${arrowWidth}px` : `${arrowHeight}px ${arrowWidth}px 0 0`
        );
      return (
        <div
          style={{
            // "fixed" takes the tooltip out of flow; translate makes it positioned relative to parent container: (yeah, I know...)
            position: 'fixed',
            transform: `translate(-${this.props.arrowPercentFromLeft}%, ${this.props.isArrowOnTop ? 0 : -100}%)`,
            zIndex: this.props.zIndex,
          }}
          onMouseEnter={this.props.onMouseEnter}
          onMouseLeave={this.props.onMouseLeave}
        >
          {/* Container which holds the content, but has enough padding on all sides for the arrow: */}
          <div
            style={{
              position: 'relative',
              padding: `${arrowHeight}px 0`,
              margin: this.props.isArrowOnTop ? `${this.props.arrowSpacingVertical} 0 0 0` : `0 0 ${this.props.arrowSpacingVertical} 0`,
            }}>

            {/* Content: */}
            <div style={{
              backgroundColor: this.props.backgroundColor,
              borderRadius: this.props.borderRadius,
              padding: '10px 20px',
              border: `${this.props.borderWidth}px solid ${this.props.borderColor}`,
              fontSize: 12,
            }}>
              {this.props.children}
            </div>

            {/* Arrow is actually 2 triangles (borders), one for "border" and another one for bg color - both inside a common div: */}
            <div style={{
              position: 'absolute',
              marginLeft: `${this.props.arrowPercentFromLeft}%`,
              [this.props.isArrowOnTop ? 'top' : 'bottom']: this.props.borderWidth,
              left: isArrowOnRight ? -this.props.arrowSpacingHorizontal : this.props.arrowSpacingHorizontal,
            }}>
              <div
                style={{
                  border: '0 solid transparent',
                  borderWidth: arrowBorderWidth,
                  [this.props.isArrowOnTop ? 'borderBottomColor' : 'borderTopColor']: this.props.borderColor,
                  width: 0,
                  marginLeft: isArrowOnRight ? (-arrowWidth) : (0),
                  // we must not position this absolute, because we need the height of this element
                }}
              />
              <div
                style={{
                  border: '0 solid transparent',
                  borderWidth: arrowBorderWidth,
                  [this.props.isArrowOnTop ? 'borderBottomColor' : 'borderTopColor']: this.props.backgroundColor,
                  position: 'absolute',
                  width: 0,
                  marginLeft: isArrowOnRight ? (-this.props.borderWidth - arrowWidth - this.props.borderWidth) : (0),
                  left: isArrowOnRight ? (this.props.borderWidth) : (this.props.borderWidth),
                  [this.props.isArrowOnTop ? 'top' : 'bottom']: 2 * this.props.borderWidth,
                }}
              />
            </div>
          </div>
        </div>
      )
    }
  }
