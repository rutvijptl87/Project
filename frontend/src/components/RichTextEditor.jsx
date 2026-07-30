import React, { useRef, useMemo, useEffect, useState } from 'react';
import JoditEditor from 'jodit-react';

const RichTextEditor = ({ value, onChange, disabled, placeholder }) => {
  const editor = useRef(null);
  
  // Track value internally to avoid cursor jumps when external value updates
  // but we still want to trigger onChange to inform parents
  const [internalValue, setInternalValue] = useState(value || '');

  useEffect(() => {
    if (value !== internalValue) {
      setInternalValue(value || '');
    }
    // eslint-disable-next-line
  }, [value]);

  const config = useMemo(() => ({
    readonly: disabled, 
    placeholder: placeholder || 'Start typing...',
    defaultActionOnPaste: 'insert_as_html',
    askBeforePasteHTML: false,
    askBeforePasteFromWord: false,
    height: 300,
    toolbarSticky: false,
    uploader: {
        insertImageAsBase64URI: true
    },
    removeButtons: ['about']
  }), [disabled, placeholder]);

  return (
    <div className={`mt-1 bg-white border border-gray-200 rounded-md overflow-hidden ${disabled ? 'opacity-70 pointer-events-none' : ''} ${internalValue && internalValue !== '<p><br></p>' ? 'hide-jodit-placeholder' : ''}`}>
      <style>{`
        .hide-jodit-placeholder .jodit-wysiwyg::before,
        .hide-jodit-placeholder .jodit-placeholder {
            display: none !important;
        }
      `}</style>
      <JoditEditor
        ref={editor}
        value={internalValue}
        config={config}
        tabIndex={1}
        onBlur={(newContent) => {
          if (newContent !== value) {
            onChange(newContent);
          }
        }}
        onChange={(newContent) => {
          if (newContent !== internalValue) {
             setInternalValue(newContent);
             onChange(newContent);
          }
        }}
      />
    </div>
  );
};

export default RichTextEditor;
