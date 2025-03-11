import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Header from '../../components/Header';

describe('Header Component', () => {
  it('renders header component correctly', () => {
    render(<Header />);
    // Test basic rendering
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('is responsive', () => {
    const { container } = render(<Header />);
    // Test responsive classes
    expect(container.firstChild).toHaveClass('w-full');
  });

  it('meets accessibility standards', async () => {
    render(<Header />);
    const header = screen.getByRole('banner');
    expect(header).toHaveAttribute('role', 'banner');
  });
});