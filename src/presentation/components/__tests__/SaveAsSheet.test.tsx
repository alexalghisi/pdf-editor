import { fireEvent, render, screen } from '@testing-library/react-native';

import { EXPORT_FORMATS } from '@/application/export/exporters';
import { SaveAsSheet } from '@/presentation/components/SaveAsSheet';

describe('SaveAsSheet', () => {
  it('lists every export format', async () => {
    await render(
      <SaveAsSheet visible onPick={jest.fn()} onClose={jest.fn()} />,
    );

    for (const entry of EXPORT_FORMATS) {
      expect(screen.getByText(entry.label)).toBeTruthy();
    }
  });

  it('reports the chosen format', async () => {
    const onPick = jest.fn();
    await render(<SaveAsSheet visible onPick={onPick} onClose={jest.fn()} />);

    await fireEvent.press(
      screen.getByRole('button', { name: 'Save as Word document (.docx)' }),
    );

    expect(onPick).toHaveBeenCalledWith('docx');
  });

  it('closes from the cancel button', async () => {
    const onClose = jest.fn();
    await render(<SaveAsSheet visible onPick={jest.fn()} onClose={onClose} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders nothing while hidden', async () => {
    await render(
      <SaveAsSheet visible={false} onPick={jest.fn()} onClose={jest.fn()} />,
    );

    expect(screen.queryByText('Save as')).toBeNull();
  });
});
