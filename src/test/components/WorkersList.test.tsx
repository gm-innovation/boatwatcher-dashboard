import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import WorkersList from '../../components/WorkersList';
import userEvent from '@testing-library/user-event';

// Mock the component's props
const mockWorkers = [
  { id: '1', name: 'Worker 1', status: 'active', lastActive: '2024-06-01T10:00:00Z' },
  { id: '2', name: 'Worker 2', status: 'inactive', lastActive: '2024-05-30T15:30:00Z' },
];

const mockOnViewDetails = vi.fn();

describe('WorkersList Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders workers list component correctly', () => {
    render(<WorkersList workers={mockWorkers} onViewDetails={mockOnViewDetails} />);
    
    // Test basic rendering
    expect(screen.getByText(/Workers List/i)).toBeInTheDocument();
  });

  it('displays all workers in the list', () => {
    render(<WorkersList workers={mockWorkers} onViewDetails={mockOnViewDetails} />);
    
    // Check if all workers are displayed
    mockWorkers.forEach(worker => {
      expect(screen.getByText(worker.name)).toBeInTheDocument();
      expect(screen.getByText(worker.status)).toBeInTheDocument();
    });
  });

  it('formats dates correctly', () => {
    render(<WorkersList workers={mockWorkers} onViewDetails={mockOnViewDetails} />);
    
    // Check if dates are formatted correctly
    expect(screen.getByText(/2024-06-01/)).toBeInTheDocument();
    expect(screen.getByText(/2024-05-30/)).toBeInTheDocument();
  });

  it('calls onViewDetails when view details button is clicked', async () => {
    render(<WorkersList workers={mockWorkers} onViewDetails={mockOnViewDetails} />);
    
    // Find and click the view details button for the first worker
    const viewDetailsButtons = screen.getAllByRole('button', { name: /view details/i });
    await userEvent.click(viewDetailsButtons[0]);
    
    // Check if onViewDetails was called with the correct worker id
    expect(mockOnViewDetails).toHaveBeenCalledWith('1');
  });

  it('is responsive', () => {
    const { container } = render(<WorkersList workers={mockWorkers} onViewDetails={mockOnViewDetails} />);
    
    // Test responsive classes
    expect(container.firstChild).toHaveClass('w-full');
  });

  it('meets accessibility standards', () => {
    render(<WorkersList workers={mockWorkers} onViewDetails={mockOnViewDetails} />);
    
    // Test accessibility attributes
    const headingElement = screen.getByRole('heading', { name: /Workers List/i });
    expect(headingElement).toBeInTheDocument();
    
    // Test table accessibility
    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();
  });
});