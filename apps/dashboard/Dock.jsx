import React from 'react'

export default function Dock({ currentPage, onNavigate, onOpenAccountSettings, onOpenSalesBot }) {
  return (
    <div className="dock" role="navigation" aria-label="Bottom Dock">
      <div className="dock-icons">
        <button
          className={`dock-icon ${currentPage === 'salesbot' ? 'active' : ''}`}
          onClick={() => onOpenSalesBot && onOpenSalesBot()}
          title="SalesBot"
        >
          🧠
        </button>
        <button
          className="dock-icon"
          onClick={() => onNavigate && onNavigate('/chats')}
          title="Chats"
        >
          💬
        </button>
        <button
          className="dock-icon"
          onClick={() => onNavigate && onNavigate('/onboarding')}
          title="Onboarding"
        >
          🚀
        </button>
        <button
          className="dock-icon"
          onClick={() => onOpenAccountSettings && onOpenAccountSettings()}
          title="Account"
        >
          ⚙️
        </button>
      </div>
    </div>
  )
}


