import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Text style={styles.title}>PDF Editor</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0E1116',
  },
  title: {
    color: '#E8EDF2',
    fontSize: 20,
    fontWeight: '600',
  },
});
