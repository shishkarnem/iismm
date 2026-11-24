// Utility to calculate exact pixel coordinates of caret/selection in a textarea or input element
// Mirrors styling onto an invisible off-screen DOM element for sub-pixel measurement

export function getTextareaCaretCoordinates(
  element: HTMLTextAreaElement | HTMLInputElement,
  position: number
): { top: number; left: number; lineHeight: number } {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { top: 0, left: 0, lineHeight: 22 };
  }

  const style = window.getComputedStyle(element);
  const div = document.createElement('div');
  div.id = 'mirror-textarea-caret-position-helper';
  document.body.appendChild(div);

  const styleObj = div.style;
  const isInput = element.tagName.toLowerCase() === 'input';

  styleObj.whiteSpace = isInput ? 'nowrap' : 'pre-wrap';
  styleObj.wordBreak = 'break-word';
  styleObj.overflowWrap = 'break-word';
  styleObj.position = 'absolute';
  styleObj.visibility = 'hidden';
  styleObj.top = '0px';
  styleObj.left = '-9999px';

  const props = [
    'direction',
    'boxSizing',
    'borderTopWidth',
    'borderRightWidth',
    'borderBottomWidth',
    'borderLeftWidth',
    'borderStyle',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
    'fontStyle',
    'fontVariant',
    'fontWeight',
    'fontStretch',
    'fontSize',
    'lineHeight',
    'fontFamily',
    'textAlign',
    'textTransform',
    'textIndent',
    'letterSpacing',
    'wordSpacing',
    'tabSize'
  ];

  props.forEach((prop) => {
    (styleObj as any)[prop] = (style as any)[prop];
  });

  styleObj.boxSizing = 'border-box';
  styleObj.width = `${element.clientWidth}px`;

  const value = element.value || '';
  const text = value.substring(0, position);
  div.textContent = text;

  const span = document.createElement('span');
  span.textContent = value.substring(position, position + 1) || '\u200B';
  div.appendChild(span);

  const spanOffsetTop = span.offsetTop;
  const spanOffsetLeft = span.offsetLeft;
  const lineHeight = parseFloat(style.lineHeight) || (parseFloat(style.fontSize) * 1.5) || 22;

  document.body.removeChild(div);

  return {
    top: spanOffsetTop,
    left: spanOffsetLeft,
    lineHeight
  };
}
