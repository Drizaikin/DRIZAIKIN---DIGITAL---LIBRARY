import React, { useEffect, useState } from 'react';

const ChristmasDecorations: React.FC = () => {
  const [snowflakes, setSnowflakes] = useState<Array<{ id: number; left: number; delay: number; duration: number; size: number }>>([]);

  useEffect(() => {
    // Generate snowflakes
    const flakes = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 5,
      duration: 10 + Math.random() * 10,
      size: 2 + Math.random() * 4
    }));
    setSnowflakes(flakes);
  }, []);

  return (
    <>
      {/* Snowfall Effect */}
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        {snowflakes.map((flake) => (
          <div
            key={flake.id}
            className="absolute animate-snowfall"
            style={{
              left: `${flake.left}%`,
              animationDelay: `${flake.delay}s`,
              animationDuration: `${flake.duration}s`,
              width: `${flake.size}px`,
              height: `${flake.size}px`,
            }}
          >
            <div className="w-full h-full bg-white rounded-full opacity-80 shadow-lg" />
          </div>
        ))}
      </div>

      {/* Christmas Lights - Top */}
      <div className="fixed top-0 left-0 right-0 pointer-events-none z-40 h-12">
        <div className="flex justify-around items-start h-full">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center">
              <div className="w-0.5 h-4 bg-green-800" />
              <div
                className={`w-3 h-4 rounded-full animate-twinkle ${
                  i % 4 === 0
                    ? 'bg-red-500'
                    : i % 4 === 1
                    ? 'bg-green-500'
                    : i % 4 === 2
                    ? 'bg-blue-500'
                    : 'bg-yellow-400'
                }`}
                style={{
                  animationDelay: `${i * 0.2}s`,
                  boxShadow: `0 0 10px ${
                    i % 4 === 0
                      ? '#ef4444'
                      : i % 4 === 1
                      ? '#22c55e'
                      : i % 4 === 2
                      ? '#3b82f6'
                      : '#facc15'
                  }`,
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Floating Christmas Elements */}
      <div className="fixed inset-0 pointer-events-none z-30 overflow-hidden">
        {/* Floating Stars */}
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={`star-${i}`}
            className="absolute animate-float-slow"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${i * 0.5}s`,
              animationDuration: `${8 + Math.random() * 4}s`,
            }}
          >
            <div className="text-yellow-400 text-2xl opacity-60">⭐</div>
          </div>
        ))}

        {/* Floating Ornaments */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={`ornament-${i}`}
            className="absolute animate-swing"
            style={{
              left: `${10 + i * 12}%`,
              top: `${5 + (i % 3) * 10}%`,
              animationDelay: `${i * 0.3}s`,
            }}
          >
            <div className="text-3xl opacity-70">
              {i % 3 === 0 ? '🎄' : i % 3 === 1 ? '🎁' : '🔔'}
            </div>
          </div>
        ))}
      </div>

      {/* Corner Decorations */}
      <div className="fixed top-0 left-0 pointer-events-none z-40">
        <div className="text-6xl opacity-80 transform -rotate-12">🎄</div>
      </div>
      <div className="fixed top-0 right-0 pointer-events-none z-40">
        <div className="text-6xl opacity-80 transform rotate-12">🎄</div>
      </div>

      {/* Bottom Decorations */}
      <div className="fixed bottom-4 left-4 pointer-events-none z-40">
        <div className="text-4xl opacity-70 animate-bounce-slow">🎅</div>
      </div>
      <div className="fixed bottom-4 right-4 pointer-events-none z-40">
        <div className="text-4xl opacity-70 animate-bounce-slow" style={{ animationDelay: '0.5s' }}>
          ⛄
        </div>
      </div>

      {/* Festive Banner */}
      <div className="fixed top-16 left-1/2 transform -translate-x-1/2 pointer-events-none z-40">
        <div className="bg-gradient-to-r from-red-600 via-green-600 to-red-600 text-white px-6 py-2 rounded-full shadow-2xl animate-pulse-slow">
          <p className="text-sm font-bold tracking-wider">🎄 Merry Christmas! 🎅</p>
        </div>
      </div>
    </>
  );
};

export default ChristmasDecorations;
