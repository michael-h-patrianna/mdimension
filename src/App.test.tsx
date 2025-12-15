import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renders the application title in header', () => {
    render(<App />);
    expect(screen.getByText('MDIMENSION')).toBeInTheDocument();
  });

  it('renders the Explorer panel with dimension selector', () => {
    render(<App />);
    // "Space & Object" header in Left Panel
    expect(screen.getByText(/Space & Object/i)).toBeInTheDocument();
    // Dimension selector shows dimension buttons (4D is default)
    expect(screen.getByRole('radio', { name: '4D' })).toBeInTheDocument();
  });

  it('renders the Timeline controls', () => {
    render(<App />);
    // Check for "SPD" label from TimelineControls
    expect(screen.getByText('SPD')).toBeInTheDocument();
    // Check for Play/Pause button. Since default state might be playing or paused, check for either.
    // The queryByTitle returns null if not found, getByTitle throws.
    const playBtn = screen.queryByTitle('Play');
    const pauseBtn = screen.queryByTitle('Pause');
    expect(playBtn || pauseBtn).toBeInTheDocument();
  });

  it('renders the Style section by default', () => {
    render(<App />);
    // Style tab (Faces, Edges, Lights) is default now
    // Check for Faces section content
    expect(screen.getAllByText(/Faces/i).length).toBeGreaterThan(0);
  });

  it('renders the Projection section when Scene tab is selected', () => {
    render(<App />);
    
    // Find Scene tab
    const sceneTab = screen.getByRole('tab', { name: /Scene/i });
    fireEvent.click(sceneTab);

    // Projection appears in Scene tab
    const projectionElements = screen.getAllByText(/Projection/i);
    expect(projectionElements.length).toBeGreaterThan(0);
  });
});
