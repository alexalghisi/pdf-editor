import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import * as DocumentPicker from 'expo-document-picker';

import { HomeScreen } from '@/presentation/screens/HomeScreen';
import { useEditorStore } from '@/presentation/store/editorStore';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

const getDocumentAsync = DocumentPicker.getDocumentAsync as jest.Mock;
const initialState = useEditorStore.getState();

describe('HomeScreen', () => {
  const openFromUri = jest.fn().mockResolvedValue(undefined);
  const createBlank = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
    useEditorStore.setState({
      ...initialState,
      openFromUri,
      createBlank,
      status: 'idle',
      errorMessage: null,
    });
  });

  it('opens the picked PDF and moves to the editor', async () => {
    getDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'blob:invoice', name: 'Invoice.pdf' }],
    });
    await render(<HomeScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Open PDF' }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('Editor'));
    expect(openFromUri).toHaveBeenCalledWith('blob:invoice', 'Invoice.pdf');
  });

  it('stays on the home screen when the picker is cancelled', async () => {
    getDocumentAsync.mockResolvedValue({ canceled: true, assets: null });
    await render(<HomeScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Open PDF' }));

    await waitFor(() => expect(getDocumentAsync).toHaveBeenCalled());
    expect(openFromUri).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does not enter the editor when the file fails to load', async () => {
    getDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'blob:broken', name: 'Broken.pdf' }],
    });
    openFromUri.mockImplementationOnce(async () => {
      useEditorStore.setState({ status: 'error', errorMessage: 'Not a PDF' });
    });
    await render(<HomeScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Open PDF' }));

    expect(await screen.findByText('Not a PDF')).toBeTruthy();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('starts a blank document', async () => {
    await render(<HomeScreen />);

    await fireEvent.press(
      screen.getByRole('button', { name: 'Start with a blank page' }),
    );

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('Editor'));
    expect(createBlank).toHaveBeenCalledTimes(1);
  });

  it('shows progress while a document is loading', async () => {
    useEditorStore.setState({ status: 'loading' });
    await render(<HomeScreen />);

    expect(screen.getByText('Opening…')).toBeTruthy();
  });
});
