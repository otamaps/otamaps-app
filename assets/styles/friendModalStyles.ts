import { StyleSheet } from "react-native";

export const fmstyles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'column',
  },
  name: {
    fontSize: 26,
    fontWeight: 'bold',
  },
  status: {
    fontSize: 16,
    color: '#A3A3A3',
  },
  navigateButton: {
    backgroundColor: '#4A89EE',
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  navigateButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '500',
    paddingEnd: 8,
  }, 
  button: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '500',
    paddingStart: 8,
  },
  redButton: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  redButtonText: {
    fontSize: 18,
    fontWeight: '500',
    paddingStart: 8,
    color: '#FF3B30',
  },
});
