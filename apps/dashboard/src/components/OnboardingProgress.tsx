interface OnboardingProgressProps {
  current: 1 | 2 | 3
  labels?: [string, string, string]
}

export default function OnboardingProgress({ current, labels = ['Account', 'Install', 'Alerts'] }: OnboardingProgressProps) {
  const pct = current === 1 ? 17 : current === 2 ? 50 : 83

  return (
    <div className="w-full px-1 mb-6">
      {/* Step label */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-500">Step {current} of 3</span>
        <span className="text-xs font-medium text-[#fe5b25]">{labels[current - 1]}</span>
      </div>
      {/* Bar */}
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #fe5b25, #ff7a50)' }}
        />
      </div>
      {/* Dots */}
      <div className="flex justify-between mt-2">
        {labels.map((label, i) => {
          const step = i + 1
          const done = step < current
          const active = step === current
          return (
            <div key={label} className="flex flex-col items-center gap-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                done ? 'bg-green-500 text-white' :
                active ? 'bg-[#fe5b25] text-white shadow-md shadow-orange-200' :
                'bg-gray-100 text-gray-400'
              }`}>
                {done ? '✓' : step}
              </div>
              <span className={`text-[10px] font-medium ${active ? 'text-gray-900' : 'text-gray-400'}`}>
                {label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
