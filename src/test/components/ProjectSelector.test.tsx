import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ProjectSelector from '../../components/ProjectSelector';
import userEvent from '@testing-library/user-event';

// Mock the component's props
const mockProjects = [
  { id: '1', name: 'Project 1' },
  { id: '2', name: 'Project 2' },
];

const mockOnSelect = vi.fn();

describe('ProjectSelector Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders project selector correctly', () => {
    render(<ProjectSelector projects={mockProjects} onSelect={mockOnSelect} />);
    // Test basic rendering
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('displays all projects in the dropdown', () => {
    render(<ProjectSelector projects={mockProjects} onSelect={mockOnSelect} />);
    // Open dropdown
    const dropdown = screen.getByRole('combobox');
    userEvent.click(dropdown);
    
    // Check if all projects are displayed
    mockProjects.forEach(project => {
      expect(screen.getByText(project.name)).toBeInTheDocument();
    });
  });

  it('calls onSelect when a project is selected', async () => {
    render(<ProjectSelector projects={mockProjects} onSelect={mockOnSelect} />);
    // Open dropdown
    const dropdown = screen.getByRole('combobox');
    userEvent.click(dropdown);
    
    // Select a project
    const projectOption = screen.getByText('Project 1');
    await userEvent.click(projectOption);
    
    // Check if onSelect was called with the correct project
    expect(mockOnSelect).toHaveBeenCalledWith('1');
  });

  it('is responsive', () => {
    const { container } = render(<ProjectSelector projects={mockProjects} onSelect={mockOnSelect} />);
    // Test responsive classes
    expect(container.firstChild).toHaveClass('w-full');
  });
});