import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renders the application title in header', () => {
    render(<App />);
    expect(screen.getByText('N-Dimensional Visualizer')).toBeInTheDocument();
  });

  it('renders the control panel', () => {
    render(<App />);
    expect(screen.getByText('Visualization Controls')).toBeInTheDocument();
  });

  it('renders the Object section with dimension selector', () => {
    render(<App />);
    // Object appears multiple times, so use getAllByText
    const objectElements = screen.getAllByText('Object');
    expect(objectElements.length).toBeGreaterThan(0);
    expect(screen.getByText('Dimension')).toBeInTheDocument();
  });

  it('renders the Rotation section', () => {
    render(<App />);
    // Rotation appears in both section header and education panel
    const rotationElements = screen.getAllByText('Rotation');
    expect(rotationElements.length).toBeGreaterThan(0);
  });

  it('renders the Projection section', () => {
    render(<App />);
    // Projection appears in both section header and education panel
    const projectionElements = screen.getAllByText('Projection');
    expect(projectionElements.length).toBeGreaterThan(0);
  });
});
