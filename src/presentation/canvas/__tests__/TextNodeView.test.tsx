import { fireEvent, render, screen } from '@testing-library/react-native';

import type { PdfTextNode } from '@/domain/entities/PdfTextNode';
import { createPdfObjectId } from '@/domain/valueObjects/PdfObjectId';
import { rect } from '@/domain/valueObjects/Rect';
import { BLACK } from '@/domain/valueObjects/RgbColor';
import { TextNodeView } from '@/presentation/canvas/TextNodeView';

const node: PdfTextNode = {
  id: createPdfObjectId(0, 'text', 1),
  pageIndex: 0,
  type: 'text',
  bounds: rect(72, 700, 100, 12),
  content: 'Invoice',
  fontSize: 12,
  fontName: 'Helvetica',
  color: BLACK,
};

async function renderNode(selected: boolean) {
  const handlers = {
    onSelect: jest.fn(),
    onMove: jest.fn().mockResolvedValue(undefined),
    onCommitText: jest.fn(),
  };
  await render(
    <TextNodeView
      node={node}
      mediaBox={rect(0, 0, 612, 792)}
      scale={1}
      showContent={false}
      selected={selected}
      {...handlers}
    />,
  );
  return handlers;
}

describe('TextNodeView', () => {
  it('selects the node on the first press', async () => {
    const { onSelect } = await renderNode(false);

    await fireEvent.press(screen.getByText('Invoice'));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText('Edit text')).toBeNull();
  });

  it('opens an inline editor when a selected node is pressed again', async () => {
    await renderNode(true);

    await fireEvent.press(screen.getByText('Invoice'));

    expect(screen.getByLabelText('Edit text').props.value).toBe('Invoice');
  });

  it('commits the edited content when the editor loses focus', async () => {
    const { onCommitText } = await renderNode(true);
    await fireEvent.press(screen.getByText('Invoice'));
    const input = screen.getByLabelText('Edit text');

    await fireEvent.changeText(input, 'Receipt');
    await fireEvent(input, 'blur');

    expect(onCommitText).toHaveBeenCalledWith('Receipt');
    expect(screen.getByText('Invoice')).toBeTruthy();
  });

  it('discards an empty edit', async () => {
    const { onCommitText } = await renderNode(true);
    await fireEvent.press(screen.getByText('Invoice'));
    const input = screen.getByLabelText('Edit text');

    await fireEvent.changeText(input, '   ');
    await fireEvent(input, 'blur');

    expect(onCommitText).not.toHaveBeenCalled();
  });
});
