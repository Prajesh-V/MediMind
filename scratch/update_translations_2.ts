import fs from 'fs';
import path from 'path';

const localesDir = path.join(process.cwd(), 'src', 'i18n', 'locales');
const files = ['en.json', 'hi.json', 'kn.json', 'ta.json', 'te.json', 'ml.json'];

const additions: Record<string, Record<string, string>> = {
  en: {
    ai_error_msg: "Sorry, the assistant is temporarily unavailable. Please try again.",
    ai_retry: "Retry",
    ai_welcome: "Hi! I can help you understand your medications, doses, food history, and safety information.",
    ai_prompt_1: "What medications am I currently taking?",
    ai_prompt_2: "Have I missed any doses recently?",
    ai_prompt_3: "Are there any food interactions I should know about?",
    ai_placeholder: "Ask a question about your medications or interactions..."
  },
  hi: {
    ai_error_msg: "क्षमा करें, सहायक अस्थायी रूप से उपलब्ध नहीं है। कृपया पुनः प्रयास करें।",
    ai_retry: "पुनः प्रयास करें",
    ai_welcome: "नमस्ते! मैं आपकी दवाओं, खुराकों, भोजन के इतिहास और सुरक्षा जानकारी को समझने में आपकी मदद कर सकता हूं।",
    ai_prompt_1: "मैं वर्तमान में कौन सी दवाएं ले रहा हूं?",
    ai_prompt_2: "क्या मैंने हाल ही में कोई खुराक छोड़ दी है?",
    ai_prompt_3: "क्या कोई खाद्य अंतःक्रियाएं हैं जिनके बारे में मुझे पता होना चाहिए?",
    ai_placeholder: "अपनी दवाओं या अंतःक्रियाओं के बारे में कोई प्रश्न पूछें..."
  },
  kn: {
    ai_error_msg: "ಕ್ಷಮಿಸಿ, ಸಹಾಯಕ ತಾತ್ಕಾಲಿಕವಾಗಿ ಲಭ್ಯವಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
    ai_retry: "ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ",
    ai_welcome: "ನಮಸ್ಕಾರ! ನಿಮ್ಮ ಔಷಧಿಗಳು, ಪ್ರಮಾಣಗಳು, ಆಹಾರದ ಇತಿಹಾಸ ಮತ್ತು ಸುರಕ್ಷತಾ ಮಾಹಿತಿಯನ್ನು ಅರ್ಥಮಾಡಿಕೊಳ್ಳಲು ನಾನು ನಿಮಗೆ ಸಹಾಯ ಮಾಡಬಹುದು.",
    ai_prompt_1: "ನಾನು ಪ್ರಸ್ತುತ ಯಾವ ಔಷಧಿಗಳನ್ನು ತೆಗೆದುಕೊಳ್ಳುತ್ತಿದ್ದೇನೆ?",
    ai_prompt_2: "ನಾನು ಇತ್ತೀಚೆಗೆ ಯಾವುದೇ ಡೋಸ್‌ಗಳನ್ನು ತಪ್ಪಿಸಿಕೊಂಡಿದ್ದೇನೆಯೇ?",
    ai_prompt_3: "ನಾನು ತಿಳಿದುಕೊಳ್ಳಬೇಕಾದ ಯಾವುದೇ ಆಹಾರದ ಪರಸ್ಪರ ಕ್ರಿಯೆಗಳಿವೆಯೇ?",
    ai_placeholder: "ನಿಮ್ಮ ಔಷಧಿಗಳು ಅಥವಾ ಪರಸ್ಪರ ಕ್ರಿಯೆಗಳ ಬಗ್ಗೆ ಪ್ರಶ್ನೆಯನ್ನು ಕೇಳಿ..."
  },
  ta: {
    ai_error_msg: "மன்னிக்கவும், உதவியாளர் தற்காலிகமாக கிடைக்கவில்லை. மீண்டும் முயற்சிக்கவும்.",
    ai_retry: "மீண்டும் முயற்சி செய்",
    ai_welcome: "வணக்கம்! உங்கள் மருந்துகள், அளவுகள், உணவு வரலாறு மற்றும் பாதுகாப்புத் தகவல்களைப் புரிந்துகொள்ள நான் உங்களுக்கு உதவ முடியும்.",
    ai_prompt_1: "நான் தற்போது என்ன மருந்துகளை எடுத்துக்கொள்கிறேன்?",
    ai_prompt_2: "நான் சமீபத்தில் ஏதேனும் மருந்துகளைத் தவறவிட்டேனா?",
    ai_prompt_3: "நான் தெரிந்து கொள்ள வேண்டிய உணவு இடைவினைகள் ஏதேனும் உள்ளதா?",
    ai_placeholder: "உங்கள் மருந்துகள் அல்லது இடைவினைகள் பற்றி ஒரு கேள்வியைக் கேளுங்கள்..."
  },
  te: {
    ai_error_msg: "క్షమించండి, అసిస్టెంట్ తాత్కాలికంగా అందుబాటులో లేరు. దయచేసి మళ్లీ ప్రయత్నించండి.",
    ai_retry: "మళ్లీ ప్రయత్నించండి",
    ai_welcome: "నమస్తే! మీ మందులు, మోతాదులు, ఆహార చరిత్ర మరియు భద్రతా సమాచారాన్ని అర్థం చేసుకోవడంలో నేను మీకు సహాయపడగలను.",
    ai_prompt_1: "నేను ప్రస్తుతం ఏ మందులు తీసుకుంటున్నాను?",
    ai_prompt_2: "నేను ఇటీవల ఏవైనా మోతాదులను వదిలివేసానా?",
    ai_prompt_3: "నేను తెలుసుకోవలసిన ఆహార పరస్పర చర్యలు ఏమైనా ఉన్నాయా?",
    ai_placeholder: "మీ మందులు లేదా పరస్పర చర్యల గురించి ఒక ప్రశ్న అడగండి..."
  },
  ml: {
    ai_error_msg: "ക്ഷമിക്കണം, സഹായി താൽക്കാലികമായി ലഭ്യമല്ല. ദയവായി വീണ്ടും ശ്രമിക്കുക.",
    ai_retry: "വീണ്ടും ശ്രമിക്കുക",
    ai_welcome: "നമസ്കാരം! നിങ്ങളുടെ മരുന്നുകൾ, ഡോസുകൾ, ഭക്ഷണ ചരിത്രം, സുരക്ഷാ വിവരങ്ങൾ എന്നിവ മനസ്സിലാക്കാൻ എനിക്ക് നിങ്ങളെ സഹായിക്കാനാകും.",
    ai_prompt_1: "ഞാൻ ഇപ്പോൾ ഏതെല്ലാം മരുന്നുകളാണ് കഴിക്കുന്നത്?",
    ai_prompt_2: "എനിക്ക് അടുത്തിടെ എന്തെങ്കിലും ഡോസുകൾ നഷ്ടപ്പെട്ടോ?",
    ai_prompt_3: "ഞാൻ അറിഞ്ഞിരിക്കേണ്ട ഭക്ഷണ ഇടപെടലുകൾ എന്തെങ്കിലുമുണ്ടോ?",
    ai_placeholder: "നിങ്ങളുടെ മരുന്നുകളെക്കുറിച്ചോ ഇടപെടലുകളെക്കുറിച്ചോ ഒരു ചോദ്യം ചോദിക്കുക..."
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
