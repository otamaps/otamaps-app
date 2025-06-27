import React from 'react';
import { StyleSheet, View } from 'react-native';

interface SpacerProps {
  width?: number;
  top?: number;
}

const Spacer: React.FC<SpacerProps> = ({ width = 95, top = 4 }) => {
  return (
    <View style={[styles.spacer, { width: `${width}%`, marginTop: top }]}/>
  );
};

const styles = StyleSheet.create({
  spacer: {
    height: 2,
    backgroundColor: '#e0e0e0',
    marginVertical: 4,
    alignSelf: 'center',
  },
});

export default Spacer;