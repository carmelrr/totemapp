import * as React from 'react';
import Svg, { Path } from 'react-native-svg';

export default function WallMapSVG(props) {
  return (
    <Svg
      viewBox="0 0 2560 1600"
      width={props.width}
      height={props.height}
      {...props}
    >
      {/* ...Paste the <Path ... /> elements from your SVG here... */}
      {/* Example: */}
      {/* <Path fill="#01467D" d="M1698.000000,1601.000000 ..."/> */}
      {/* ...other paths... */}
    </Svg>
  );
}
