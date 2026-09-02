async function test() {
  const url = 'https://rxnav.nlm.nih.gov/REST/approximateTerm.json?term=amlo&maxEntries=20';
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  const data = await res.json();
  const rawCandidates = data?.approximateGroup?.candidate || [];

  // Group by rxcui and pick the best name
  const rxcuiMap = new Map<string, { rxcui: string; name: string; score: number; rank?: number }>();

  for (const c of rawCandidates) {
    if (!c.rxcui) continue;
    const existing = rxcuiMap.get(c.rxcui);
    const candidateName = c.name || c.synonym;

    if (!existing) {
      if (candidateName) {
        rxcuiMap.set(c.rxcui, {
          rxcui: c.rxcui,
          name: candidateName,
          score: parseFloat(c.score || '0'),
          rank: c.rank ? parseInt(c.rank, 10) : undefined,
        });
      }
    } else if (candidateName && (!existing.name || c.source === 'RXNORM' || c.source === 'DRUGBANK')) {
      existing.name = candidateName;
    }
  }

  // Format clean results
  const results = Array.from(rxcuiMap.values()).map((item) => {
    // Capitalize first letter cleanly if all lowercase
    let cleanName = item.name;
    if (cleanName === cleanName.toLowerCase() || cleanName === cleanName.toUpperCase()) {
      cleanName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1).toLowerCase();
    }
    return {
      rxcui: item.rxcui,
      name: cleanName,
      score: item.score,
      rank: item.rank,
    };
  });

  console.log('Clean deduplicated results:', results);
}

test().catch(console.error);
