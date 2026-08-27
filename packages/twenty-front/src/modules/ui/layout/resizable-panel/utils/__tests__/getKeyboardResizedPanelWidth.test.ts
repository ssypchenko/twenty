import { getKeyboardResizedPanelWidth } from '@/ui/layout/resizable-panel/utils/getKeyboardResizedPanelWidth';

const constraints = {
  min: 640,
  max: 1280,
  default: 1000,
};

describe('getKeyboardResizedPanelWidth', () => {
  it('increases a left-side panel with ArrowLeft', () => {
    expect(
      getKeyboardResizedPanelWidth({
        currentWidth: 1000,
        constraints,
        key: 'ArrowLeft',
        shiftKey: false,
        side: 'left',
      }),
    ).toBe(1016);
  });

  it('decreases a left-side panel with ArrowRight', () => {
    expect(
      getKeyboardResizedPanelWidth({
        currentWidth: 1000,
        constraints,
        key: 'ArrowRight',
        shiftKey: false,
        side: 'left',
      }),
    ).toBe(984);
  });

  it('uses the large step while Shift is pressed', () => {
    expect(
      getKeyboardResizedPanelWidth({
        currentWidth: 1000,
        constraints,
        key: 'ArrowLeft',
        shiftKey: true,
        side: 'left',
      }),
    ).toBe(1048);
  });

  it('supports minimum and maximum shortcuts', () => {
    expect(
      getKeyboardResizedPanelWidth({
        currentWidth: 1000,
        constraints,
        key: 'Home',
        shiftKey: false,
        side: 'left',
      }),
    ).toBe(640);
    expect(
      getKeyboardResizedPanelWidth({
        currentWidth: 1000,
        constraints,
        key: 'End',
        shiftKey: false,
        side: 'left',
      }),
    ).toBe(1280);
  });

  it('ignores unrelated keys', () => {
    expect(
      getKeyboardResizedPanelWidth({
        currentWidth: 1000,
        constraints,
        key: 'Enter',
        shiftKey: false,
        side: 'left',
      }),
    ).toBeNull();
  });
});
