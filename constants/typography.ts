import { StyleSheet } from 'react-native';

export const typography = StyleSheet.create({
  // Font Families
  fontFamilyRegular: 'Figtree-Regular',
  fontFamilyMedium: 'Figtree-Medium',
  fontFamilySemiBold: 'Figtree-SemiBold',
  fontFamilyBold: 'Figtree-Bold',

  // Text Styles
  heading1: {
    fontFamily: 'Figtree-Bold',
    fontSize: 32,
    lineHeight: 40,
  },
  heading2: {
    fontFamily: 'Figtree-Bold',
    fontSize: 28,
    lineHeight: 36,
  },
  heading3: {
    fontFamily: 'Figtree-SemiBold',
    fontSize: 24,
    lineHeight: 32,
  },
  bodyLarge: {
    fontFamily: 'Figtree-Regular',
    fontSize: 18,
    lineHeight: 28,
  },
  body: {
    fontFamily: 'Figtree-Regular',
    fontSize: 16,
    lineHeight: 24,
  },
  bodySmall: {
    fontFamily: 'Figtree-Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  caption: {
    fontFamily: 'Figtree-Regular',
    fontSize: 12,
    lineHeight: 16,
  },
  button: {
    fontFamily: 'Figtree-SemiBold',
    fontSize: 16,
    lineHeight: 24,
  },
  input: {
    fontFamily: 'Figtree-Regular',
    fontSize: 16,
    lineHeight: 24,
  },
});

// Export font family constants for direct usage
export const FONT_FAMILY = {
  regular: 'Figtree-Regular',
  medium: 'Figtree-Medium',
  semiBold: 'Figtree-SemiBold',
  bold: 'Figtree-Bold',
} as const;
