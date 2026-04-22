import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  en: {
    translation: {
      "Dashboard": "Dashboard",
      "Financial Entities": "Financial Entities",
      "ICT Providers": "ICT Providers",
      "Contracts": "Contracts",
      "Business Functions": "Business Functions",
      "Risk Analysis": "Risk Analysis",
      "Settings": "Settings",
      "Add Entity": "Add Entity",
      "Search Entity": "Search by name or LEI...",
      "Entity Name": "Entity Name",
      "LEI Code": "LEI Code",
      "Country / Currency": "Country / Currency",
      "Integration Date": "Integration Date",
      "Actions": "Actions",
      "Loading entities": "Loading entities...",
      "No entity found": "No entity found.",
      "Subsidiary": "Subsidiary",
      "Are you sure you want to delete this entity?": "Are you sure you want to delete this entity?",
      "New Financial Entity": "New Financial Entity",
      "Cancel": "Cancel",
      "Create Entity": "Create Entity",
      "Add Provider": "Add Provider",
      "Search Provider": "Search by code or legal name...",
      "ICT Provider": "ICT Provider",
      "Headquarters": "Headquarters",
      "Annual Cost": "Annual Cost",
      "Not specified": "Not specified",
      "Loading providers": "Loading providers...",
      "No ICT provider found": "No ICT provider found.",
      "New ICT Provider": "New ICT Provider",
      "Provider Code": "Provider Code",
      "Legal Name": "Legal Name",
      "Latin Name": "Latin Name",
      "Create Provider": "Create Provider"
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
