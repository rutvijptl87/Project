import React from 'react';
import Select from 'react-select';

export default function SearchableSelect({ options, value, onChange, placeholder = "Select...", disabled = false }) {
  // Find the selected option object
  const selectedOption = options.find((opt) => opt.value === value) || null;

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
    <Select
      value={selectedOption}
      onChange={(opt) => onChange(opt ? opt.value : '')}
      options={options}
      styles={customStyles}
      placeholder={placeholder}
      isClearable
      isDisabled={disabled}
      className="react-select-container"
      classNamePrefix="react-select"
    />
  );
}
