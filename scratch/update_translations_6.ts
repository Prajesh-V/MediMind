import fs from 'fs';
import path from 'path';

const localesDir = path.join(process.cwd(), 'src', 'i18n', 'locales');
const files = ['en.json', 'hi.json', 'kn.json', 'ta.json', 'te.json', 'ml.json'];

const additions: Record<string, Record<string, string>> = {
  en: {
    safety_interactions_title: "🛡️ Medication & Food Interaction Alerts",
    safety_evaluating: "Evaluating...",
    safety_reevaluate: "↻ Re-evaluate",
    safety_evaluating_desc: "Evaluating active medications and confirmed dietary intake against clinical knowledge rules...",
    safety_symptoms_title: "Symptoms & Safety Reports",
    safety_loading_reports: "Loading symptom reports...",
    safety_onset: "Onset:",
    safety_related_to: "Related to:",
    safety_unknown_med: "Unknown Medication"
  },
  hi: {
    safety_interactions_title: "🛡️ दवा और भोजन अंतःक्रिया अलर्ट",
    safety_evaluating: "मूल्यांकन किया जा रहा है...",
    safety_reevaluate: "↻ फिर से मूल्यांकन करें",
    safety_evaluating_desc: "नैदानिक ​​ज्ञान नियमों के विरुद्ध सक्रिय दवाओं और पुष्टि किए गए आहार सेवन का मूल्यांकन...",
    safety_symptoms_title: "लक्षण और सुरक्षा रिपोर्ट",
    safety_loading_reports: "लक्षण रिपोर्ट लोड हो रही हैं...",
    safety_onset: "शुरुआत:",
    safety_related_to: "संबंधित:",
    safety_unknown_med: "अज्ञात दवा"
  },
  kn: {
    safety_interactions_title: "🛡️ ಔಷಧ ಮತ್ತು ಆಹಾರ ಪರಸ್ಪರ ಕ್ರಿಯೆಯ ಎಚ್ಚರಿಕೆಗಳು",
    safety_evaluating: "ಮೌಲ್ಯಮಾಪನ ಮಾಡಲಾಗುತ್ತಿದೆ...",
    safety_reevaluate: "↻ ಮರು ಮೌಲ್ಯಮಾಪನ ಮಾಡಿ",
    safety_evaluating_desc: "ಕ್ಲಿನಿಕಲ್ ಜ್ಞಾನದ ನಿಯಮಗಳ ವಿರುದ್ಧ ಸಕ್ರಿಯ ಔಷಧಗಳು ಮತ್ತು ದೃಢಪಡಿಸಿದ ಆಹಾರ ಸೇವನೆಯನ್ನು ಮೌಲ್ಯಮಾಪನ ಮಾಡಲಾಗುತ್ತಿದೆ...",
    safety_symptoms_title: "ರೋಗಲಕ್ಷಣಗಳು ಮತ್ತು ಸುರಕ್ಷತಾ ವರದಿಗಳು",
    safety_loading_reports: "ರೋಗಲಕ್ಷಣದ ವರದಿಗಳನ್ನು ಲೋಡ್ ಮಾಡಲಾಗುತ್ತಿದೆ...",
    safety_onset: "ಪ್ರಾರಂಭ:",
    safety_related_to: "ಇದಕ್ಕೆ ಸಂಬಂಧಿಸಿದೆ:",
    safety_unknown_med: "ಅಜ್ಞಾತ ಔಷಧ"
  },
  ta: {
    safety_interactions_title: "🛡️ மருந்து மற்றும் உணவு இடைவினை எச்சரிக்கைகள்",
    safety_evaluating: "மதிப்பிடப்படுகிறது...",
    safety_reevaluate: "↻ மீண்டும் மதிப்பிடு",
    safety_evaluating_desc: "மருத்துவ அறிவு விதிகளுக்கு எதிராக செயலில் உள்ள மருந்துகள் மற்றும் உறுதிப்படுத்தப்பட்ட உணவு உட்கொள்ளல் ஆகியவற்றை மதிப்பிடுதல்...",
    safety_symptoms_title: "அறிகுறிகள் மற்றும் பாதுகாப்பு அறிக்கைகள்",
    safety_loading_reports: "அறிகுறி அறிக்கைகளை ஏற்றுகிறது...",
    safety_onset: "தொடக்கம்:",
    safety_related_to: "தொடர்புடையது:",
    safety_unknown_med: "தெரியாத மருந்து"
  },
  te: {
    safety_interactions_title: "🛡️ మందులు మరియు ఆహార పరస్పర చర్యల అలర్ట్‌లు",
    safety_evaluating: "మూల్యాంకనం చేయబడుతోంది...",
    safety_reevaluate: "↻ మళ్లీ మూల్యాంకనం చేయండి",
    safety_evaluating_desc: "క్లినికల్ నాలెడ్జ్ నియమాలకు వ్యతిరేకంగా క్రియాశీల మందులు మరియు ధృవీకరించబడిన ఆహార తీసుకోవడం మూల్యాంకనం చేయడం...",
    safety_symptoms_title: "లక్షణాలు మరియు భద్రతా నివేదికలు",
    safety_loading_reports: "లక్షణాల నివేదికలను లోడ్ చేస్తోంది...",
    safety_onset: "ప్రారంభం:",
    safety_related_to: "దీనికి సంబంధించి:",
    safety_unknown_med: "తెలియని మందులు"
  },
  ml: {
    safety_interactions_title: "🛡️ മരുന്നുകളും ഭക്ഷണവുമായുള്ള ഇടപെടൽ അലേർട്ടുകൾ",
    safety_evaluating: "വിലയിരുത്തുന്നു...",
    safety_reevaluate: "↻ വീണ്ടും വിലയിരുത്തുക",
    safety_evaluating_desc: "ക്ലിനിക്കൽ വിജ്ഞാന നിയമങ്ങൾക്കെതിരായ സജീവ മരുന്നുകളും സ്ഥിരീകരിച്ച ഭക്ഷണക്രമവും വിലയിരുത്തുന്നു...",
    safety_symptoms_title: "ലക്ഷണങ്ങളും സുരക്ഷാ റിപ്പോർട്ടുകളും",
    safety_loading_reports: "ലക്ഷണ റിപ്പോർട്ടുകൾ ലോഡുചെയ്യുന്നു...",
    safety_onset: "ആരംഭം:",
    safety_related_to: "ബന്ധപ്പെട്ടത്:",
    safety_unknown_med: "അജ്ഞാതമായ മരുന്ന്"
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
