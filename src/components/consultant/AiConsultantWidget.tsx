import React, { useState } from 'react';
import { UserAccount } from '../../types';
import { V2MediaUploadModal, V2MediaAttachment } from '../V2MediaUploadModal';
import { ConsultantSphereButton } from './ConsultantSphereButton';
import { ConsultantDialog } from './ConsultantDialog';
import { useAiConsultant } from './useAiConsultant';

export interface AiConsultantWidgetProps {
  currentPath: string;
  currentUser?: UserAccount | null;
  isLoggedIn?: boolean;
  hasBottomNavbar?: boolean;
}

export const AiConsultantWidget: React.FC<AiConsultantWidgetProps> = ({
  currentPath,
  currentUser,
  isLoggedIn = false,
  hasBottomNavbar = false
}) => {
  const consultant = useAiConsultant({
    currentPath,
    currentUser,
    isLoggedIn
  });

  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);

  // Strictly disable and hide the AI consultant on all Chat pages
  if (consultant.isHiddenOnCurrentRoute) {
    return null;
  }

  const handleMediaAttach = (attachment: V2MediaAttachment) => {
    const collected: string[] = [];
    if (Array.isArray(attachment.urls) && attachment.urls.length > 0) {
      collected.push(...attachment.urls);
    } else if (attachment.url) {
      collected.push(attachment.url);
    } else if (Array.isArray(attachment.files) && attachment.files.length > 0) {
      collected.push(...attachment.files.map((f) => f.url));
    }

    if (collected.length > 0) {
      consultant.addAttachedImages(collected);
    }
    setIsMediaModalOpen(false);
  };

  return (
    <>
      {!consultant.isOpen && (
        <ConsultantSphereButton
          onClick={() => consultant.setIsOpen(true)}
          hasBottomNavbar={hasBottomNavbar}
          isLoading={consultant.isLoading}
        />
      )}

      <ConsultantDialog
        isOpen={consultant.isOpen}
        onClose={() => consultant.setIsOpen(false)}
        messages={consultant.messages}
        inputText={consultant.inputText}
        onChangeInputText={consultant.setInputText}
        attachedImages={consultant.attachedImages}
        onOpenMediaModal={() => setIsMediaModalOpen(true)}
        onRemoveAttachedImage={consultant.removeAttachedImage}
        isLoading={consultant.isLoading}
        loadingStage={consultant.loadingStage}
        errorText={consultant.errorText}
        onSend={consultant.sendMessage}
        onClearHistory={consultant.clearHistory}
      />

      <V2MediaUploadModal
        isOpen={isMediaModalOpen}
        onClose={() => setIsMediaModalOpen(false)}
        onAttach={handleMediaAttach}
        initialType="photo"
      />
    </>
  );
};

export default AiConsultantWidget;
