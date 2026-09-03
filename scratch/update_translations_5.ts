import fs from 'fs';
import path from 'path';

const localesDir = path.join(process.cwd(), 'src', 'i18n', 'locales');
const files = ['en.json', 'hi.json', 'kn.json', 'ta.json', 'te.json', 'ml.json'];

const additions: Record<string, Record<string, string>> = {
  en: {
    symptom_form_title: "Report a Symptom",
    symptom_err_req: "Symptom description and onset time are required.",
    symptom_err_fail: "Failed to submit report",
    symptom_err_unexp: "An unexpected error occurred",
    symptom_label_desc: "Symptom Description",
    symptom_ph_desc: "e.g. Headache, Nausea",
    symptom_label_sev: "Severity",
    symptom_sev_mild: "Mild",
    symptom_sev_mod: "Moderate",
    symptom_sev_sev: "Severe",
    symptom_label_onset: "Onset Time",
    symptom_btn_current_time: "Set to Current Time",
    symptom_label_med: "Related Medication (Optional)",
    symptom_med_none: "None / Not sure",
    symptom_label_notes: "Additional Notes (Optional)",
    symptom_ph_notes: "Any other relevant details...",
    symptom_btn_cancel: "Cancel",
    symptom_btn_submitting: "Submitting...",
    symptom_btn_submit: "Submit Report"
  },
  hi: {
    symptom_form_title: "लक्षण की रिपोर्ट करें",
    symptom_err_req: "लक्षण का विवरण और शुरू होने का समय आवश्यक है।",
    symptom_err_fail: "रिपोर्ट सबमिट करने में विफल",
    symptom_err_unexp: "एक अप्रत्याशित त्रुटि हुई",
    symptom_label_desc: "लक्षण का विवरण",
    symptom_ph_desc: "उदा. सिरदर्द, मतली",
    symptom_label_sev: "गंभीरता",
    symptom_sev_mild: "हल्का",
    symptom_sev_mod: "मध्यम",
    symptom_sev_sev: "गंभीर",
    symptom_label_onset: "शुरू होने का समय",
    symptom_btn_current_time: "वर्तमान समय पर सेट करें",
    symptom_label_med: "संबंधित दवा (वैकल्पिक)",
    symptom_med_none: "कोई नहीं / पक्का नहीं",
    symptom_label_notes: "अतिरिक्त नोट्स (वैकल्पिक)",
    symptom_ph_notes: "कोई अन्य प्रासंगिक विवरण...",
    symptom_btn_cancel: "रद्द करें",
    symptom_btn_submitting: "सबमिट हो रहा है...",
    symptom_btn_submit: "रिपोर्ट सबमिट करें"
  },
  kn: {
    symptom_form_title: "ರೋಗಲಕ್ಷಣವನ್ನು ವರದಿ ಮಾಡಿ",
    symptom_err_req: "ರೋಗಲಕ್ಷಣದ ವಿವರಣೆ ಮತ್ತು ಪ್ರಾರಂಭದ ಸಮಯ ಅಗತ್ಯವಿದೆ.",
    symptom_err_fail: "ವರದಿ ಸಲ್ಲಿಸಲು ವಿಫಲವಾಗಿದೆ",
    symptom_err_unexp: "ಅನಿರೀಕ್ಷಿತ ದೋಷ ಸಂಭವಿಸಿದೆ",
    symptom_label_desc: "ರೋಗಲಕ್ಷಣದ ವಿವರಣೆ",
    symptom_ph_desc: "ಉದಾ. ತಲೆನೋವು, ವಾಕರಿಕೆ",
    symptom_label_sev: "ತೀವ್ರತೆ",
    symptom_sev_mild: "ಸೌಮ್ಯ",
    symptom_sev_mod: "ಮಧ್ಯಮ",
    symptom_sev_sev: "ತೀವ್ರ",
    symptom_label_onset: "ಪ್ರಾರಂಭದ ಸಮಯ",
    symptom_btn_current_time: "ಪ್ರಸ್ತುತ ಸಮಯಕ್ಕೆ ಹೊಂದಿಸಿ",
    symptom_label_med: "ಸಂಬಂಧಿತ ಔಷಧ (ಐಚ್ಛಿಕ)",
    symptom_med_none: "ಯಾವುದೂ ಇಲ್ಲ / ಖಚಿತವಿಲ್ಲ",
    symptom_label_notes: "ಹೆಚ್ಚುವರಿ ಟಿಪ್ಪಣಿಗಳು (ಐಚ್ಛಿಕ)",
    symptom_ph_notes: "ಯಾವುದೇ ಇತರ ಸಂಬಂಧಿತ ವಿವರಗಳು...",
    symptom_btn_cancel: "ರದ್ದುಮಾಡಿ",
    symptom_btn_submitting: "ಸಲ್ಲಿಸಲಾಗುತ್ತಿದೆ...",
    symptom_btn_submit: "ವರದಿ ಸಲ್ಲಿಸಿ"
  },
  ta: {
    symptom_form_title: "அறிகுறியைப் புகாரளிக்கவும்",
    symptom_err_req: "அறிகுறி விளக்கம் மற்றும் தொடக்க நேரம் தேவை.",
    symptom_err_fail: "அறிக்கையைச் சமர்ப்பிக்க முடியவில்லை",
    symptom_err_unexp: "எதிர்பாராத பிழை ஏற்பட்டது",
    symptom_label_desc: "அறிகுறி விளக்கம்",
    symptom_ph_desc: "உதாரணமாக. தலைவலி, குமட்டல்",
    symptom_label_sev: "தீவிரம்",
    symptom_sev_mild: "லேசான",
    symptom_sev_mod: "மிதமான",
    symptom_sev_sev: "கடுமையான",
    symptom_label_onset: "தொடக்க நேரம்",
    symptom_btn_current_time: "தற்போதைய நேரத்திற்கு அமைக்கவும்",
    symptom_label_med: "தொடர்புடைய மருந்து (விரும்பினால்)",
    symptom_med_none: "எதுவும் இல்லை / உறுதியாகத் தெரியவில்லை",
    symptom_label_notes: "கூடுதல் குறிப்புகள் (விரும்பினால்)",
    symptom_ph_notes: "வேறு ஏதேனும் தொடர்புடைய விவரங்கள்...",
    symptom_btn_cancel: "ரத்துசெய்",
    symptom_btn_submitting: "சமர்ப்பிக்கிறது...",
    symptom_btn_submit: "அறிக்கையைச் சமர்ப்பிக்கவும்"
  },
  te: {
    symptom_form_title: "లక్షణాన్ని నివేదించండి",
    symptom_err_req: "లక్షణం వివరణ మరియు ప్రారంభ సమయం అవసరం.",
    symptom_err_fail: "నివేదికను సమర్పించడం విఫలమైంది",
    symptom_err_unexp: "ఊహించని లోపం సంభవించింది",
    symptom_label_desc: "లక్షణం వివరణ",
    symptom_ph_desc: "ఉదాహరణకు. తలనొప్పి, వికారం",
    symptom_label_sev: "తీవ్రత",
    symptom_sev_mild: "తేలికపాటి",
    symptom_sev_mod: "మితమైన",
    symptom_sev_sev: "తీవ్రమైన",
    symptom_label_onset: "ప్రారంభ సమయం",
    symptom_btn_current_time: "ప్రస్తుత సమయానికి సెట్ చేయండి",
    symptom_label_med: "సంబంధిత మందులు (ఐచ్ఛికం)",
    symptom_med_none: "ఏదీ లేదు / ఖచ్చితంగా తెలియదు",
    symptom_label_notes: "అదనపు గమనికలు (ఐచ్ఛికం)",
    symptom_ph_notes: "ఏదైనా ఇతర సంబంధిత వివరాలు...",
    symptom_btn_cancel: "రద్దు చేయి",
    symptom_btn_submitting: "సమర్పిస్తోంది...",
    symptom_btn_submit: "నివేదికను సమర్పించండి"
  },
  ml: {
    symptom_form_title: "ഒരു ലക്ഷണം റിപ്പോർട്ട് ചെയ്യുക",
    symptom_err_req: "ലക്ഷണ വിവരണവും ആരംഭ സമയവും ആവശ്യമാണ്.",
    symptom_err_fail: "റിപ്പോർട്ട് സമർപ്പിക്കുന്നതിൽ പരാജയപ്പെട്ടു",
    symptom_err_unexp: "അപ്രതീക്ഷിതമായ ഒരു പിശക് സംഭവിച്ചു",
    symptom_label_desc: "ലക്ഷണ വിവരണം",
    symptom_ph_desc: "ഉദാ. തലവേദന, ഓക്കാനം",
    symptom_label_sev: "തീവ്രത",
    symptom_sev_mild: "ചെറിയ",
    symptom_sev_mod: "മിതമായ",
    symptom_sev_sev: "കഠിനമായ",
    symptom_label_onset: "ആരംഭ സമയം",
    symptom_btn_current_time: "നിലവിലെ സമയത്തേക്ക് സജ്ജമാക്കുക",
    symptom_label_med: "ബന്ധപ്പെട്ട മരുന്ന് (ഓപ്ഷണൽ)",
    symptom_med_none: "ഒന്നുമില്ല / ഉറപ്പില്ല",
    symptom_label_notes: "കൂടുതൽ കുറിപ്പുകൾ (ഓപ്ഷണൽ)",
    symptom_ph_notes: "മറ്റ് പ്രസക്തമായ വിവരങ്ങൾ...",
    symptom_btn_cancel: "റദ്ദാക്കുക",
    symptom_btn_submitting: "സമർപ്പിക്കുന്നു...",
    symptom_btn_submit: "റിപ്പോർട്ട് സമർപ്പിക്കുക"
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
