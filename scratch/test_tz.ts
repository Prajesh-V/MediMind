export function localToUtc(localDate: string, localTime: string, timeZone: string): string {
  // localDate: "2026-09-03"
  // localTime: "08:00:00"
  
  // First, parse the target local date/time as if it were UTC.
  const dt = new Date(`${localDate}T${localTime}Z`);
  
  // We need to find the UTC time `X` such that formatting `X` into `timeZone` yields `localDate` and `localTime`.
  
  // Start with a guess: the UTC time is probably the local time minus the timezone offset.
  // Let's get the offset of the target timezone at this naive UTC time.
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

  // Iterative approach to find exact UTC Date that matches the target local time.
  // Because DST shifts can cause 1 hour gaps or overlaps.
  
  let currentGuessUtc = dt.getTime();
  
  for (let i = 0; i < 5; i++) {
    const d = new Date(currentGuessUtc);
    const parts = format.formatToParts(d);
    
    let lYear = 0, lMonth = 0, lDay = 0, lHour = 0, lMinute = 0, lSecond = 0;
    for (const p of parts) {
      if (p.type === 'year') lYear = parseInt(p.value, 10);
      if (p.type === 'month') lMonth = parseInt(p.value, 10);
      if (p.type === 'day') lDay = parseInt(p.value, 10);
      if (p.type === 'hour') lHour = parseInt(p.value, 10);
      if (p.type === 'minute') lMinute = parseInt(p.value, 10);
      if (p.type === 'second') lSecond = parseInt(p.value, 10);
    }
    
    // JS hour is 24 format for hour12: false, but 24 usually comes as '24' instead of '00'.
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
}

console.log(localToUtc('2026-09-03', '00:00:00', 'Asia/Kolkata')); // Start of day
console.log(localToUtc('2026-09-03', '23:59:59', 'Asia/Kolkata')); // End of day
