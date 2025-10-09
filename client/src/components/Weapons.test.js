import React from 'react';
import { render, screen } from '@testing-library/react';
import Weapons from './Weapons';

test('renders Vandal weapon', () => {
  render(<Weapons />);
  const linkElement = screen.getByText(/Vandal/i);
  expect(linkElement).toBeInTheDocument();
});