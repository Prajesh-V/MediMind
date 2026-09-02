/**
 * Robust timezone utilities relying on native Intl API.
 * This guarantees the exact same deterministic conversion without large libraries.
 */

/**
 * Returns the current date (YYYY-MM-DD) as experienced in the target timezone.
 */
export function getPatientToday(timeZone: string): string {
  const formatter = new Intl.DateTimeFormat('en-US', { 
    timeZone, 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit' 
  });
  
  const parts = formatter.formatToParts(new Date());
  const year = parts.find(p => p.type === 'year')?.value || '1970';
  const month = parts.find(p => p.type === 'month')?.value || '01';
  const day = parts.find(p => p.type === 'day')?.value || '01';
  
  return `${year}-${month}-${day}`;
}

/**
 * Resolves a local wall-clock date and time in a specific timezone to a UTC timestamp string.
 * @param localDate "YYYY-MM-DD"
 * @param localTime "HH:mm:ss"
 * @param timeZone "Asia/Kolkata", "America/New_York", etc.
 */
export function localToUtc(localDate: string, localTime: string, timeZone: string): string {
  // Use a fallback to UTC if timeZone is invalid/missing
  if (!timeZone || timeZone === 'Unknown') {
    timeZone = 'UTC';
  }

  try {
    const dt = new Date(`${localDate}T${localTime}Z`);
    
    const format = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false
    });

    let currentGuessUtc = dt.getTime();
    
    // Iteratively converge on the exact UTC instant (solves DST gap/overlap ambiguities deterministically)
    for (let i = 0; i < 5; i++) {
      const parts = format.formatToParts(new Date(currentGuessUtc));
      
      let lYear = 0, lMonth = 0, lDay = 0, lHour = 0, lMinute = 0, lSecond = 0;
      for (const p of parts) {
        if (p.type === 'year') lYear = parseInt(p.value, 10);
        if (p.type === 'month') lMonth = parseInt(p.value, 10);
        if (p.type === 'day') lDay = parseInt(p.value, 10);
        if (p.type === 'hour') lHour = parseInt(p.value, 10);
        if (p.type === 'minute') lMinute = parseInt(p.value, 10);
        if (p.type === 'second') lSecond = parseInt(p.value, 10);
      }
      
      if (lHour === 24) lHour = 0;

      const guessLocalAsUtc = Date.UTC(lYear, lMonth - 1, lDay, lHour, lMinute, lSecond);
      const targetLocalAsUtc = dt.getTime();
      
      const diff = targetLocalAsUtc - guessLocalAsUtc;
      if (diff === 0) {
        return new Date(currentGuessUtc).toISOString();
      }
      
      currentGuessUtc += diff;
    }
    
    return new Date(currentGuessUtc).toISOString();
  } catch (err) {
    // If the timezone string is invalid, fallback to UTC
    console.warn(`Timezone conversion failed for ${timeZone}, falling back to UTC`, err);
    return new Date(`${localDate}T${localTime}Z`).toISOString();
  }
}
