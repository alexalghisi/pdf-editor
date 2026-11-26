import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { emptyMetadata } from '@/domain/entities/DocumentMetadata';
import type { PdfDocument } from '@/domain/entities/PdfDocument';
import { createPdfObjectId } from '@/domain/valueObjects/PdfObjectId';
import { rect } from '@/domain/valueObjects/Rect';
import { EditorScreen } from '@/presentation/screens/EditorScreen';
import { useEditorStore } from '@/presentation/store/editorStore';

const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack }),
}));

jest.mock('@/presentation/canvas/PdfCanvas', () => ({
  PdfCanvas: () => null,
}));

function documentWithPages(pageCount: number): PdfDocument {
  return {
    id: 'doc-1',
    pageCount,
    metadata: emptyMetadata(),
    pages: Array.from({ length: pageCount }, (_, index) => ({
      index,
      mediaBox: rect(0, 0, 612, 792),
      nodes: [],
    })),
  } as unknown as PdfDocument;
}

const initialState = useEditorStore.getState();

describe('EditorScreen', () => {
  const actions = {
    addText: jest.fn().mockResolvedValue(undefined),
    deleteSelected: jest.fn().mockResolvedValue(undefined),
    renderCurrentPage: jest.fn().mockResolvedValue(undefined),
    saveAs: jest.fn().mockResolvedValue(null),
  };

  const open = async (overrides: Partial<typeof initialState> = {}) => {
    useEditorStore.setState({
      ...initialState,
      ...actions,
      document: documentWithPages(3),
      fileName: 'Contract.pdf',
      ...overrides,
    });
    await render(<EditorScreen />);
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the file name and the page position', async () => {
    await open();

    expect(screen.getByText('Contract.pdf')).toBeTruthy();
    expect(screen.getByText('Page 1 of 3')).toBeTruthy();
    expect(screen.queryByText(/idle/)).toBeNull();
  });

  it('says when it is saving', async () => {
    await open({ status: 'saving' });

    expect(screen.getByText('Page 1 of 3 · Saving…')).toBeTruthy();
  });

  it('moves between pages and stops at both ends', async () => {
    await open();
    const previous = screen.getByRole('button', { name: 'Previous page' });
    const next = screen.getByRole('button', { name: 'Next page' });

    expect(previous.props.accessibilityState).toEqual({ disabled: true });
    await fireEvent.press(next);
    await fireEvent.press(next);

    expect(screen.getByText('Page 3 of 3')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Next page' }).props
        .accessibilityState,
    ).toEqual({ disabled: true });
  });

  it('hides page navigation for a single page document', async () => {
    await open({ document: documentWithPages(1) });

    expect(screen.queryByRole('button', { name: 'Next page' })).toBeNull();
  });

  it('zooms in steps, shows the percentage and resets', async () => {
    await open();

    await fireEvent.press(screen.getByRole('button', { name: 'Zoom in' }));
    expect(screen.getByText('120%')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Zoom out' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Zoom out' }));
    expect(screen.getByText('80%')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Reset zoom' }));
    expect(screen.getByText('100%')).toBeTruthy();
  });

  it('adds a text box', async () => {
    await open();

    await fireEvent.press(screen.getByRole('button', { name: 'Add text' }));

    expect(actions.addText).toHaveBeenCalledWith('New text');
  });

  it('enables delete only while something is selected', async () => {
    await open();
    expect(
      screen.getByRole('button', { name: 'Delete' }).props.accessibilityState,
    ).toEqual({ disabled: true });

    await act(async () => {
      useEditorStore.setState({
        selectedNodeId: createPdfObjectId(0, 'text', 1),
      });
    });
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Delete' }),
    );

    expect(actions.deleteSelected).toHaveBeenCalledTimes(1);
  });

  it('opens the save menu and exports the chosen format', async () => {
    await open();

    await fireEvent.press(screen.getByRole('button', { name: 'Save as…' }));
    await fireEvent.press(
      screen.getByRole('button', { name: 'Save as PDF document (.pdf)' }),
    );

    expect(actions.saveAs).toHaveBeenCalledWith('pdf');
  });

  it('announces errors', async () => {
    await open({ errorMessage: 'Could not save' });

    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('Could not save')).toBeTruthy();
  });

  it('goes back from the close button', async () => {
    await open();

    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));

    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('offers a way back when no document is loaded', async () => {
    await open({ document: null });

    expect(screen.getByText('No document is open')).toBeTruthy();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Back to start' }),
    );
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });
});
