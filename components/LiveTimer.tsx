import React, { useState, useEffect } from 'react';

interface LiveTimerProps {
  dueDate: Date;
  checkoutDate?: Date;
  compact?: boolean;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  milliseconds: number;
  isOverdue: boolean;
  totalMs: number;
}

const LiveTimer: React.FC<LiveTimerProps> = ({ dueDate, checkoutDate, compact = false }) => {
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining>(calculateTimeRemaining(dueDate));

  function calculateTimeRemaining(due: Date): TimeRemaining {
    const now = Date.now();
    const dueTime = new Date(due).getTime();
    const diff = dueTime - now;
    const isOverdue = diff < 0;
    const absDiff = Math.abs(diff);

    const days = Math.floor(absDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((absDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((absDiff % (1000 * 60)) / 1000);
    const milliseconds = Math.floor((absDiff % 1000) / 10); // Show centiseconds (2 digits)

    return { days, hours, minutes, seconds, milliseconds, isOverdue, totalMs: diff };
  }

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeRemaining(calculateTimeRemaining(dueDate));
    }, 10); // Update every 10ms for smooth milliseconds display

    return () => clearInterval(interval);
  }, [dueDate]);

  const pad = (num: number, size: number = 2) => String(num).padStart(size, '0');

  if (compact) {
    return (
      <div className={`font-mono text-xs ${timeRemaining.isOverdue ? 'text-red-600' : 'text-green-600'}`}>
        <span className={timeRemaining.isOverdue ? 'text-red-500' : 'text-slate-600'}>
          {timeRemaining.isOverdue ? 'OVERDUE ' : ''}
        </span>
        <span className="font-bold">
          {pad(timeRemaining.days)}d {pad(timeRemaining.hours)}h {pad(timeRemaining.minutes)}m {pad(timeRemaining.seconds)}s
        </span>
        <span className="text-[10px] opacity-70">.{pad(timeRemaining.milliseconds)}</span>
      </div>
    );
  }

  return (
    <div className={`rounded-lg p-2 ${timeRemaining.isOverdue ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
      <div className="text-[10px] uppercase tracking-wider text-center mb-1 font-semibold">
        {timeRemaining.isOverdue ? (
          <span className="text-red-600">⚠️ Overdue By</span>
        ) : (
          <span className="text-green-600">⏱️ Time Remaining</span>
        )}
      </div>
      <div className="flex items-center justify-center gap-1 font-mono">
        <TimeUnit value={timeRemaining.days} label="D" isOverdue={timeRemaining.isOverdue} />
        <span className={timeRemaining.isOverdue ? 'text-red-400' : 'text-green-400'}>:</span>
        <TimeUnit value={timeRemaining.hours} label="H" isOverdue={timeRemaining.isOverdue} />
        <span className={timeRemaining.isOverdue ? 'text-red-400' : 'text-green-400'}>:</span>
        <TimeUnit value={timeRemaining.minutes} label="M" isOverdue={timeRemaining.isOverdue} />
        <span className={timeRemaining.isOverdue ? 'text-red-400' : 'text-green-400'}>:</span>
        <TimeUnit value={timeRemaining.seconds} label="S" isOverdue={timeRemaining.isOverdue} />
        <span className={`text-xs ${timeRemaining.isOverdue ? 'text-red-400' : 'text-green-400'}`}>.</span>
        <div className={`text-sm font-bold ${timeRemaining.isOverdue ? 'text-red-600' : 'text-green-600'}`}>
          {pad(timeRemaining.milliseconds)}
        </div>
      </div>
    </div>
  );
};

const TimeUnit: React.FC<{ value: number; label: string; isOverdue: boolean }> = ({ value, label, isOverdue }) => (
  <div className="flex flex-col items-center">
    <span className={`text-lg md:text-xl font-bold ${isOverdue ? 'text-red-600' : 'text-green-600'}`}>
      {String(value).padStart(2, '0')}
    </span>
    <span className={`text-[8px] uppercase ${isOverdue ? 'text-red-400' : 'text-green-400'}`}>{label}</span>
  </div>
);

export default LiveTimer;
