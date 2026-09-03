import fs from 'fs';
import path from 'path';

const localesDir = path.join(process.cwd(), 'src', 'i18n', 'locales');
const files = ['en.json', 'hi.json', 'kn.json', 'ta.json', 'te.json', 'ml.json'];

const additions: Record<string, Record<string, string>> = {
  en: {
    prof_greeting: "Good morning,",
    prof_overview: "Here’s your patient care overview.",
    prof_patients_title: "Patients",
    prof_patients_desc: "Active patients under your care",
    prof_alerts_title: "Alerts",
    prof_alerts_desc: "Active alerts requiring attention",
    prof_add_patient: "Add Patient",
    prof_enter_code: "Enter the 6-character code provided by your patient.",
    prof_active_alerts: "Active Alerts",
    prof_no_alerts: "No active alerts.",
    prof_patient_label: "Patient:",
    prof_med_adherence: "Medication Adherence"
  },
  hi: {
    prof_greeting: "सुप्रभात,",
    prof_overview: "यहाँ आपका रोगी देखभाल अवलोकन है।",
    prof_patients_title: "रोगी",
    prof_patients_desc: "आपकी देखभाल में सक्रिय रोगी",
    prof_alerts_title: "अलर्ट",
    prof_alerts_desc: "सक्रिय अलर्ट जिन पर ध्यान देने की आवश्यकता है",
    prof_add_patient: "रोगी जोड़ें",
    prof_enter_code: "अपने रोगी द्वारा प्रदान किया गया 6-वर्ण का कोड दर्ज करें।",
    prof_active_alerts: "सक्रिय अलर्ट",
    prof_no_alerts: "कोई सक्रिय अलर्ट नहीं।",
    prof_patient_label: "रोगी:",
    prof_med_adherence: "दवा अनुपालन"
  },
  kn: {
    prof_greeting: "ಶುಭೋದಯ,",
    prof_overview: "ನಿಮ್ಮ ರೋಗಿಗಳ ಆರೈಕೆಯ ಅವಲೋಕನ ಇಲ್ಲಿದೆ.",
    prof_patients_title: "ರೋಗಿಗಳು",
    prof_patients_desc: "ನಿಮ್ಮ ಆರೈಕೆಯಲ್ಲಿರುವ ಸಕ್ರಿಯ ರೋಗಿಗಳು",
    prof_alerts_title: "ಎಚ್ಚರಿಕೆಗಳು",
    prof_alerts_desc: "ಗಮನಹರಿಸಬೇಕಾದ ಸಕ್ರಿಯ ಎಚ್ಚರಿಕೆಗಳು",
    prof_add_patient: "ರೋಗಿಯನ್ನು ಸೇರಿಸಿ",
    prof_enter_code: "ನಿಮ್ಮ ರೋಗಿಯು ನೀಡಿದ 6-ಅಕ್ಷರದ ಕೋಡ್ ಅನ್ನು ನಮೂದಿಸಿ.",
    prof_active_alerts: "ಸಕ್ರಿಯ ಎಚ್ಚರಿಕೆಗಳು",
    prof_no_alerts: "ಯಾವುದೇ ಸಕ್ರಿಯ ಎಚ್ಚರಿಕೆಗಳಿಲ್ಲ.",
    prof_patient_label: "ರೋಗಿ:",
    prof_med_adherence: "ಔಷಧ ಅನುಸರಣೆ"
  },
  ta: {
    prof_greeting: "காலை வணக்கம்,",
    prof_overview: "உங்கள் நோயாளி பராமரிப்பு மேலோட்டம் இதோ.",
    prof_patients_title: "நோயாளிகள்",
    prof_patients_desc: "உங்கள் பராமரிப்பில் உள்ள செயலில் உள்ள நோயாளிகள்",
    prof_alerts_title: "எச்சரிக்கைகள்",
    prof_alerts_desc: "கவனம் தேவைப்படும் செயலில் உள்ள எச்சரிக்கைகள்",
    prof_add_patient: "நோயாளியைச் சேர்",
    prof_enter_code: "உங்கள் நோயாளி வழங்கிய 6 எழுத்து குறியீட்டை உள்ளிடவும்.",
    prof_active_alerts: "செயலில் உள்ள எச்சரிக்கைகள்",
    prof_no_alerts: "செயலில் உள்ள எச்சரிக்கைகள் இல்லை.",
    prof_patient_label: "நோயாளி:",
    prof_med_adherence: "மருந்து பின்பற்றுதல்"
  },
  te: {
    prof_greeting: "శుభోదయం,",
    prof_overview: "ఇది మీ రోగి సంరక్షణ అవలోకనం.",
    prof_patients_title: "రోగులు",
    prof_patients_desc: "మీ సంరక్షణలో చురుకైన రోగులు",
    prof_alerts_title: "అలర్ట్‌లు",
    prof_alerts_desc: "శ్రద్ధ అవసరమైన చురుకైన అలర్ట్‌లు",
    prof_add_patient: "రోగిని జోడించండి",
    prof_enter_code: "మీ రోగి అందించిన 6-అక్షరాల కోడ్‌ను నమోదు చేయండి.",
    prof_active_alerts: "చురుకైన అలర్ట్‌లు",
    prof_no_alerts: "చురుకైన అలర్ట్‌లు లేవు.",
    prof_patient_label: "రోగి:",
    prof_med_adherence: "మందుల అనుసరణ"
  },
  ml: {
    prof_greeting: "സുപ്രഭാതം,",
    prof_overview: "നിങ്ങളുടെ രോഗി പരിചരണ അവലോകനം ഇതാ.",
    prof_patients_title: "രോഗികൾ",
    prof_patients_desc: "നിങ്ങളുടെ പരിചരണത്തിലുള്ള സജീവ രോഗികൾ",
    prof_alerts_title: "അലേർട്ടുകൾ",
    prof_alerts_desc: "ശ്രദ്ധിക്കേണ്ട സജീവ അലേർട്ടുകൾ",
    prof_add_patient: "രോഗിയെ ചേർക്കുക",
    prof_enter_code: "നിങ്ങളുടെ രോഗി നൽകിയ 6 അക്ഷര കോഡ് നൽകുക.",
    prof_active_alerts: "സജീവ അലേർട്ടുകൾ",
    prof_no_alerts: "സജീവ അലേർട്ടുകളൊന്നുമില്ല.",
    prof_patient_label: "രോഗി:",
    prof_med_adherence: "മരുന്ന് പാലിക്കൽ"
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
