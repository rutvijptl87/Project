import React, { useState } from 'react';
import CreatableSelect from 'react-select/creatable';

export default function CreatableSearchableSelect({ options, value, onChange, placeholder = "Select or type...", disabled = false }) {
  const [inputValue, setInputValue] = useState('');

  // Find the selected option object, or create a custom one if it doesn't match standard options
  let selectedOption = options.find((opt) => opt.value === value) || null;
  if (value && !selectedOption) {
    selectedOption = { label: value, value: value };
  }

  // Custom styles to match the app's dark/light theme input styling
  const customStyles = {
    control: (base, state) => ({
      ...base,
      backgroundColor: 'var(--cc-bg)',
      borderColor: 'var(--cc-border)',
      boxShadow: 'none',
      '&:hover': {
        borderColor: 'var(--cc-accent)',
      },
      minHeight: '38px',
      fontSize: '0.875rem',
      borderRadius: '0.375rem',
    }),
    menu: (base) => ({
      ...base,
      backgroundColor: 'var(--cc-bg)',
      border: '1px solid var(--cc-border)',
      zIndex: 9999,
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isSelected 
        ? 'var(--cc-accent)' 
        : state.isFocused 
          ? 'var(--cc-border)' 
          : 'transparent',
      color: state.isSelected ? 'white' : 'var(--cc-text)',
      cursor: 'pointer',
      fontSize: '0.875rem',
      '&:active': {
        backgroundColor: 'var(--cc-accent)',
      }
    }),
    singleValue: (base) => ({
      ...base,
      color: 'var(--cc-text)',
    }),
    input: (base) => ({
      ...base,
      color: 'var(--cc-text)',
    }),
    placeholder: (base) => ({
      ...base,
      color: 'var(--cc-text-muted)',
    })
  };

  return (
    <CreatableSelect
      value={selectedOption}
      onChange={(opt) => {
        setInputValue('');
        onChange(opt ? opt.value : '');
      }}
      onInputChange={(newInputValue, { action }) => {
        if (action === 'input-change') {
          setInputValue(newInputValue);
        }
      }}
      onBlur={() => {
        if (inputValue && inputValue !== value) {
          onChange(inputValue);
        }
      }}
      options={options}
      styles={customStyles}
      placeholder={placeholder}
      isClearable
      isDisabled={disabled}
      className="react-select-container"
      classNamePrefix="react-select"
      formatCreateLabel={(inputValue) => `Use "${inputValue}"`}
    />
  );
}
