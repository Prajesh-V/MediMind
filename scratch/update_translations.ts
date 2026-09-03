import fs from 'fs';
import path from 'path';

const localesDir = path.join(process.cwd(), 'src', 'i18n', 'locales');
const files = ['en.json', 'hi.json', 'kn.json', 'ta.json', 'te.json', 'ml.json'];

const additions: Record<string, Record<string, string>> = {
  en: {
    calendar_loading: "Loading adherence data...",
    calendar_empty_day: "No medications scheduled for this date.",
    calendar_no_patients: "No connected patients. Connect a patient to view their medication adherence calendar.",
    calendar_scheduled: "Scheduled:",
    medications_for: "Medications for",
    status_taken: "Taken",
    status_missed: "Missed",
    status_skipped: "Skipped",
    status_pending: "Pending",
    status_late: "Late",
    select_patient: "Select Patient:",
    prev: "Prev",
    next: "Next",
    error: "Error"
  },
  hi: {
    calendar_loading: "अनुपालन डेटा लोड हो रहा है...",
    calendar_empty_day: "इस तिथि के लिए कोई दवा निर्धारित नहीं है।",
    calendar_no_patients: "कोई मरीज जुड़ा नहीं है। दवा अनुपालन कैलेंडर देखने के लिए मरीज को जोड़ें।",
    calendar_scheduled: "निर्धारित:",
    medications_for: "दवाएं:",
    status_taken: "लिया गया",
    status_missed: "छूट गया",
    status_skipped: "छोड़ दिया",
    status_pending: "लंबित",
    status_late: "देरी से",
    select_patient: "मरीज चुनें:",
    prev: "पिछला",
    next: "अगला",
    error: "त्रुटि"
  },
  kn: {
    calendar_loading: "ಡೇಟಾ ಲೋಡ್ ಆಗುತ್ತಿದೆ...",
    calendar_empty_day: "ಈ ದಿನಾಂಕಕ್ಕೆ ಯಾವುದೇ ಔಷಧ ನಿಗದಿಯಾಗಿಲ್ಲ.",
    calendar_no_patients: "ಯಾವುದೇ ರೋಗಿಗಳು ಸಂಪರ್ಕ ಹೊಂದಿಲ್ಲ. ಕ್ಯಾಲೆಂಡರ್ ವೀಕ್ಷಿಸಲು ರೋಗಿಯನ್ನು ಸಂಪರ್ಕಿಸಿ.",
    calendar_scheduled: "ನಿಗದಿತ:",
    medications_for: "ಔಷಧಿಗಳು:",
    status_taken: "ತೆಗೆದುಕೊಂಡಿದ್ದಾರೆ",
    status_missed: "ತಪ್ಪಿದೆ",
    status_skipped: "ಬಿಟ್ಟುಬಿಡಲಾಗಿದೆ",
    status_pending: "ಬಾಕಿ ಉಳಿದಿದೆ",
    status_late: "ತಡವಾಗಿದೆ",
    select_patient: "ರೋಗಿಯನ್ನು ಆಯ್ಕೆಮಾಡಿ:",
    prev: "ಹಿಂದಿನ",
    next: "ಮುಂದಿನ",
    error: "ದೋಷ"
  },
  ta: {
    calendar_loading: "தரவு ஏற்றப்படுகிறது...",
    calendar_empty_day: "இந்த தேதியில் மருந்துகள் திட்டமிடப்படவில்லை.",
    calendar_no_patients: "நோயாளிகள் இணைக்கப்படவில்லை. நாள்காட்டியைக் காண நோயாளியை இணைக்கவும்.",
    calendar_scheduled: "திட்டமிடப்பட்டது:",
    medications_for: "மருந்துகள்:",
    status_taken: "எடுத்துக்கொள்ளப்பட்டது",
    status_missed: "தவறவிடப்பட்டது",
    status_skipped: "தவிர்க்கப்பட்டது",
    status_pending: "நிலுவையில் உள்ளது",
    status_late: "தாமதம்",
    select_patient: "நோயாளியைத் தேர்வுசெய்க:",
    prev: "முந்தைய",
    next: "அடுத்தது",
    error: "பிழை"
  },
  te: {
    calendar_loading: "డేటా లోడ్ అవుతోంది...",
    calendar_empty_day: "ఈ తేదీకి మందులు షెడ్యూల్ చేయబడలేదు.",
    calendar_no_patients: "రోగులు కనెక్ట్ కాలేదు. క్యాలెండర్‌ను చూడటానికి రోగిని కనెక్ట్ చేయండి.",
    calendar_scheduled: "షెడ్యూల్ చేయబడింది:",
    medications_for: "మందులు:",
    status_taken: "తీసుకున్నారు",
    status_missed: "మిస్ అయ్యారు",
    status_skipped: "వదిలివేయబడింది",
    status_pending: "పెండింగ్‌లో ఉంది",
    status_late: "ఆలస్యం",
    select_patient: "రోగిని ఎంచుకోండి:",
    prev: "మునుపటి",
    next: "తరువాతి",
    error: "లోపం"
  },
  ml: {
    calendar_loading: "ഡാറ്റ ലോഡുചെയ്യുന്നു...",
    calendar_empty_day: "ഈ തീയതിക്ക് മരുന്നുകൾ ഷെഡ്യൂൾ ചെയ്തിട്ടില്ല.",
    calendar_no_patients: "രോഗികൾ കണക്റ്റുചെയ്തിട്ടില്ല. കലണ്ടർ കാണാൻ രോഗിയെ കണക്റ്റുചെയ്യുക.",
    calendar_scheduled: "ഷെഡ്യൂൾ ചെയ്തത്:",
    medications_for: "മരുന്നുകൾ:",
    status_taken: "എടുത്തു",
    status_missed: "നഷ്ടമായി",
    status_skipped: "ഒഴിവാക്കി",
    status_pending: "തീരുമാനമാകാത്തത്",
    status_late: "വൈകി",
    select_patient: "രോഗിയെ തിരഞ്ഞെടുക്കുക:",
    prev: "മുമ്പത്തെ",
    next: "അടുത്തത്",
    error: "പിശക്"
  }
};

for (const file of files) {
  const lang = file.replace('.json', '');
  const filePath = path.join(localesDir, file);
  
  try {
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const newContent = { ...content, ...(additions[lang] || additions['en']) };
    fs.writeFileSync(filePath, JSON.stringify(newContent, null, 2));
    console.log(`Updated ${file}`);
  } catch (err) {
    console.error(`Error processing ${file}`, err);
  }
}
