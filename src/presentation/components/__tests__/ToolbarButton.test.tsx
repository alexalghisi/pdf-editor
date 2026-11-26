import { fireEvent, render, screen } from '@testing-library/react-native';

import { ToolbarButton } from '@/presentation/components/ToolbarButton';

describe('ToolbarButton', () => {
  it('shows its label and reports presses', async () => {
    const onPress = jest.fn();
    await render(<ToolbarButton label="Text" icon="type" onPress={onPress} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Text' }));

    expect(screen.getByText('Text')).toBeTruthy();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('keeps an accessible name when only the icon is shown', async () => {
    await render(
      <ToolbarButton
        label="Delete"
        icon="trash-2"
        iconOnly
        onPress={jest.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy();
    expect(screen.queryByText('Delete')).toBeNull();
  });

  it('ignores presses while disabled', async () => {
    const onPress = jest.fn();
    await render(<ToolbarButton label="Next" disabled onPress={onPress} />);

    const button = screen.getByRole('button', { name: 'Next' });
    await fireEvent.press(button);

    expect(onPress).not.toHaveBeenCalled();
    expect(button.props.accessibilityState).toEqual({ disabled: true });
  });

  it('is at least 44 points tall so it is easy to tap', async () => {
    await render(<ToolbarButton label="Text" onPress={jest.fn()} />);

    const style = [screen.getByRole('button', { name: 'Text' }).props.style]
      .flat(Infinity)
      .reduce((merged, entry) => ({ ...merged, ...entry }), {});

    expect(style.minHeight).toBeGreaterThanOrEqual(44);
    expect(style.minWidth).toBeGreaterThanOrEqual(44);
  });
});
