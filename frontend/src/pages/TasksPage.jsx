import React from 'react';
import { useNavigate } from 'react-router-dom';
import { HardHat, Calculator, ChevronRight } from 'lucide-react';

const TasksPage = () => {
  const navigate = useNavigate();

  const options = [
    {
      key: 'engineering',
      label: 'Engineering Tasks',
      description: 'Site visits, structural checks, inspections and field work.',
      Icon: HardHat,
      path: '/engineering-tasks',
      accent: '#0A2E1F',
      bg: '#F0FDF4',
      border: '#86EFAC',
    },
    {
      key: 'accounting',
      label: 'Accounting Tasks',
      description: 'Invoices, payments, reconciliations and financial follow-ups.',
      Icon: Calculator,
      path: '/accounting-tasks',
      accent: '#10B981',
      bg: '#ECFDF5',
      border: '#6EE7B7',
    },
  ];

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="tasks-page">
      <div className="min-h-[60vh] flex flex-col justify-center items-center">
        <div className="text-center mb-8">
          <h1 className="font-head text-3xl md:text-4xl font-extrabold mb-2" style={{ color: 'var(--cc-dark-green)' }}>
            Tasks Module
          </h1>
          <p className="text-sm" style={{ color: 'var(--cc-text-muted)' }}>
            Manage and track engineering and accounting tasks.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full">
          {options.map(({ key, label, description, Icon, path }) => (
            <div
              key={key}
              onClick={() => navigate(path)}
              className="card p-8 flex flex-col items-center justify-between cursor-pointer hover:shadow-lg transition-all border hover:border-emerald-500 hover:scale-[1.02] text-center"
              data-testid={`tasks-option-${key}`}
            >
              <div className="p-4 rounded-full bg-emerald-50 text-emerald-600 mb-4">
                <Icon size={36} />
              </div>
              <h2 className="font-head text-xl font-bold mb-2" style={{ color: 'var(--cc-dark-green)' }}>
                {label}
              </h2>
              <p className="text-xs mb-6" style={{ color: 'var(--cc-text-muted)' }}>
                {description}
              </p>
              <button className="btn btn-primary w-full pointer-events-none text-white">
                Open {label}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TasksPage;
