"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Language, dictionaries, DictionaryKey } from "./dictionaries";

interface LanguageContextProps {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: DictionaryKey) => string;
}

const LanguageContext = createContext<LanguageContextProps | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useState<Language>("en");

  // Load saved language on mount
  useEffect(() => {
    const saved = localStorage.getItem("app_lang") as Language;
    if (saved && (saved === "en" || saved === "id")) {
      setLanguage(saved);
    }
  }, []);

  const changeLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem("app_lang", lang);
  };

  const t = (key: DictionaryKey): string => {
    return dictionaries[language][key] || dictionaries["en"][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage: changeLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
