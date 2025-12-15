import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TestSection } from '@/components/sections/Test/TestSection';

describe('TestSection', () => {
  it('renders correctly', () => {
    render(<TestSection defaultOpen={true} />);
    expect(screen.getByText('TEST')).toBeInTheDocument();
    expect(screen.getByText('Attack')).toBeInTheDocument();
    expect(screen.getByText('Decay')).toBeInTheDocument();
  });
});
