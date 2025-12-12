import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renders the application title in header', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /N\s?-DIMENSIONAL VISUALIZER/i })).toBeInTheDocument();
  });

  it('renders the control panel', () => {
    render(<App />);
    expect(screen.getByText('SYSTEM CONTROLS')).toBeInTheDocument();
  });

  it('renders the Object section with dimension selector', () => {
    render(<App />);
    // Object appears multiple times, so use getAllByText with regex
    const objectElements = screen.getAllByText(/Object/i);
    expect(objectElements.length).toBeGreaterThan(0);
    // Dimension selector shows dimension buttons (4D is default)
    expect(screen.getByRole('radio', { name: '4D' })).toBeInTheDocument();
  });

  it('renders the Rotation section', () => {
    render(<App />);
    // Rotation appears in both section header and education panel
    const rotationElements = screen.getAllByText(/Rotation/i);
    expect(rotationElements.length).toBeGreaterThan(0);
  });

  it('renders the Projection section', () => {
    render(<App />);
    // Projection appears in both section header and education panel
    const projectionElements = screen.getAllByText(/Projection/i);
    expect(projectionElements.length).toBeGreaterThan(0);
  });
});