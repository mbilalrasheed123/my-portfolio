'use client'

import React, { Suspense, lazy, useState } from 'react'

const Spline = lazy(() => import('@splinetool/react-spline'))

interface SplineSceneProps {
  scene: string
  className?: string
}

export function SplineScene({ scene, className }: SplineSceneProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div className={`w-full h-full relative transition-opacity duration-1000 ${isLoaded ? 'opacity-100' : 'opacity-0'} ${className || ''}`}>
      <Suspense 
        fallback={
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
          </div>
        }
      >
        <Spline
          scene={scene}
          onLoad={() => setIsLoaded(true)}
        />
      </Suspense>
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  )
}
