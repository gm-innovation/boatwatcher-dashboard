import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ProjectInfo from '../../components/ProjectInfo';

// Mock the component's props
const mockProject = {
  id: '1',
  name: 'Test Project',
  description: 'This is a test project',
  status: 'active',
  createdAt: '2024-06-01T12:00:00Z'
};

describe('ProjectInfo Component', () => {
  it('renders project information correctly', () => {
    render(<ProjectInfo project={mockProject} />);
    
    // Test basic rendering of project information
    expect(screen.getByText(mockProject.name)).toBeInTheDocument();
    expect(screen.getByText(mockProject.description)).toBeInTheDocument();
    expect(screen.getByText(/active/i)).toBeInTheDocument();
  });

  it('displays formatted date correctly', () => {
    render(<ProjectInfo project={mockProject} />);
    
    // Test date formatting
    const dateElement = screen.getByText(/2024-06-01/i);
    expect(dateElement).toBeInTheDocument();
  });

  it('is responsive', () => {
    const { container } = render(<ProjectInfo project={mockProject} />);
    
    // Test responsive classes
    expect(container.firstChild).toHaveClass('w-full');
  });

  it('meets accessibility standards', () => {
    render(<ProjectInfo project={mockProject} />);
    
    // Test accessibility attributes
    const headingElement = screen.getByRole('heading', { name: mockProject.name });
    expect(headingElement).toBeInTheDocument();
  });
});