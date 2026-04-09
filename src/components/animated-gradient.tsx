'use client';

import React, { useEffect, useState, useCallback } from 'react';

export function AnimatedGradient() {
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const [targetPosition, setTargetPosition] = useState({ x: 50, y: 50 });

  const handleMouseMove = useCallback((e: MouseEvent) => {
    setTargetPosition({
      x: (e.clientX / window.innerWidth) * 100,
      y: (e.clientY / window.innerHeight) * 100,
    });
  }, []);

  useEffect(() => {
    let animationId: number;
    const animate = () => {
      setPosition(prev => ({
        x: prev.x + (targetPosition.x - prev.x) * 0.02,
        y: prev.y + (targetPosition.y - prev.y) * 0.02,
      }));
      animationId = requestAnimationFrame(animate);
    };
    
    const intervalId = setInterval(() => {
      cancelAnimationFrame(animationId);
      animationId = requestAnimationFrame(animate);
    }, 50);

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationId);
      clearInterval(intervalId);
    };
  }, [handleMouseMove, targetPosition]);

  return (
    <>
      <div 
        className="fixed inset-0 -z-10"
        style={{
          background: `
            linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)
          `,
        }}
      />
      
      <div 
        className="fixed inset-0 -z-10 pointer-events-none"
        style={{
          background: `
            radial-gradient(
              800px circle at ${position.x}% ${position.y}%,
              rgba(13, 148, 136, 0.15) 0%,
              rgba(20, 184, 166, 0.08) 30%,
              transparent 60%
            )
          `,
          transition: 'background 0.5s ease-out',
        }}
      />
      
      <div 
        className="fixed inset-0 -z-10 pointer-events-none"
        style={{
          background: `
            radial-gradient(
              600px circle at ${100 - position.x * 0.5}% ${position.y * 0.7}%,
              rgba(0, 168, 150, 0.1) 0%,
              rgba(45, 212, 191, 0.05) 40%,
              transparent 70%
            )
          `,
          transition: 'background 0.8s ease-out',
        }}
      />
      
      <div 
        className="fixed inset-0 -z-10 pointer-events-none"
        style={{
          background: `
            radial-gradient(
              500px circle at 50% 0%,
              rgba(13, 148, 136, 0.1) 0%,
              transparent 50%
            )
          `,
        }}
      />
    </>
  );
}
