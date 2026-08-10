import {
  SymbolView,
  type AndroidSymbol,
  type SFSymbol,
  type SymbolViewProps,
} from "expo-symbols";
import React from "react";

type PlatformSymbolProps = Omit<SymbolViewProps, "name"> & {
  ios: SFSymbol;
  android: AndroidSymbol;
  web?: AndroidSymbol;
};

/**
 * A native icon that uses SF Symbols on Apple platforms and Material Symbols
 * on Android and web. Keep the platform names together at the call site so
 * each icon can follow the conventions of the OS that renders it.
 */
export function PlatformSymbol({
  ios,
  android,
  web = android,
  size = 24,
  style,
  ...props
}: PlatformSymbolProps) {
  return (
    <SymbolView
      {...props}
      name={{ ios, android, web }}
      size={size}
      style={[{ width: size, height: size }, style]}
    />
  );
}
