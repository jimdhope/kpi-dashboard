'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import { useTheme } from 'next-themes'; // Import useTheme

class Icon {
  x: number;
  y: number;
  size: number;
  iconContent: string;
  dx: number;
  dy: number;
  damping: number = 0.98; // Damping factor

  constructor(x: number, y: number, size: number, iconContent: string, dx: number, dy: number) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.iconContent = iconContent;
    this.dx = dx;
    this.dy = dy;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.font = `${this.size}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Optional: Set fillStyle if you want to color non-emoji text or shapes later
    // ctx.fillStyle = this.color; // Color is less relevant for standard emojis
    ctx.fillText(this.iconContent, this.x, this.y);
  }

  update(canvasWidth: number, canvasHeight: number) {
    this.x += this.dx;
    this.y += this.dy;

    // Bounce off walls with damping
    if (this.x + this.size / 2 > canvasWidth || this.x - this.size / 2 < 0) {
      this.dx = -this.dx * this.damping;
      // Adjust position slightly to prevent sticking
      this.x = Math.max(this.size / 2, Math.min(canvasWidth - this.size / 2, this.x));
    }
    if (this.y + this.size / 2 > canvasHeight || this.y - this.size / 2 < 0) {
      this.dy = -this.dy * this.damping;
        // Adjust position slightly to prevent sticking
      this.y = Math.max(this.size / 2, Math.min(canvasHeight - this.size / 2, this.y));
    }

     // Optional: Apply slight gravity or drag if desired
     // this.dy += 0.01; // Example gravity
     // this.dx *= 0.999; // Example drag
     // this.dy *= 0.999;
  }
}

const AnimatedIconBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const iconsRef = useRef<Icon[]>([]);
  const animationFrameIdRef = useRef<number | null>(null);
  const { resolvedTheme } = useTheme(); // Get the resolved theme

  const iconEmojis = ['🏆', '🎯', '📊', '📈', '🏅', '🥇', '🥈', '🥉', '🌟', '💪', '🚀', '✨'];
  const numberOfIcons = 50;
  const fixedIconSize = 20;

  const initIcons = useCallback((canvasWidth: number, canvasHeight: number) => {
    iconsRef.current = [];
    for (let i = 0; i < numberOfIcons; i++) {
      const size = fixedIconSize;
      const x = Math.random() * (canvasWidth - size) + size / 2;
      const y = Math.random() * (canvasHeight - size) + size / 2;
      const iconContent = iconEmojis[Math.floor(Math.random() * iconEmojis.length)];
      const dx = (Math.random() - 0.5) * 0.3; // Reduced velocity
      const dy = (Math.random() - 0.5) * 0.3; // Reduced velocity
      iconsRef.current.push(new Icon(x, y, size, iconContent, dx, dy));
    }
  }, [iconEmojis, numberOfIcons, fixedIconSize]); // Dependencies for initIcons

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = window.innerWidth;
       // Adjust height based on the container or desired coverage
       // For full viewport height: canvas.height = window.innerHeight;
       // For hero section height (needs parent dimensions or fixed value):
       canvas.height = canvas.parentElement?.clientHeight || window.innerHeight; // Example: Use parent height
      initIcons(canvas.width, canvas.height);
    }
  }, [initIcons]);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');

    if (!canvas || !ctx) return;

    // Determine background color based on theme
    const bgColor = resolvedTheme === 'dark' ? 'hsl(var(--background))' : 'hsl(var(--background))';
    // Clear canvas with theme-appropriate background color
    // We need to parse the HSL string to use it with fillStyle
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);


    iconsRef.current.forEach(icon => {
      icon.update(canvas.width, canvas.height);
      icon.draw(ctx);
    });

    animationFrameIdRef.current = requestAnimationFrame(animate);
  }, [resolvedTheme]); // Add resolvedTheme as dependency

  useEffect(() => {
    resizeCanvas(); // Initial setup
    animationFrameIdRef.current = requestAnimationFrame(animate);

    window.addEventListener('resize', resizeCanvas);

    // Cleanup function
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [resizeCanvas, animate]); // useEffect dependencies

  // Style the canvas to be in the background
  return (
    <canvas
      ref={canvasRef}
      id="backgroundCanvas"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: -1, // Position behind content
        display: 'block', // Prevent extra space below canvas
        opacity: resolvedTheme === 'dark' ? 0.1 : 0.15, // Adjust opacity based on theme
        transition: 'opacity 0.3s ease-in-out', // Smooth transition for opacity change
      }}
    />
  );
};

export default AnimatedIconBackground;
