/**
 * Tests for AnimationDrawerContainer component
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnimationDrawerContainer } from '@/components/layout/TimelineControls/AnimationDrawerContainer';

describe('AnimationDrawerContainer', () => {
  it('should render children', () => {
    render(
      <AnimationDrawerContainer>
        <div data-testid="child-content">Test Content</div>
      </AnimationDrawerContainer>
    );
    expect(screen.getByTestId('child-content')).toBeInTheDocument();
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('should apply data-testid when provided', () => {
    render(
      <AnimationDrawerContainer data-testid="custom-drawer">
        <div>Content</div>
      </AnimationDrawerContainer>
    );
    expect(screen.getByTestId('custom-drawer')).toBeInTheDocument();
  });

  it('should have correct container styling classes', () => {
    render(
      <AnimationDrawerContainer data-testid="styled-drawer">
        <div>Content</div>
      </AnimationDrawerContainer>
    );
    const drawer = screen.getByTestId('styled-drawer');
    expect(drawer).toHaveClass('absolute');
    expect(drawer).toHaveClass('bottom-full');
    expect(drawer).toHaveClass('bg-panel-bg/95');
    expect(drawer).toHaveClass('backdrop-blur-xl');
  });

  it('should have grid layout for inner content', () => {
    const { container } = render(
      <AnimationDrawerContainer>
        <div>Content</div>
      </AnimationDrawerContainer>
    );
    // The inner div should have grid layout
    const innerDiv = container.querySelector('.grid');
    expect(innerDiv).toBeInTheDocument();
    expect(innerDiv).toHaveClass('grid-cols-1');
    expect(innerDiv).toHaveClass('gap-6');
  });

  it('should render multiple children', () => {
    render(
      <AnimationDrawerContainer>
        <div data-testid="child-1">First</div>
        <div data-testid="child-2">Second</div>
        <div data-testid="child-3">Third</div>
      </AnimationDrawerContainer>
    );
    expect(screen.getByTestId('child-1')).toBeInTheDocument();
    expect(screen.getByTestId('child-2')).toBeInTheDocument();
    expect(screen.getByTestId('child-3')).toBeInTheDocument();
  });
});
