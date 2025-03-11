import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SummaryCards from '../../components/SummaryCards';

// Mock the component's props
const mockSummaryData = {
  totalProjects: 10,
  activeProjects: 8,
  totalEvents: 250,
  recentEvents: 25
};

describe('SummaryCards Component', () => {
  it('renders summary cards correctly', () => {
    render(<SummaryCards data={mockSummaryData} />);
    
    // Test basic rendering of summary information
    expect(screen.getByText(/10/)).toBeInTheDocument(); // Total Projects
    expect(screen.getByText(/8/)).toBeInTheDocument(); // Active Projects
    expect(screen.getByText(/250/)).toBeInTheDocument(); // Total Events
    expect(screen.getByText(/25/)).toBeInTheDocument(); // Recent Events
  });

  it('displays correct labels for each card', () => {
    render(<SummaryCards data={mockSummaryData} />);
    
    // Test card labels
    expect(screen.getByText(/Total Projects/i)).toBeInTheDocument();
    expect(screen.getByText(/Active Projects/i)).toBeInTheDocument();
    expect(screen.getByText(/Total Events/i)).toBeInTheDocument();
    expect(screen.getByText(/Recent Events/i)).toBeInTheDocument();
  });

  it('is responsive', () => {
    const { container } = render(<SummaryCards data={mockSummaryData} />);
    
    // Test responsive classes
    expect(container.firstChild).toHaveClass('grid');
  });

  it('meets accessibility standards', () => {
    render(<SummaryCards data={mockSummaryData} />);
    
    // Test accessibility attributes
    const headingElements = screen.getAllByRole('heading');
    expect(headingElements.length).toBeGreaterThan(0);
  });
});