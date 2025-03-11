import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import UserManagement from '../../components/UserManagement';
import userEvent from '@testing-library/user-event';

// Mock the component's props
const mockUsers = [
  { id: '1', name: 'John Doe', email: 'john@example.com', role: 'admin' },
  { id: '2', name: 'Jane Smith', email: 'jane@example.com', role: 'user' },
];

const mockOnAddUser = vi.fn();
const mockOnRemoveUser = vi.fn();
const mockOnUpdateRole = vi.fn();

describe('UserManagement Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders user management component correctly', () => {
    render(
      <UserManagement 
        users={mockUsers} 
        onAddUser={mockOnAddUser} 
        onRemoveUser={mockOnRemoveUser} 
        onUpdateRole={mockOnUpdateRole} 
      />
    );
    
    // Test basic rendering
    expect(screen.getByText(/User Management/i)).toBeInTheDocument();
  });

  it('displays all users in the list', () => {
    render(
      <UserManagement 
        users={mockUsers} 
        onAddUser={mockOnAddUser} 
        onRemoveUser={mockOnRemoveUser} 
        onUpdateRole={mockOnUpdateRole} 
      />
    );
    
    // Check if all users are displayed
    mockUsers.forEach(user => {
      expect(screen.getByText(user.name)).toBeInTheDocument();
      expect(screen.getByText(user.email)).toBeInTheDocument();
      expect(screen.getByText(user.role)).toBeInTheDocument();
    });
  });

  it('calls onAddUser when add user button is clicked', async () => {
    render(
      <UserManagement 
        users={mockUsers} 
        onAddUser={mockOnAddUser} 
        onRemoveUser={mockOnRemoveUser} 
        onUpdateRole={mockOnUpdateRole} 
      />
    );
    
    // Find and click the add user button
    const addButton = screen.getByRole('button', { name: /add user/i });
    await userEvent.click(addButton);
    
    // Check if onAddUser was called
    expect(mockOnAddUser).toHaveBeenCalled();
  });

  it('calls onRemoveUser when remove user button is clicked', async () => {
    render(
      <UserManagement 
        users={mockUsers} 
        onAddUser={mockOnAddUser} 
        onRemoveUser={mockOnRemoveUser} 
        onUpdateRole={mockOnUpdateRole} 
      />
    );
    
    // Find and click the remove user button for the first user
    const removeButtons = screen.getAllByRole('button', { name: /remove/i });
    await userEvent.click(removeButtons[0]);
    
    // Check if onRemoveUser was called with the correct user id
    expect(mockOnRemoveUser).toHaveBeenCalledWith('1');
  });

  it('is responsive', () => {
    const { container } = render(
      <UserManagement 
        users={mockUsers} 
        onAddUser={mockOnAddUser} 
        onRemoveUser={mockOnRemoveUser} 
        onUpdateRole={mockOnUpdateRole} 
      />
    );
    
    // Test responsive classes
    expect(container.firstChild).toHaveClass('w-full');
  });

  it('meets accessibility standards', () => {
    render(
      <UserManagement 
        users={mockUsers} 
        onAddUser={mockOnAddUser} 
        onRemoveUser={mockOnRemoveUser} 
        onUpdateRole={mockOnUpdateRole} 
      />
    );
    
    // Test accessibility attributes
    const headingElement = screen.getByRole('heading', { name: /User Management/i });
    expect(headingElement).toBeInTheDocument();
    
    // Test table accessibility
    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();
  });
});