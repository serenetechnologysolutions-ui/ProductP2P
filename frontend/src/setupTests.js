import '@testing-library/jest-dom';

// jsdom doesn't implement matchMedia; AntD's responsive Grid/breakpoint hooks
// call it on every render, so without this every AntD-based component test
// fails before it even gets to assertions.
window.matchMedia = window.matchMedia || function () {
  return {
    matches: false,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  };
};
