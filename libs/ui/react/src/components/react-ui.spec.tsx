import { render } from '@testing-library/react';

import AcmeReactUi from './react-ui';

describe('AcmeReactUi', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<AcmeReactUi />);
    expect(baseElement).toBeTruthy();
  });
});
