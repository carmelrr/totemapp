declare module "*.png";
declare module "*.jpg";
declare module "*.jpeg";
declare module "*.gif";
declare module "*.webp";
declare module "*.json";

declare module "*.svg" {
  import * as React from "react";
  import { SvgProps } from "react-native-svg";
  const content: React.FC<SvgProps>;
  export default content;
}

// Optional: env module (if you import from @env)
declare module "@env" {
  export const EXPO_PUBLIC_API_BASE: string;
  // add more as needed
}

declare global {
  var _WORKLET: boolean | undefined;
  var _reduceMotion: boolean | undefined;
  var __isAdmin: boolean | undefined;
}
