import React, { useState, useEffect } from 'react';
import { FileText, Lock, Scale, FileCheck2 } from 'lucide-react';
import OfertaDocSection from './legal/OfertaDocSection';
import PrivacyPolicySection from './legal/PrivacyPolicySection';
import UserAgreementSection from './legal/UserAgreementSection';
import PersonalDataConsentSection from './legal/PersonalDataConsentSection';

export type LegalDocSectionType = 'oferta' | 'privacy' | 'agreement' | 'consent';

export interface OfertaModalContentProps {
  initialSection?: LegalDocSectionType;
}

const LEGAL_DOC_TABS: Array<{
  id: LegalDocSectionType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'oferta', label: 'Публичная оферта', icon: FileText },
  { id: 'privacy', label: 'Политика конфиденциальности', icon: Lock },
  { id: 'agreement', label: 'Пользовательское соглашение', icon: Scale },
  { id: 'consent', label: 'Согласие на обработку персональных данных', icon: FileCheck2 }
];

export default function OfertaModalContent({ initialSection = 'oferta' }: OfertaModalContentProps) {
  const [activeDoc, setActiveDoc] = useState<LegalDocSectionType>(initialSection);

  useEffect(() => {
    setActiveDoc(initialSection);
  }, [initialSection]);

  return (
    <div className="space-y-5 text-[14px] leading-relaxed text-slate-900 break-words min-w-0">
      {/* Vertical stack on mobile (zero horizontal scroll), 2x2 grid on sm+ */}
      <div className="p-2 rounded-2xl border-2 border-pink-400 bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 backdrop-blur-md grid grid-cols-1 sm:grid-cols-2 gap-2">
        {LEGAL_DOC_TABS.map((tab) => {
          const IconComp = tab.icon;
          const isSelected = activeDoc === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveDoc(tab.id)}
              className={`py-2.5 px-3.5 rounded-xl text-[14px] font-bold transition-all cursor-pointer flex items-center justify-center gap-2 text-center min-w-0 ${
                isSelected
                  ? 'bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white shadow-sm'
                  : 'bg-gradient-to-r from-sky-100/65 via-pink-100/65 via-orange-100/65 via-pink-100/65 to-sky-100/65 text-slate-900 border border-pink-300 hover:opacity-95'
              }`}
            >
              <IconComp className="w-4 h-4 shrink-0" />
              <span className="break-words">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {activeDoc === 'oferta' && <OfertaDocSection />}
      {activeDoc === 'privacy' && <PrivacyPolicySection />}
      {activeDoc === 'agreement' && <UserAgreementSection />}
      {activeDoc === 'consent' && <PersonalDataConsentSection />}
    </div>
  );
}
