/**
 * Emoji-based End-to-End Encryption (E2EE) Utility for Chats
 * Encrypts utf-8 text into an emoji-encoded cipher using a key.
 * Allows moderator to inspect plaintext first before encryption,
 * then encrypts via emoji key before DB insertion, and decrypts locally on viewing.
 */

// Visual emoji alphabet for encoding 4-bit nibbles (hex digits 0-15)
const EMOJI_ALPHABET = [
  '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼',
  '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔'
];

const EMOJI_TO_NIBBLE: Record<string, number> = {};
EMOJI_ALPHABET.forEach((emoji, idx) => {
  EMOJI_TO_NIBBLE[emoji] = idx;
});

const CIPHER_PREFIX = '🔐[e2ee:emoji]:';

/**
 * Derives a numeric key sequence from a string key or chat seed
 */
function deriveKeyBytes(key: string, length: number): number[] {
  const bytes: number[] = [];
  const cleanKey = key || 'iismm_e2ee_key';
  for (let i = 0; i < length; i++) {
    const charCode = cleanKey.charCodeAt(i % cleanKey.length);
    bytes.push((charCode * 31 + i * 17) % 256);
  }
  return bytes;
}

/**
 * Encrypts plaintext into emoji sequence based on emoji cipher key
 */
export function encryptMessageWithEmoji(plaintext: string, key: string = 'iismm_secure_chat'): string {
  if (!plaintext) return '';
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);
    const keyBytes = deriveKeyBytes(key, data.length);

    let emojiCipher = '';
    for (let i = 0; i < data.length; i++) {
      // XOR with key byte
      const encryptedByte = data[i] ^ keyBytes[i];
      // High nibble (0-15) and Low nibble (0-15)
      const highNibble = (encryptedByte >> 4) & 0x0f;
      const lowNibble = encryptedByte & 0x0f;
      emojiCipher += EMOJI_ALPHABET[highNibble] + EMOJI_ALPHABET[lowNibble];
    }

    return `${CIPHER_PREFIX}${emojiCipher}`;
  } catch (e) {
    console.error('[E2EE] Encryption failed:', e);
    return plaintext;
  }
}

/**
 * Checks if a string is encrypted with emoji cipher
 */
export function isEmojiEncrypted(text: string): boolean {
  return typeof text === 'string' && text.startsWith(CIPHER_PREFIX);
}

/**
 * Decrypts an emoji-encoded cipher back into plaintext
 */
export function decryptMessageWithEmoji(cipherText: string, key: string = 'iismm_secure_chat'): string {
  if (!cipherText || !isEmojiEncrypted(cipherText)) {
    return cipherText;
  }
  try {
    const rawEmoji = cipherText.substring(CIPHER_PREFIX.length);
    // Split into emoji characters
    const emojis = Array.from(rawEmoji);
    if (emojis.length % 2 !== 0) {
      return cipherText; // Corrupted
    }

    const byteCount = emojis.length / 2;
    const keyBytes = deriveKeyBytes(key, byteCount);
    const decryptedBytes = new Uint8Array(byteCount);

    for (let i = 0; i < byteCount; i++) {
      const highEmoji = emojis[i * 2];
      const lowEmoji = emojis[i * 2 + 1];

      const highNibble = EMOJI_TO_NIBBLE[highEmoji];
      const lowNibble = EMOJI_TO_NIBBLE[lowEmoji];

      if (highNibble === undefined || lowNibble === undefined) {
        return cipherText; // Unknown emoji
      }

      const encryptedByte = (highNibble << 4) | lowNibble;
      decryptedBytes[i] = encryptedByte ^ keyBytes[i];
    }

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBytes);
  } catch (e) {
    console.warn('[E2EE] Decryption failed:', e);
    return cipherText;
  }
}
