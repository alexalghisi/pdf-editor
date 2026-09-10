/**
 * Jest environment for domain and infrastructure tests.
 * Native I/O, pickers, and the JSI PDF rasterizer are stubbed so the
 * PDF AST engine can be exercised on Node without a device.
 */
import { installBuffer } from '@/shared/installBuffer';

installBuffer();

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));

const mockFileSystem = {
  EncodingType: { Base64: 'base64', UTF8: 'utf8' },
  cacheDirectory: 'file:///tmp/pdf-editor/',
  documentDirectory: 'file:///tmp/pdf-editor/docs/',
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
  deleteAsync: jest.fn(),
};

jest.mock('expo-file-system', () => mockFileSystem);
jest.mock('expo-file-system/legacy', () => mockFileSystem);

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest
    .fn()
    .mockResolvedValue({ status: 'granted' }),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(false),
  shareAsync: jest.fn(),
}));

jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    GestureHandlerRootView: ({
      children,
    }: {
      children: React.ReactNode;
    }) => React.createElement(View, null, children),
    Gesture: {
      Pan: () => ({ onUpdate: () => ({}), onEnd: () => ({}) }),
      Pinch: () => ({ onUpdate: () => ({}), onEnd: () => ({}) }),
      Simultaneous: () => ({}),
    },
    GestureDetector: ({ children }: { children: React.ReactNode }) =>
      children,
    PinchGestureHandler: ({
      children,
    }: {
      children: React.ReactNode;
    }) => children,
    PanGestureHandler: ({ children }: { children: React.ReactNode }) =>
      children,
  };
});

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) =>
      children,
    SafeAreaView: ({
      children,
      style,
    }: {
      children: React.ReactNode;
      style?: unknown;
    }) => React.createElement(View, { style }, children),
    useSafeAreaInsets: () => inset,
    initialWindowMetrics: {
      insets: inset,
      frame: { x: 0, y: 0, width: 0, height: 0 },
    },
  };
});
