import React from 'react';
import { isDarkMode } from '../utils/darkmode';

export default class TooltipPopup extends React.Component {
  /*
      Place this component inside a properly positioned div (meaning: left top corner of enveloping div
      is exactly where you want the arrow tip to be) and everything else will be taken care of.
    */
  static defaultProps = {
    isArrowOnTop: false,
    borderWidth: 1,
    borderRadius: 7,
    arrowPercentFromLeft: 5,
    zIndex: 1, // tooltip might be on top if it was displayed with a click, or be below event-sensitive area if it was just a result of mousemove
    arrowSpacingHorizontal: 3,
    arrowSpacingVertical: 5,
    onMouseEnter: () => {},
    onMouseLeave: () => {},
  };

  render() {
    const {
      arrowPercentFromLeft,
      isArrowOnTop,
      onMouseEnter,
      onMouseLeave,
      zIndex,
      arrowSpacingVertical,
      arrowSpacingHorizontal,
      children,
      borderWidth,
    } = this.props;
    const isArrowOnRight = arrowPercentFromLeft > 50;
    const arrowWidth = 10;
    const arrowHeight = 8; // arrow height without its "border" (which is not made by using CSS border)
    const arrowBorderWidth = isArrowOnTop
      ? isArrowOnRight
        ? `0 0 ${arrowHeight}px ${arrowWidth}px`
        : `0 ${arrowWidth}px ${arrowHeight}px 0`
      : isArrowOnRight
      ? `${arrowHeight}px 0 0 ${arrowWidth}px`
      : `${arrowHeight}px ${arrowWidth}px 0 0`;
    const darkMode = isDarkMode();
    const backgroundColor = darkMode ? '#161616' : '#ffffff';
    const borderColor = darkMode ? '#555' : '#aaaaaa';

    return (
      <div
        className="tooltip-popup"
        style={{
          // we can't use "fixed" to take the tooltip out of flow, because then we would have to update its coordinates.
          // translate makes it positioned relative to parent container:
          position: 'relative',
          transform: `translate(-${arrowPercentFromLeft}%, ${isArrowOnTop ? 0 : -100}%)`,
          zIndex: zIndex,
        }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {/* Container which holds the content, but has enough padding on all sides for the arrow: */}
        <div
          style={{
            position: 'relative',
            padding: `${arrowHeight}px 0`,
            margin: isArrowOnTop ? `${arrowSpacingVertical} 0 0 0` : `0 0 ${arrowSpacingVertical} 0`,
          }}
        >
          {/* Content: */}
          <div
            className="tooltip-popup-content"
            style={{
              backgroundColor: backgroundColor,
              border: `1px solid ${borderColor}`,
            }}
          >
            {children}
          </div>

          {/* Arrow is actually 2 triangles (borders), one for "border" and another one for bg color - both inside a common div: */}
          <div
            style={{
              position: 'absolute',
              marginLeft: `${arrowPercentFromLeft}%`,
              [isArrowOnTop ? 'top' : 'bottom']: borderWidth,
              left: isArrowOnRight ? -arrowSpacingHorizontal : arrowSpacingHorizontal,
            }}
          >
            <div
              style={{
                border: '0 solid transparent',
                borderWidth: arrowBorderWidth,
                [isArrowOnTop ? 'borderBottomColor' : 'borderTopColor']: borderColor,
                width: 0,
                marginLeft: isArrowOnRight ? -arrowWidth : 0,
                // we must not position this absolute, because we need the height of this element
              }}
            />
            <div
              className="tooltip-popup-arrow"
              style={{
                border: '0 solid transparent',
                borderWidth: arrowBorderWidth,
                [isArrowOnTop ? 'borderBottomColor' : 'borderTopColor']: backgroundColor,
                position: 'absolute',
                width: 0,
                marginLeft: isArrowOnRight ? -borderWidth - arrowWidth - borderWidth : 0,
                left: isArrowOnRight ? borderWidth : borderWidth,
                [isArrowOnTop ? 'top' : 'bottom']: 2 * borderWidth,
              }}
            />
          </div>
        </div>
      </div>
    );
  }
}
