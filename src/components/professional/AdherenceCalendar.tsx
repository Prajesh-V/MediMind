'use client';

import { useState, useEffect, useMemo } from 'react';
import { getPatientDoseHistory, getPatientTimezone } from '@/app/actions/dose';
import { Surface } from '@/components/ui/Surface';
import styles from './AdherenceCalendar.module.css';

interface AdherenceCalendarProps {
  patientId: string;
}

export function AdherenceCalendar({ patientId }: AdherenceCalendarProps) {
  const [doses, setDoses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timezone, setTimezone] = useState<string>('UTC');
  
  // Date states
  const [currentDate, setCurrentDate] = useState(new Date()); // Represents the viewed month
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        // Fetch 90 days to cover past months safely
        const [historyDoses, tz] = await Promise.all([
          getPatientDoseHistory(patientId, 90),
          getPatientTimezone(patientId)
        ]);
        setDoses(historyDoses);
        setTimezone(tz || 'UTC');
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [patientId]);

  // Helper to format a Date object or ISO string to YYYY-MM-DD in patient's timezone
  const toLocalDateStr = (date: Date | string, tz: string) => {
    return new Date(date).toLocaleDateString('en-CA', { timeZone: tz });
  };

  const toLocalTimeString = (date: Date | string, tz: string) => {
    return new Date(date).toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' });
  };

  // Build a map of dateStr -> dose[]
  const dosesByDate = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const d of doses) {
      if (!d.scheduled_time) continue;
      const dStr = toLocalDateStr(d.scheduled_time, timezone);
      if (!map.has(dStr)) map.set(dStr, []);
      map.get(dStr)!.push(d);
    }
    return map;
  }, [doses, timezone]);

  // Calendar generation for `currentDate`'s month
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth(); // 0-based
    
    // First day of the month
    const firstDay = new Date(year, month, 1);
    // Last day of the month
    const lastDay = new Date(year, month + 1, 0);
    
    const startOffset = firstDay.getDay(); // 0 = Sunday
    const daysInMonth = lastDay.getDate();

    const days = [];
    
    // Padding days for previous month
    for (let i = 0; i < startOffset; i++) {
      days.push(null);
    }
    
    // Actual days
    for (let i = 1; i <= daysInMonth; i++) {
      // Create local date string safely for grouping matching
      // We pad month and day to ensure YYYY-MM-DD format
      const y = year;
      const m = String(month + 1).padStart(2, '0');
      const d = String(i).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;
      days.push({ day: i, dateStr });
    }
    
    return days;
  }, [currentDate]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    setSelectedDateStr(null);
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    setSelectedDateStr(null);
  };

  const getStatusClass = (dateStr: string) => {
    const dayDoses = dosesByDate.get(dateStr) || [];
    if (dayDoses.length === 0) return styles.statusNone;

    const allTaken = dayDoses.every(d => d.status === 'taken');
    const anyMissed = dayDoses.some(d => d.status === 'missed');
    const anyPending = dayDoses.some(d => d.status === 'pending');

    if (allTaken) return styles.statusAllTaken;
    if (anyMissed) return styles.statusMissed;
    if (anyPending) return styles.statusPending;
    return styles.statusMixed; // Skipped or mixed states
  };

  const monthLabel = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  const selectedDoses = selectedDateStr ? dosesByDate.get(selectedDateStr) || [] : [];

  if (loading) return <Surface padding="md"><p>Loading adherence data...</p></Surface>;
  if (error) return <Surface padding="md"><p>Error: {error}</p></Surface>;

  return (
    <div className={styles.container}>
      <div className={styles.calendarHeader}>
          <button className={styles.navButton} onClick={handlePrevMonth}>&larr; Prev</button>
          <span className={styles.monthLabel}>{monthLabel}</span>
          <button className={styles.navButton} onClick={handleNextMonth}>Next &rarr;</button>
        </div>

        <div className={styles.grid}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className={styles.dayOfWeek}>{day}</div>
          ))}
          
          {calendarDays.map((cell, idx) => {
            if (!cell) {
              return <div key={`empty-${idx}`} className={`${styles.cell} ${styles.empty}`} />;
            }
            
            const hasData = dosesByDate.has(cell.dateStr);
            const isSelected = selectedDateStr === cell.dateStr;
            const statusClass = getStatusClass(cell.dateStr);
            
            return (
              <div 
                key={cell.dateStr} 
                className={`${styles.cell} ${!hasData ? styles.empty : ''} ${isSelected ? styles.selected : ''}`}
                onClick={() => hasData && setSelectedDateStr(cell.dateStr)}
                role="button"
                tabIndex={hasData ? 0 : -1}
                aria-label={hasData ? `View doses for ${cell.dateStr}` : `No doses on ${cell.dateStr}`}
              >
                <span className={styles.dateLabel}>{cell.day}</span>
                {hasData && <div className={`${styles.indicator} ${statusClass}`} />}
              </div>
            );
          })}
        </div>

        {selectedDateStr && (
          <div className={styles.detailPanel}>
            <div className={styles.detailHeader}>
              Medications for {new Date(selectedDateStr + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
            
            {selectedDoses.length === 0 ? (
              <p className={styles.emptyState}>No medications scheduled for this date.</p>
            ) : (
              <ul className={styles.detailList}>
                {selectedDoses.map((dose) => {
                  const med = dose.patient_medications;
                  const sched = dose.medication_schedules;
                  const badgeClass = 
                    dose.status === 'taken' ? styles.badgeTaken :
                    dose.status === 'missed' ? styles.badgeMissed :
                    dose.status === 'skipped' ? styles.badgeSkipped :
                    styles.badgePending;

                  return (
                    <li key={dose.id} className={styles.doseItem}>
                      <div className={styles.doseInfo}>
                        <span className={styles.medName}>
                          {med?.display_name} {med?.dosage_amount}{med?.dosage_unit}
                        </span>
                        <span className={styles.doseTime}>
                          Scheduled: {sched?.time_of_day || toLocalTimeString(dose.scheduled_time, timezone)}
                        </span>
                      </div>
                      <span className={`${styles.doseBadge} ${badgeClass}`}>
                        {dose.status}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
  );
}
