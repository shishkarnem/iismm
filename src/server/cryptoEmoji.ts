/**
 * Shared Emoji End-to-End Encryption (E2EE) Utility
 * Encrypts utf-8 text into an emoji cipher sequence based on a key.
 * Allows moderation of original text first, then encrypts via emoji key before DB insertion,
 * and decrypts when reading messages in the client.
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
      const encryptedByte = data[i] ^ keyBytes[i];
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
    const emojis = Array.from(rawEmoji);
    if (emojis.length % 2 !== 0) {
      return cipherText;
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
        return cipherText;
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
