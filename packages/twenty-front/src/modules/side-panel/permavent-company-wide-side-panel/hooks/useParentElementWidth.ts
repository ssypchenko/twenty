import { useLayoutEffect, useState } from 'react';

export const useParentElementWidth = (element: HTMLElement | null) => {
  const [parentElementWidth, setParentElementWidth] = useState(0);

  useLayoutEffect(() => {
    const parentElement = element?.parentElement;

    if (!parentElement) {
      setParentElementWidth(0);
      return;
    }

    const updateParentElementWidth = () => {
      setParentElementWidth(parentElement.getBoundingClientRect().width);
    };

    updateParentElementWidth();

    const resizeObserver = new ResizeObserver(updateParentElementWidth);

    resizeObserver.observe(parentElement);

    return () => {
      resizeObserver.disconnect();
    };
  }, [element]);

  return parentElementWidth;
};
