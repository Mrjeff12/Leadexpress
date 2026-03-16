import React, { useState, useEffect, useRef } from 'react'
import { flushSync } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import Dock from './Dock'
import './Dashboard.css'
import './SalesBot.css'
import './SalesBot-Tabs.css'
import './SalesBot-Chat.css'
import './SalesBot-Dashboard.css'

const SalesBot = ({ onClose }) => {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState('')
  const [currentDate, setCurrentDate] = useState('')
  const [currentPage, setCurrentPage] = useState('salesbot')
  const [activeView, setActiveView] = useState('agents')
  const [activeTab, setActiveTab] = useState('dashboard')
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [showMarketplace, setShowMarketplace] = useState(false)
  const [chatMessages, setChatMessages] = useState([
    {
      type: 'bot',
      content: 'היי! אני כאן לעזור לך במכירות. מה תרצה לדעת על השירותים שלנו?',
      time: '09:15'
    }
  ])
  const [trainingMessages, setTrainingMessages] = useState([
    {
      type: 'bot',
      content: 'היי! אני מעוניין בשירותי המכירות שלכם. מה שעות הפעילות שלכם?',
      time: '09:15'
    }
  ])
  const [trainingQuestions, setTrainingQuestions] = useState([])
  const [editingTrainingIndex, setEditingTrainingIndex] = useState(null)
  const [trainingEditDraft, setTrainingEditDraft] = useState({ question: '', answer: '' })
  const [chatInput, setChatInput] = useState('')
  const [trainingInput, setTrainingInput] = useState('')
  const [showQuestionsBankModal, setShowQuestionsBankModal] = useState(false)
  const [expandedRules, setExpandedRules] = useState(new Set())
  const [isTyping, setIsTyping] = useState(false)

  // Tab icons - inline SVGs using currentColor to inherit styles
  const renderTabIcon = (key) => {
    switch (key) {
      case 'dashboard':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M4 13h4v7H4v-7Zm6-6h4v13h-4V7Zm6 3h4v10h-4V10Z" />
          </svg>
        )
      case 'personality':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-5 0-8 2.5-8 5v1h16v-1c0-2.5-3-5-8-5Z" />
          </svg>
        )
      case 'identity':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-5 0-8 2.5-8 5v1h16v-1c0-2.5-3-5-8-5Z" />
          </svg>
        )
      case 'personality-settings':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M4 4h16v4H4V4Zm0 6h10v10H4V10Zm12 3h4v7h-4v-7Z" />
          </svg>
        )
      case 'rules':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M7 2h8l3 3v15a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm7 1v3h3Zm-6 6h8v2H8Zm0 4h8v2H8Z" />
          </svg>
        )
      case 'workflow':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M7 4a3 3 0 1 1-3 3 3 3 0 0 1 3-3Zm10 0a3 3 0 1 1-3 3 3 3 0 0 1 3-3ZM7 14a3 3 0 1 1-3 3 3 3 0 0 1 3-3Zm8-5h-4v2h4a3 3 0 0 0 3-3h-2a1 1 0 0 1-1 1Zm-6 4h4v2h-4a3 3 0 0 0-3 3h2a1 1 0 0 1 1-1Z" />
          </svg>
        )
      case 'services':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M6 7V6a6 6 0 0 1 12 0v1h2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Zm2-1a4 4 0 0 1 8 0v1H8Zm-2 3h12v12H6Z" />
          </svg>
        )
      case 'business':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M3 3h18v4H3V3Zm2 6h14v12H5V9Zm4 2v2h2v-2H9Zm0 4v2h2v-2H9Zm4-4v2h2v-2h-2Zm0 4v2h2v-2h-2Z" />
          </svg>
        )
      case 'faq':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm0 15a1.25 1.25 0 1 1 1.25-1.25A1.25 1.25 0 0 1 12 17Zm1.75-6.75a2.25 2.25 0 0 0-4.5 0H7.5a4.5 4.5 0 1 1 9 0 3 3 0 0 1-1.5 2.598 2.974 2.974 0 0 0-1.5 2.577V14h-2v-1.5a4.974 4.974 0 0 1 2.5-4.35 1.5 1.5 0 0 0 .75-1.275Z" />
          </svg>
        )
      case 'simulator':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M6 9a5 5 0 0 0-5 5 4 4 0 0 0 4 4h2l2-2h6l2 2h2a4 4 0 0 0 4-4 5 5 0 0 0-5-5ZM8 14H6v-2H4v2H2v2h2v2h2v-2h2Zm8.5 0a1.5 1.5 0 1 1 1.5-1.5A1.5 1.5 0 0 1 16.5 14Zm3 0a1.5 1.5 0 1 1 1.5-1.5A1.5 1.5 0 0 1 19.5 14Z" />
          </svg>
        )
      case 'training':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 3 1 8l11 5 9-4.091V17h2V8ZM5 13.09V18l7 3 7-3v-4.91L12 16Z" />
          </svg>
        )
      case 'products':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M21 8l-9-5-9 5 9 5 9-5Zm-9 7l-9-5v9l9 5 9-5v-9l-9 5Z" />
          </svg>
        )
      case 'brain':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M8 4a3 3 0 0 0-3 3 3 3 0 0 0 .3 1.3A3 3 0 0 0 3 11a3 3 0 0 0 2 2.83V14a3 3 0 0 0 3 3h1v-2H8a1 1 0 0 1-1-1v-1h2V9H8a2 2 0 1 1 0-4Zm8 0a3 3 0 0 1 3 3 3 3 0 0 1-.3 1.3A3 3 0 0 1 21 11a3 3 0 0 1-2 2.83V14a3 3 0 0 1-3 3h-1v-2h1a1 1 0 0 0 1-1v-1h-2V9h2a2 2 0 1 0 0-4Z" />
          </svg>
        )
      default:
        return null
    }
  }

  // Chat simulator helpers
  const messagesEndRef = useRef(null)
  const chatScrollRef = useRef(null)

  // Agent data
  const [agents, setAgents] = useState([
    {
      id: 1,
      name: 'מרקוס תומפסון',
              role: 'סוכן מכירות',
        avatar: '/vite.svg',
        status: 'פעיל',
      gender: 'זכר',
      conversations: 127,
      successRate: '94%',
      revenue: '₪8,650',
      description: 'סוכן מכירות מנוסה המתמחה בפתרונות B2B',
      personality: 'מקצועי',
      rules: [
        { title: 'תמיד קבל לקוחות בחמימות', description: 'התחל כל שיחה עם ברכה ידידותית' },
        { title: 'שאל שאלות מכשירות', description: 'הבן את צרכי הלקוח לפני הצגת פתרונות' }
      ],
      services: [
        { name: 'יצירת לידים', price: '₪299/חודש' },
        { name: 'ייעוץ מכירות', price: '₪199/פגישה' }
      ],
      faq: [
        { question: 'מה שעות הפעילות שלכם?', answer: 'אנחנו זמינים 24/7 לעזור לכם' },
        { question: 'האם אתם מציעים אחריות?', answer: 'כן, אנחנו מציעים אחריות שביעות רצון ל-30 יום' }
      ]
    },
    {
      id: 2,
      name: 'שרה כהן',
              role: 'הצלחת לקוחות',
        avatar: '/vite.svg',
        status: 'פעיל',
      gender: 'נקבה',
      conversations: 89,
      successRate: '97%',
      revenue: '₪12,340',
      description: 'מומחה הצלחת לקוחות המתמקד בשימור לקוחות',
      personality: 'אמפתי',
      rules: [],
      services: [],
      faq: []
    },
    {
      id: 3,
      name: 'דוד מילר',
              role: 'מכשיר לידים',
        avatar: '/vite.svg',
        status: 'פעיל',
      gender: 'זכר',
      conversations: 156,
      successRate: '91%',
      revenue: '₪6,780',
      description: 'מומחה בהכשרה וטיפוח לידים פוטנציאליים',
      personality: 'אנליטי',
      rules: [],
      services: [],
      faq: []
    }
  ])

  const [workflowSteps, setWorkflowSteps] = useState([
    {
      id: 1,
      title: 'יצירת קשר ראשוני',
      description: 'אינטראקציה ראשונה עם לקוח פוטנציאלי',
      status: 'active',
      details: 'ברכה חמה והערכת צרכים',
      goal: 'schedule_call',
      whenToUse: 'כאשר מגיע ליד חדש או לקוח פונה לראשונה דרך אתר/וואטסאפ/פייסבוק.',
      initialReply: 'היי! תודה שפנית אלינו 🙌 אני כאן כדי לעזור. אשמח להבין מה בדיוק מחפשים.',
      collectQuestions: true,
      requiredQuestions: 'מה הצורך המרכזי שלך?\nמה התקציב המשוער?\nמתי תרצה להתחיל?',
      internalInstructions: 'להיות ידידותי וקצר. לא להציע מחיר לפני שמבינים צורך ותקציב.׳',
      humanHandOff: 'auto'
    },
    {
      id: 2,
      title: 'הכשרה',
      description: 'קביעה אם הפרוספקט הוא ליד מוכשר',
      status: 'pending',
      details: 'הערכת תקציב, סמכות, צורך ולוחות זמנים',
      goal: 'schedule_call',
      whenToUse: 'לאחר תשובות ראשוניות שמאפשרות לאמוד התאמה.',
      initialReply: 'תודה! כמה שאלות קצרות כדי לבדוק התאמה ולתאם את הצעד הבא.',
      collectQuestions: true,
      requiredQuestions: 'מי מקבל את ההחלטה?\nמה היעד המרכזי בפרויקט?\nמה לוח הזמנים הרצוי?',
      internalInstructions: 'להוביל לתיאום שיחה קצרה/דמו אם נראה מתאים. לתעד תשובות.',
      humanHandOff: 'auto'
    },
    {
      id: 3,
      title: 'הצגה',
      description: 'הצגת פתרון מותאם לצרכים',
      status: 'pending',
      details: 'הדגמה והצגת הצעה',
      goal: 'purchase_redirect',
      whenToUse: 'אחרי שהוגדר צורך ברור ונקבעה התאמה ראשונית.',
      initialReply: 'נשמע מצוין! אציג בקצרה איך אנחנו פותרים בדיוק את האתגר שלך.',
      collectQuestions: false,
      requiredQuestions: '',
      internalInstructions: 'להתאים מסר לתחום הלקוח. להדגיש תועלות ולא רק פיצ׳רים.',
      humanHandOff: 'never'
    },
    {
      id: 4,
      title: 'סגירה',
      description: 'סיום העסקה והטמעת הלקוח',
      status: 'pending',
      details: 'משא ומתן על חוזה וחתימה',
      goal: 'schedule_call',
      whenToUse: 'לאחר שהלקוח קיבל הצעה/דמו ומביע עניין להתקדם.',
      initialReply: 'מעולה! אעשה לך סדר בצעדים הבאים כדי שנוכל להתחיל לעבוד יחד.',
      collectQuestions: true,
      requiredQuestions: 'מי חותם על ההסכם?\nמה אמצעי התשלום?\nמתי תרצו להתחיל בפועל?',
      internalInstructions: 'לצמצם חיכוך. להציע מסלול התחלה ברור ולשריין זמן הטמעה.',
      humanHandOff: 'auto'
    }
  ])

  const [isMobile, setIsMobile] = useState(false)
  
  // Business information and products
  const [businessInfo, setBusinessInfo] = useState({
    businessName: '',
    address: '',
    phone: '',
    website: '',
    industry: '',
    about: '',
    hours: ''
  })
  const [products, setProducts] = useState([])

  // Check if mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Always keep simulator scrolled to the latest message, inside the messages container only
  useEffect(() => {
    const container = chatScrollRef.current
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
    }
  }, [chatMessages, isTyping])

  // Mobile navigation
  const handleMobileTabClick = (tabKey) => {
    setActiveTab(tabKey)
  }

  const handleMobileBackToHome = () => {
    setActiveTab('dashboard')
  }

  // Bot identity update handlers
  const updateAgentField = (field, value) => {
    if (!selectedAgent) return
    
    const updatedAgent = { ...selectedAgent, [field]: value }
    setSelectedAgent(updatedAgent)
    
    setAgents(prevAgents => 
      prevAgents.map(agent => 
        agent.id === selectedAgent.id 
          ? updatedAgent
          : agent
      )
    )
  }

  const handleNameChange = (e) => {
    updateAgentField('name', e.target.value)
  }

  const handleGenderChange = (gender) => {
    updateAgentField('gender', gender)
  }

  const handlePersonalityChange = (personality) => {
    updateAgentField('personality', personality)
  }

  const handleDescriptionChange = (e) => {
    updateAgentField('description', e.target.value)
  }

  // Update time
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setCurrentTime(now.toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit' 
      }))
      setCurrentDate(now.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }))
    }
    
    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [])

  const handleChatSend = () => {
    if (chatInput.trim()) {
      const time = new Date().toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit' 
      })
      
      const newMessage = {
        type: 'user',
        content: chatInput,
        time: time
      }
      
      setChatMessages(prev => [...prev, newMessage])
      setChatInput('')
      
      // Simulate bot response
      setIsTyping(true)
      setTimeout(() => {
        const botResponses = [
          "That's great! Let me help you with that.",
          "I understand your needs. Here's what I recommend...",
          "Perfect! Let me provide you with more details.",
          "Thank you for that information. Based on what you've told me...",
          "Excellent question! Here's what you need to know..."
        ]
        
        const botResponse = {
          type: 'bot',
          content: botResponses[Math.floor(Math.random() * botResponses.length)],
          time: new Date().toLocaleTimeString('en-US', { 
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit' 
          })
        }
        
        setChatMessages(prev => [...prev, botResponse])
        setIsTyping(false)
      }, 1000 + Math.random() * 2000)
    }
  }

  const handleTrainingSend = () => {
    if (trainingInput.trim()) {
      const time = new Date().toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit' 
      })
      
      const newMessage = {
        type: 'user',
        content: trainingInput,
        time: time
      }
      
      // Temporarily add user message for animation
      setTrainingMessages(prev => [...prev, newMessage])
      
      // Get last bot question for Q&A pair
      const lastBotMessage = trainingMessages.filter(msg => msg.type === 'bot').pop()
      if (lastBotMessage) {
        const newQuestion = {
          question: lastBotMessage.content,
          answer: trainingInput,
          date: new Date().toLocaleDateString('en-GB')
        }
        setTrainingQuestions(prev => [newQuestion, ...prev])
        
        // Trigger animations for mobile
        if (isMobile && activeTab === 'chat') {
          // setShowChatCollection(true) // This state is removed
          // setCollectingPair({ question: lastBotMessage.content, answer: trainingInput }) // This state is removed
          
          // setTimeout(() => { // This state is removed
          //   setShowChatCollection(false) // This state is removed
          //   setCollectingPair(null) // This state is removed
          // }, 3000) // This state is removed
        }
        
        // General animation triggers
        // setNewQuestionId(newQuestion.question + Date.now()) // This state is removed
        // setShowSuccessAnimation(true) // This state is removed
        // setCounterAnimation(true) // This state is removed
        
        // Reset animations
        setTimeout(() => {
          // setShowSuccessAnimation(false) // This state is removed
          // setCounterAnimation(false) // This state is removed
        }, 2000)
        
        // Check for milestones
        const totalQuestions = trainingQuestions.length + 1
        const milestones = [5, 10, 25, 50, 75, 100]
        if (milestones.includes(totalQuestions)) {
          setTimeout(() => {
            // setShowCelebration(true) // This state is removed
            const messages = {
              5: "🎉 חמש שאלות ראשונות!",
              10: "🌟 עשר שאלות מדהימות!",
              25: "🚀 רבע דרך למטרה!",
              50: "💎 חצי דרך להצלחה!",
              75: "🔥 עוד רק 25 שאלות!",
              100: "🏆 מאה שאלות! הישג מדהים!"
            }
            // setCelebrationMessage(messages[totalQuestions]) // This state is removed
          }, 2500)
        }
      }
      
      setTrainingInput('')
      
      // After animations, append a new bot question while preserving history
      setTimeout(() => {
        const botQuestions = [
          "Great! What's the cost for your premium service package?",
          "Perfect! Do you offer any guarantees on your services?",
          "Excellent! What's your cancellation policy?",
          "Thank you! How do I schedule a consultation?",
          "Wonderful! Do you have any customer testimonials?",
          "Amazing! What makes your service different from competitors?",
          "Perfect! How quickly can you deliver results?",
          "Excellent! Do you provide training to our team?",
          "Great! What's included in your support package?",
          "Wonderful! Can you work with our existing systems?"
        ]
        
        const botResponse = {
          type: 'bot',
          content: botQuestions[Math.floor(Math.random() * botQuestions.length)],
          time: new Date().toLocaleTimeString('en-US', { 
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit' 
          })
        }

        // Keep previous messages and append the bot reply
        setTrainingMessages(prev => [...prev, botResponse])
      }, 3000)
    }
  }

  // Add Rule Modal
  const [isAddRuleOpen, setIsAddRuleOpen] = useState(false)
  const [newRuleDescription, setNewRuleDescription] = useState('')
  const openAddRule = () => setIsAddRuleOpen(true)
  const closeAddRule = () => { setIsAddRuleOpen(false); setNewRuleDescription('') }

  const addRule = (agentId) => {
    const description = newRuleDescription.trim()
    if (!description) { closeAddRule(); return }
    setAgents(prev => prev.map(agent => 
      agent.id === agentId 
        ? { ...agent, rules: [...agent.rules, { description }] }
        : agent
    ))
    // Sync selectedAgent
    const agent = agents.find(a => a.id === agentId)
    if (agent && selectedAgent && selectedAgent.id === agentId) {
      setSelectedAgent({ ...agent, rules: [...agent.rules, { description }] })
    }
    closeAddRule()
  }

  const removeRule = (agentId, ruleIndex) => {
    setAgents(prev => prev.map(agent => 
      agent.id === agentId 
        ? { ...agent, rules: agent.rules.filter((_, index) => index !== ruleIndex) }
        : agent
    ))
  }

  // Inline rule editing state and handlers
  const [ruleDrafts, setRuleDrafts] = useState({})

  // Delete rule confirmation modal state
  const [deleteRuleState, setDeleteRuleState] = useState({ open: false, agentId: null, index: null })
  const [rulesSearch, setRulesSearch] = useState('')
  const [expandedWorkflow, setExpandedWorkflow] = useState(new Set())
  const [workflowDrafts, setWorkflowDrafts] = useState({})
  const [deleteWorkflowState, setDeleteWorkflowState] = useState({ open: false, stepId: null })

  // Add Workflow Modal state
  const getDefaultWorkflowDraft = () => ({
    title: '',
    description: '',
    whenToUse: '',
    initialReply: '',
    collectQuestions: false,
    requiredQuestions: '',
    internalInstructions: '',
    humanHandOff: 'auto',
    goal: 'schedule_call'
  })
  const [isAddWorkflowOpen, setIsAddWorkflowOpen] = useState(false)
  const [newWorkflowDraft, setNewWorkflowDraft] = useState(getDefaultWorkflowDraft())
  const openAddWorkflow = () => { setIsAddWorkflowOpen(true) }
  const closeAddWorkflow = () => { setIsAddWorkflowOpen(false); setNewWorkflowDraft(getDefaultWorkflowDraft()) }
  const saveNewWorkflow = () => {
    const draft = newWorkflowDraft
    const newId = Math.max(0, ...workflowSteps.map(s => s.id)) + 1
    const newStep = {
      id: newId,
      title: (draft.title || 'תרחיש חדש').trim(),
      description: (draft.description || '').trim(),
      status: 'pending',
      details: '',
      goal: draft.goal,
      whenToUse: draft.whenToUse,
      initialReply: draft.initialReply,
      collectQuestions: !!draft.collectQuestions,
      requiredQuestions: draft.requiredQuestions,
      internalInstructions: draft.internalInstructions,
      humanHandOff: draft.humanHandOff
    }
    setWorkflowSteps(prev => [...prev, newStep])
    // Expand the newly added item for visibility
    setExpandedWorkflow(prev => { const n = new Set(prev); n.add(newId); return n })
    closeAddWorkflow()
  }
  const openDeleteRule = (agentId, index) => setDeleteRuleState({ open: true, agentId, index })
  const closeDeleteRule = () => setDeleteRuleState({ open: false, agentId: null, index: null })
  const confirmDeleteRule = () => {
    const { agentId, index } = deleteRuleState
    if (agentId == null || index == null) return
    removeRule(agentId, index)
    closeDeleteRule()
  }

  const startEditRule = (ruleIndex, rule) => {
    setRuleDrafts(drafts => ({
      ...drafts,
      [ruleIndex]: { description: rule.description || '' }
    }))
  }

  const updateRuleDraft = (ruleIndex, field, value) => {
    setRuleDrafts(drafts => ({
      ...drafts,
      [ruleIndex]: { ...(drafts[ruleIndex] || {}), [field]: value }
    }))
  }

  const cancelRuleEdit = (ruleIndex) => {
    setRuleDrafts(drafts => {
      const copy = { ...drafts }
      delete copy[ruleIndex]
      return copy
    })
  }

  const saveRuleEdit = (agentId, ruleIndex) => {
    const draft = ruleDrafts[ruleIndex]
    if (!draft) return
    setAgents(prevAgents => prevAgents.map(a => {
      if (a.id !== agentId) return a
      const newRules = a.rules.map((r, i) => (i === ruleIndex ? { ...r, description: draft.description } : r))
      const updatedAgent = { ...a, rules: newRules }
      if (selectedAgent && selectedAgent.id === agentId) {
        setSelectedAgent(updatedAgent)
      }
      return updatedAgent
    }))
    cancelRuleEdit(ruleIndex)
  }

  const addService = (agentId) => {
    const name = prompt('Enter service name:')
    const price = prompt('Enter service price:')
    
    if (name && price) {
      setAgents(prev => prev.map(agent => 
        agent.id === agentId 
          ? { ...agent, services: [...agent.services, { name, price }] }
          : agent
      ))
    }
  }

  // Add Service Modal state and handlers
  const [isAddServiceOpen, setIsAddServiceOpen] = useState(false)
  const [newService, setNewService] = useState({ name: '', description: '', price: '', billing: 'one_time' })
  const openAddService = () => { setNewService({ name: '', description: '', price: '', billing: 'one_time' }); setIsAddServiceOpen(true) }
  const closeAddService = () => { setIsAddServiceOpen(false) }
  const saveNewService = () => {
    const { name, description, price, billing } = newService
    const trimmedName = (name || '').trim()
    const trimmedPrice = (price || '').trim()
    if (!trimmedName || !trimmedPrice) return
    setAgents(prev => prev.map(agent => (
      agent.id === selectedAgent?.id
        ? { ...agent, services: [...agent.services, { name: trimmedName, description: (description||'').trim(), price: trimmedPrice, billing }] }
        : agent
    )))
    setIsAddServiceOpen(false)
  }

  const addProduct = () => {
    const name = prompt('Enter product name:')
    const price = prompt('Enter product price:')
    if (!name || !price) return
    setProducts(prev => [...prev, { name, price }])
  }

  // Add Product Modal state and handlers
  const [isAddProductOpen, setIsAddProductOpen] = useState(false)
  const [newProduct, setNewProduct] = useState({ name: '', description: '', link: '', price: '', type: 'digital' })
  const openAddProduct = () => { setNewProduct({ name: '', description: '', link: '', price: '', type: 'digital' }); setIsAddProductOpen(true) }
  const closeAddProduct = () => { setIsAddProductOpen(false) }
  const saveNewProduct = () => {
    const { name, description, link, price, type } = newProduct
    const trimmedName = (name || '').trim()
    const trimmedPrice = (price || '').trim()
    if (!trimmedName || !trimmedPrice) return
    setProducts(prev => [...prev, { name: trimmedName, description: (description||'').trim(), link: (link||'').trim(), price: trimmedPrice, type }])
    setIsAddProductOpen(false)
  }

  // Display helper: ensure products show ₪ if user did not include it
  const formatPriceWithCurrency = (value) => {
    const raw = (value ?? '').toString().trim()
    if (!raw) return ''
    if (/₪|ש\"ח|ש"ח/.test(raw)) return raw
    return `₪${raw}`
  }

  const removeProduct = (index) => {
    setProducts(prev => prev.filter((_, i) => i !== index))
  }

  // Product edit/delete helpers
  const [deleteProductState, setDeleteProductState] = useState({ open: false, index: null })
  const openDeleteProduct = (index) => setDeleteProductState({ open: true, index })
  const closeDeleteProduct = () => setDeleteProductState({ open: false, index: null })
  const confirmDeleteProduct = () => {
    if (deleteProductState.index == null) return
    removeProduct(deleteProductState.index)
    closeDeleteProduct()
  }

  // Ensure the product delete confirmation modal is visible by scrolling relevant containers to top when it opens
  useEffect(() => {
    if (!deleteProductState.open) return

    const scrollToTop = () => {
      const selectors = [
        '.management-tab-content.active',
        '.agent-management-page',
        '.management-content'
      ]

      let didScroll = false

      selectors.forEach(sel => {
        const el = document.querySelector(sel)
        if (!el) return
        if (typeof el.scrollTo === 'function') {
          try {
            el.scrollTo({ top: 0, behavior: 'smooth' })
            didScroll = true
          } catch (e) {
            el.scrollTop = 0
            didScroll = true
          }
        } else if ('scrollTop' in el) {
          el.scrollTop = 0
          didScroll = true
        }
      })

      if (!didScroll) {
        try {
          window.scrollTo({ top: 0, behavior: 'smooth' })
        } catch (e) {
          window.scrollTo(0, 0)
        }
      }
    }

    // Delay to ensure modal renders before scrolling, and run twice to guarantee reaching the very top
    const id = window.setTimeout(() => {
      scrollToTop()
      window.requestAnimationFrame(scrollToTop)
    }, 0)
    return () => window.clearTimeout(id)
  }, [deleteProductState.open])

  const [isEditProductOpen, setIsEditProductOpen] = useState(false)
  const [editProductIndex, setEditProductIndex] = useState(null)
  const [editProductData, setEditProductData] = useState({ name: '', description: '', link: '', price: '', type: 'digital' })
  const editProduct = (index) => {
    const p = products?.[index]
    if (!p) return
    setEditProductIndex(index)
    setEditProductData({
      name: p.name || '',
      description: p.description || '',
      link: p.link || '',
      price: p.price || '',
      type: p.type || 'digital'
    })
    setIsEditProductOpen(true)
  }
  const closeEditProduct = () => { setIsEditProductOpen(false); setEditProductIndex(null) }
  const saveEditedProduct = () => {
    const { name, description, link, price, type } = editProductData
    const trimmedName = (name || '').trim()
    const trimmedPrice = (price || '').trim()
    if (!trimmedName || !trimmedPrice || editProductIndex == null) return
    setProducts(prev => prev.map((p, i) => i === editProductIndex ? { ...p, name: trimmedName, description: (description||'').trim(), link: (link||'').trim(), price: trimmedPrice, type: type || 'digital' } : p))
    closeEditProduct()
  }

  const removeService = (agentId, serviceIndex) => {
    setAgents(prev => prev.map(agent => 
      agent.id === agentId 
        ? { ...agent, services: agent.services.filter((_, index) => index !== serviceIndex) }
        : agent
    ))
  }

  // Service edit/delete helpers
  const [deleteServiceState, setDeleteServiceState] = useState({ open: false, index: null })
  const openDeleteService = (index) => setDeleteServiceState({ open: true, index })
  const closeDeleteService = () => setDeleteServiceState({ open: false, index: null })
  const confirmDeleteService = () => {
    if (deleteServiceState.index == null || !selectedAgent) return
    removeService(selectedAgent.id, deleteServiceState.index)
    closeDeleteService()
  }

  // Edit Service Modal state and handlers
  const [isEditServiceOpen, setIsEditServiceOpen] = useState(false)
  const [editServiceIndex, setEditServiceIndex] = useState(null)
  const [editServiceData, setEditServiceData] = useState({ name: '', description: '', price: '', billing: 'one_time' })
  const editService = (index) => {
    if (!selectedAgent) return
    const svc = selectedAgent.services?.[index]
    if (!svc) return
    setEditServiceIndex(index)
    setEditServiceData({
      name: svc.name || '',
      description: svc.description || '',
      price: svc.price || '',
      billing: svc.billing || 'one_time'
    })
    setIsEditServiceOpen(true)
  }
  const closeEditService = () => { setIsEditServiceOpen(false); setEditServiceIndex(null) }
  const saveEditedService = () => {
    if (!selectedAgent || editServiceIndex == null) return
    const { name, description, price, billing } = editServiceData
    const trimmedName = (name || '').trim()
    const trimmedPrice = (price || '').trim()
    if (!trimmedName || !trimmedPrice) return
    setAgents(prev => prev.map(agent => {
      if (agent.id !== selectedAgent.id) return agent
      const updated = agent.services.map((s, i) => (
        i === editServiceIndex ? { ...s, name: trimmedName, description: (description||'').trim(), price: trimmedPrice, billing: billing || 'one_time' } : s
      ))
      const updatedAgent = { ...agent, services: updated }
      if (selectedAgent && selectedAgent.id === agent.id) {
        setSelectedAgent(updatedAgent)
      }
      return updatedAgent
    }))
    closeEditService()
  }

  const addFAQ = (agentId) => {
    const question = prompt('Enter FAQ question:')
    const answer = prompt('Enter FAQ answer:')
    
    if (question && answer) {
      setAgents(prev => prev.map(agent => 
        agent.id === agentId 
          ? { ...agent, faq: [...agent.faq, { question, answer }] }
          : agent
      ))
    }
  }

  const removeFAQ = (agentId, faqIndex) => {
    setAgents(prev => prev.map(agent => 
      agent.id === agentId 
        ? { ...agent, faq: agent.faq.filter((_, index) => index !== faqIndex) }
        : agent
    ))
  }

  // FAQ edit/delete helpers
  // Add FAQ modal state and handlers
  const [isAddFAQOpen, setIsAddFAQOpen] = useState(false)
  const [newFAQData, setNewFAQData] = useState({ question: '', answer: '', notes: '' })
  const openAddFAQ = () => { 
    flushSync(() => setActiveTab('faq'))
    setNewFAQData({ question: '', answer: '', notes: '' })
    setIsAddFAQOpen(true) 
  }
  const closeAddFAQ = () => setIsAddFAQOpen(false)
  const saveNewFAQ = () => {
    if (!selectedAgent) return
    const q = (newFAQData.question || '').trim()
    const a = (newFAQData.answer || '').trim()
    const n = (newFAQData.notes || '').trim()
    if (!q || !a) return
    setAgents(prev => prev.map(agent => {
      if (agent.id !== selectedAgent.id) return agent
      const updatedFaq = [ ...(agent.faq || []), { question: q, answer: a, notes: n } ]
      const updatedAgent = { ...agent, faq: updatedFaq }
      if (selectedAgent && selectedAgent.id === agent.id) {
        setSelectedAgent(updatedAgent)
      }
      return updatedAgent
    }))
    closeAddFAQ()
  }

  const [deleteFAQState, setDeleteFAQState] = useState({ open: false, index: null })
  const openDeleteFAQ = (index) => { 
    flushSync(() => setActiveTab('faq'))
    setDeleteFAQState({ open: true, index }) 
  }
  const closeDeleteFAQ = () => setDeleteFAQState({ open: false, index: null })
  const confirmDeleteFAQ = () => {
    if (deleteFAQState.index == null || !selectedAgent) return
    removeFAQ(selectedAgent.id, deleteFAQState.index)
    closeDeleteFAQ()
  }

  const [isEditFAQOpen, setIsEditFAQOpen] = useState(false)
  const [editFAQIndex, setEditFAQIndex] = useState(null)
  const [editFAQData, setEditFAQData] = useState({ question: '', answer: '', notes: '' })
  const editFAQ = (index) => {
    flushSync(() => setActiveTab('faq'))
    const item = selectedAgent?.faq?.[index]
    if (!item) return
    setEditFAQIndex(index)
    setEditFAQData({ question: item.question || '', answer: item.answer || '', notes: item.notes || '' })
    setIsEditFAQOpen(true)
  }
  const closeEditFAQ = () => { setIsEditFAQOpen(false); setEditFAQIndex(null) }
  const saveEditedFAQ = () => {
    if (!selectedAgent || editFAQIndex == null) return
    const { question, answer, notes } = editFAQData
    const q = (question || '').trim()
    const a = (answer || '').trim()
    if (!q || !a) return
    setAgents(prev => prev.map(agent => {
      if (agent.id !== selectedAgent.id) return agent
      const updatedFaq = (agent.faq || []).map((f, i) => i === editFAQIndex ? { question: q, answer: a, notes: (notes || '').trim() } : f)
      const updatedAgent = { ...agent, faq: updatedFaq }
      if (selectedAgent && selectedAgent.id === agent.id) {
        setSelectedAgent(updatedAgent)
      }
      return updatedAgent
    }))
    closeEditFAQ()
  }

  const removeTrainingQuestion = (index) => {
    setTrainingQuestions(prev => prev.filter((_, i) => i !== index))
  }

  const startEditTrainingQA = (index) => {
    setEditingTrainingIndex(index)
    setTrainingEditDraft({
      question: trainingQuestions[index]?.question || '',
      answer: trainingQuestions[index]?.answer || ''
    })
  }

  const saveEditTrainingQA = () => {
    if (editingTrainingIndex === null) return
    setTrainingQuestions(prev => prev.map((qa, i) => (
      i === editingTrainingIndex ? { ...qa, question: trainingEditDraft.question, answer: trainingEditDraft.answer } : qa
    )))
    setEditingTrainingIndex(null)
    setTrainingEditDraft({ question: '', answer: '' })
  }

  const cancelEditTrainingQA = () => {
    setEditingTrainingIndex(null)
    setTrainingEditDraft({ question: '', answer: '' })
  }

  const startNewTrainingSession = () => {
    setTrainingMessages([
      {
        type: 'bot',
        content: 'היי! אני מעוניין בשירותי המכירות שלכם. מה שעות הפעילות שלכם?',
        time: '09:15'
      }
    ])
    setTrainingInput('')
  }

  const handleQuickNavigation = (tabKey) => {
    setSelectedAgent(agents[0])
    setActiveView('management')
    setActiveTab(tabKey)
  }

  const handleBackToMainDashboard = () => {
    // Return to bot list within SalesBot instead of leaving to /dashboard
    setActiveView('agents');
    setSelectedAgent(null);
    setActiveTab('dashboard');
  };

  const handleInternalNavigation = () => {
    setActiveView('agents')
    setSelectedAgent(null)
    setActiveTab('dashboard')
  }

  const handleNavigation = (page) => {
    if (page === 'dashboard') {
      navigate('/dashboard');
    } else if (page === 'chats') {
      navigate('/chats');
    } else if (page === 'salesbot') {
      setCurrentPage('salesbot');
    } else {
      navigate(`/${page}`);
    }
  };

  const handleOpenAccountSettings = () => {
    navigate('/account-settings');
  };

  const handleOpenSalesBot = () => {
    setCurrentPage('salesbot');
  };

  // Mobile-first: brand-new minimal UI for agents list and navigation
  if (isMobile && activeView === 'agents') {
    return (
      <>
        <Dock 
          currentPage={currentPage}
          onNavigate={handleNavigation}
          onOpenAccountSettings={handleOpenAccountSettings}
          onOpenSalesBot={handleOpenSalesBot}
        />

        <div className="sbm-container">
          <header className="sbm-header">
            <div className="sbm-title">My Agents</div>
            <div className="sbm-badge">Active {agents.length}</div>
          </header>

          <div className="sbm-list">
            {agents.map(agent => (
              <div key={agent.id} className="sbm-card" onClick={() => { setSelectedAgent(agent); setActiveView('management'); setActiveTab('dashboard'); }}>
                <div className="sbm-card-status">
                  <span className="sbm-dot" />
                  {agent.status || 'פעיל'}
                </div>
                <div className="sbm-card-main">
                  <div className="sbm-card-info">
                    <div className="sbm-card-name">{agent.name}</div>
                    <div className="sbm-card-role">{agent.role}</div>
                  </div>
                  <img src={agent.avatar} alt={agent.name} className="sbm-card-avatar" />
                </div>
                <div className="sbm-meta">
                  <div className="sbm-chip">שיחות {agent.conversations}</div>
                  <div className="sbm-chip success">{agent.successRate} הצלחה</div>
                </div>
                <button 
                  className="sbm-card-btn"
                  onClick={(e) => { e.stopPropagation(); setSelectedAgent(agent); setActiveView('management'); setActiveTab('dashboard'); }}
                >הגדרות בוט</button>
              </div>
            ))}
          </div>
        </div>
      </>
    )
  }

  const renderAgentsDashboard = () => (
    <div className="agents-content">


      {/* Agents Section */}
      <div className="agents-section">
        <div className="section-header">
          <h3>My Agents</h3>
          <div className="header-actions-group">
            <div className="section-badge active">3 Active</div>
          </div>
        </div>

        {!showMarketplace ? (
          <div className="agents-grid">
            {agents.map(agent => (
              <div key={agent.id} className="agent-card">
                {/* Removed active status icon as requested for bot list */}
                
                <div className="agent-avatar">
                  <img src={agent.avatar} alt={agent.name} />
                </div>
                
                <div className="agent-info">
                  <h4>{agent.name}</h4>
                  <p>{agent.role}</p>
                </div>
                

                
                <div className="agent-actions">
                  <button 
                    className="action-btn primary"
                    onClick={() => {
                      setSelectedAgent(agent)
                      setActiveView('management')
                    }}
                  >
                    הגדרות בוט
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="marketplace-content">
            <div className="marketplace-filters">
              <button className="filter-btn active">All</button>
              <button className="filter-btn">Sales</button>
              <button className="filter-btn">Support</button>
              <button className="filter-btn">Marketing</button>
              <button className="filter-btn">Analytics</button>
            </div>
            
            <div className="marketplace-grid">
              <div className="marketplace-card">
                <div className="agent-avatar">
                  <img src="/vite.svg" alt="Assistant" />
                </div>
                <div className="agent-info">
                  <h4>Personal Assistant</h4>
                  <p>General purpose assistant</p>
                </div>
                <div className="pricing">
                  <span className="price">₪199/month</span>
                  <span className="roi">150% ROI</span>
                </div>
                <button className="add-btn">Add to Team</button>
              </div>
              
              <div className="marketplace-card">
                <div className="agent-avatar">
                  <img src="/vite.svg" alt="Analyst" />
                </div>
                <div className="agent-info">
                  <h4>Data Analyst</h4>
                  <p>Advanced analytics and reporting</p>
                </div>
                <div className="pricing">
                  <span className="price">₪299/month</span>
                  <span className="roi">200% ROI</span>
                </div>
                <button className="add-btn">Add to Team</button>
              </div>
              
              <div className="marketplace-card">
                <div className="agent-avatar">
                  <img src="/vite.svg" alt="Content" />
                </div>
                <div className="agent-info">
                  <h4>Content Creator</h4>
                  <p>Content generation and marketing</p>
                </div>
                <div className="pricing">
                  <span className="price">₪249/month</span>
                  <span className="roi">180% ROI</span>
                </div>
                <button className="add-btn">Add to Team</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  const renderBotMainDashboard = () => (
    <div className="main-sales-dashboard">
      {/* Hero Section with Bot Image */}
      <div className="dashboard-hero">
        <div className="bot-profile-section">
          <div className="bot-main-avatar">
            <img src={selectedAgent?.avatar} alt={selectedAgent?.name} />
            <div className="bot-status-indicator">
              <div className="status-dot active"></div>
              <span>פעיל</span>
            </div>
          </div>
          <div className="bot-main-info">
            <h2>{selectedAgent?.name || 'מרקוס תומפסון'}</h2>
            <p>מנהל אוטומטי של תהליכי מכירות ושירות לקוחות</p>
            
            {/* Bot Identity Details */}
            <div className="bot-identity-details">
              <div className="identity-item">
                <span className="identity-label">שם העובד:</span>
                <span className="identity-value">{selectedAgent?.name || 'מרקוס תומפסון'}</span>
              </div>
              <div className="identity-item">
                <span className="identity-label">מין:</span>
                <span className="identity-value">{selectedAgent?.gender || 'זכר'}</span>
              </div>
              <div className="identity-item">
                <span className="identity-label">סגנון תקשורת:</span>
                <span className="identity-value">{selectedAgent?.personality || 'מקצועי'}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="main-action-buttons">
          <button 
            className="main-action-btn secondary"
            onClick={() => setActiveTab('simulator')}
          >
            <div className="action-icon simulation">
              {renderTabIcon('simulator')}
            </div>
            <div className="action-content">
              <h4>הרץ סימולציה</h4>
              <p>בדוק את הביצועים</p>
            </div>
          </button>
          
          <button 
            className="main-action-btn secondary"
            onClick={() => setActiveTab('training')}
          >
            <div className="action-icon training">
              {renderTabIcon('training')}
            </div>
            <div className="action-content">
              <h4>אמן את הבוט</h4>
              <p>שפר את התשובות</p>
            </div>
          </button>
        </div>
      </div>

      {/* Current Workflow Section */}
      <div className="current-workflow-section">
        <div className="section-header">
          <h3>תרחישים</h3>
          <button 
            className="view-full-btn"
            onClick={() => setActiveTab('workflow')}
          >
            צפה במלא →
          </button>
        </div>
        
        <div className="workflow-preview">
          {workflowSteps.map((step, index) => (
            <React.Fragment key={step.id}>
              <div className={`workflow-step-preview ${step.status}`}>
                <div className="step-number">{index + 1}</div>
                <div className="step-info">
                  <h4>{step.title}</h4>
                  <p>{step.description}</p>
                </div>
                <div className={`step-status ${step.status}`}>
                  {step.status === 'active' ? 'פעיל' : 'ממתין'}
                </div>
              </div>
              {index < workflowSteps.length - 1 && <div className="step-connector"></div>}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* management-navigation removed per request; tab-navigation remains above */}




    </div>
  )

  const renderAgentManagement = () => (
    <div className="agent-management-page">
      {isMobile ? (
        <>


          <div className="management-content">
            {renderTabContent()}
          </div>

          {/* Remove mobile bottom navigation - moved to header */}
        </>
      ) : (
        <>
          <div className="tab-navigation">
            <div className="tab-buttons">
              {[
                { key: 'dashboard', label: 'דאשבורד' },
                { key: 'personality', label: 'פרטי בוט' },
                { key: 'rules', label: 'כללים' },
                { key: 'workflow', label: 'תרחישים' },
                { key: 'services', label: 'מידע עסקי' },
                { key: 'faq', label: 'שאלות ותשובות' },
                { key: 'simulator', label: 'סימולציה' },
                { key: 'training', label: 'אימון בוט' }
              ].map(tab => (
                <button
                  key={tab.key}
                  className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  <span className="tab-icon">{renderTabIcon(tab.key)}</span>
                  <span className="tab-label">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="management-content">
            {renderTabContent()}
          </div>
        </>
      )}
    </div>
  )

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="management-tab-content active">
            {renderBotMainDashboard()}
          </div>
        )

      case 'personality':
        return (
          <div className="management-tab-content active personality-tab">
            <div className="personality-grid">
            <div className="management-card personality-card identity">
              <div className="card-header">
                <h3><span className="card-icon">{renderTabIcon('identity')}</span>זהות הבוט</h3>
                <p className="card-subtitle">קבע שם ותכונות בסיסיות שיופיעו ללקוחות</p>
              </div>
              <div className="identity-preview">
                <div className="identity-avatar">
                  <img src={selectedAgent?.avatar} alt={selectedAgent?.name || 'Agent'} />
                </div>
                <div className="identity-meta">
                  <div className="identity-name">{selectedAgent?.name || 'שם העובד'}</div>
                  <div className="identity-role">{selectedAgent?.role || 'תפקיד הבוט'}</div>
                </div>
              </div>
              
              {/* Bot Identity Section */}
              <div className="form-group">
                <label>שם העובד</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={selectedAgent?.name || ''} 
                  placeholder="שם העובד שיופיע ללקוחות..."
                  onChange={handleNameChange}
                />
                <div className="hint-text">למשל: "שירה, נציגת תמיכה"</div>
              </div>
              
              <div className="form-group">
                <label>מין</label>
                <div className="style-buttons">
                  <button 
                    className={`style-btn ${selectedAgent?.gender === 'זכר' ? 'active' : ''}`}
                    onClick={() => handleGenderChange('זכר')}
                  >
                    זכר
                  </button>
                  <button 
                    className={`style-btn ${selectedAgent?.gender === 'נקבה' ? 'active' : ''}`}
                    onClick={() => handleGenderChange('נקבה')}
                  >
                    נקבה
                  </button>
                </div>
              </div>
              
              <div className="save-actions">
                <button type="button" className="save-btn" onClick={() => {}}>שמור</button>
              </div>

            </div>

            <div className="management-card personality-card settings">
              <div className="card-header">
                <h3><span className="card-icon">{renderTabIcon('personality-settings')}</span>הגדרות אישיות</h3>
                <p className="card-subtitle">התאם את טון הדיבור והסגנון של הבוט</p>
              </div>
              <div className="form-group">
                <label>סגנון תקשורת</label>
                <div className="style-buttons">
                  <button 
                    className={`style-btn ${selectedAgent?.personality === 'מקצועי' ? 'active' : ''}`}
                    onClick={() => handlePersonalityChange('מקצועי')}
                  >
                    מקצועי
                  </button>
                  <button 
                    className={`style-btn ${selectedAgent?.personality === 'ידידותי' ? 'active' : ''}`}
                    onClick={() => handlePersonalityChange('ידידותי')}
                  >
                    ידידותי
                  </button>
                  <button 
                    className={`style-btn ${selectedAgent?.personality === 'רגיל' ? 'active' : ''}`}
                    onClick={() => handlePersonalityChange('רגיל')}
                  >
                    רגיל
                  </button>
                </div>
                <div className="persona-chips">
                  {['משכנע','רגוע','אנרגטי','אמפתי'].map((tone) => (
                    <button
                      key={tone}
                      type="button"
                      className={`style-btn ${selectedAgent?.personality === tone ? 'active' : ''}`}
                      onClick={() => handlePersonalityChange(tone)}
                    >
                      {tone}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="form-group">
                <label>תיאור הבוט</label>
                <textarea 
                  className="form-textarea" 
                  value={selectedAgent?.description || ''} 
                  placeholder="תאר את התמחות הבוט שלך..."
                  onChange={handleDescriptionChange}
                  rows={4}
                />
              </div>
              <div className="save-actions">
                <button type="button" className="save-btn" onClick={() => {}}>שמור</button>
              </div>
            </div>
            </div>
          </div>
        )

      case 'rules':
        return (
          <div className="management-tab-content active">
            <div className="management-card rules-card">
              <div className="rules-header-hero">
                <div className="rules-title">
                  <h3>כללי בוט</h3>
                  <p className="card-subtitle">נהל את החוקים וההתנהגות של הבוט בתרחישים שונים</p>
                </div>
                <div className="rules-stats">
                  <div className="stat-chip">
                    <span className="num">{selectedAgent?.rules?.length || 0}</span>
                    <span className="label">כללים פעילים</span>
                  </div>
                </div>
              </div>

              <div className="rules-toolbar">
                <div className="rule-search">
                  <input
                    type="text"
                    placeholder="חפש כלל לפי תוכן..."
                    value={rulesSearch}
                    onChange={(e) => setRulesSearch(e.target.value)}
                  />
                </div>
                <button 
                  className="add-rule-btn primary"
                  type="button"
                  onClick={() => openAddRule()}
                >
                  + כלל חדש
                </button>
              </div>

              {/* Rules List */}
              <div className="rules-list enhanced">
                {selectedAgent?.rules
                  ?.filter(rule => (rulesSearch ? (rule?.description || '').toLowerCase().includes(rulesSearch.toLowerCase()) : true))
                  .map((rule, index) => (
                  <div key={index} className={`rule-item fancy ${expandedRules.has(index) ? 'expanded' : ''}`}>
                    <div 
                      className="rule-header"
                      onClick={() => toggleRuleExpanded(index)}
                    >
                      <div className="rule-info">
                        <div className="rule-status-indicator"></div>
                        <div className="rule-content">
                          <p className="rule-preview">{rule.description?.substring(0, 120)}...</p>
                        </div>
                      </div>
                      <div className="rule-controls">
                        <button 
                          className="rule-action-btn delete"
                          onClick={(e) => { e.stopPropagation(); openDeleteRule(selectedAgent.id, index) }}
                          title="מחק כלל"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                            <path d="M3 6h18" strokeWidth="1.8" strokeLinecap="round"/>
                            <path d="M8 6V4.5A2.5 2.5 0 0 1 10.5 2h3A2.5 2.5 0 0 1 16 4.5V6" strokeWidth="1.8"/>
                            <path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" strokeWidth="1.8"/>
                            <path d="M10 11v6M14 11v6" strokeWidth="1.8" strokeLinecap="round"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                    
                    {expandedRules.has(index) && (
                      <div className="rule-expanded-content">
                        {ruleDrafts[index] ? (
                          <>
                            <div className="rule-description">
                              <textarea
                                className="rule-description-input"
                                value={ruleDrafts[index].description}
                                onChange={(e) => updateRuleDraft(index, 'description', e.target.value)}
                                placeholder="תיאור הכלל"
                                rows={3}
                              />
                            </div>
                            <div className="rule-expanded-actions">
                              <button className="rule-edit-btn danger" onClick={() => cancelRuleEdit(index)}>בטל</button>
                              <button className="rule-edit-btn primary" onClick={() => saveRuleEdit(selectedAgent.id, index)}>שמור</button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="rule-description">
                              <p>{rule.description}</p>
                            </div>
                            <div className="rule-expanded-actions">
                              <button className="rule-edit-btn primary" onClick={() => startEditRule(index, rule)}>ערוך כלל</button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {/* Empty State */}
                {(!selectedAgent?.rules || selectedAgent.rules.length === 0) && (
                  <div className="rules-empty-state modern">
                  <div className="empty-illustration">{renderTabIcon('brain')}</div>
                    <h3>אין עדיין כללים</h3>
                    <p>צור סט חוקים כדי לחדד את אופן הפעולה והתגובה של הבוט.</p>
                    <button className="add-rule-btn primary" onClick={() => addRule(selectedAgent?.id)}>צור כלל ראשון</button>
                  </div>
                )}
              </div>
            </div>

            {isAddRuleOpen && (
              <div className="add-rule-modal" onClick={closeAddRule}>
                <div className="add-rule-card" onClick={(e) => e.stopPropagation()}>
                  <h3>כלל חדש</h3>
                  <p>הכנס את נוסח הכלל שתרצה להוסיף</p>
                  <textarea
                    className="add-rule-textarea"
                    value={newRuleDescription}
                    onChange={(e) => setNewRuleDescription(e.target.value)}
                    placeholder="לדוגמה: אם הלקוח שואל על מחיר – ספק טווח מחירים והצע שיחה קצרה"
                  />
                  <div className="add-rule-actions">
                    <button className="btn-danger" onClick={closeAddRule}>בטל</button>
                    <button className="btn-primary" onClick={() => addRule(selectedAgent?.id)}>הוסף כלל</button>
                  </div>
                </div>
              </div>
            )}

            {deleteRuleState.open && (
              <div className="confirm-modal" onClick={closeDeleteRule}>
                <div className="confirm-card" onClick={(e) => e.stopPropagation()}>
                  <h3>מחיקת כלל</h3>
                  <p>האם אתה בטוח שברצונך למחוק את הכלל? <br></br> פעולה זו אינה ניתנת לשחזור.</p>
                  <div className="confirm-actions">
                    <button className="btn-danger" onClick={closeDeleteRule}>בטל</button>
                    <button className="btn-primary" onClick={confirmDeleteRule}>מחק</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )

      case 'services':
        return (
          <div className="management-tab-content active">
            <div className="management-grid">
              {/* Business Info Card */}
              <div className="management-card">
                <div className="card-header">
                  <h3><span className="card-icon">{renderTabIcon('business')}</span>מידע עסקי</h3>
                </div>
                <div className="form-group">
                  <label>שם העסק</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="לדוגמה: קליקאי בע״מ"
                    value={businessInfo.businessName}
                    onChange={(e) => setBusinessInfo(prev => ({...prev, businessName: e.target.value}))}
                  />
                </div>
                <div className="form-group">
                  <label>כתובת</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="רחוב, מספר, עיר"
                    value={businessInfo.address}
                    onChange={(e) => setBusinessInfo(prev => ({...prev, address: e.target.value}))}
                  />
                </div>
                <div className="form-group">
                  <label>מספר טלפון</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="לדוגמה: 03-1234567"
                    value={businessInfo.phone}
                    onChange={(e) => setBusinessInfo(prev => ({...prev, phone: e.target.value}))}
                  />
                </div>
                <div className="form-group">
                  <label>אתר</label>
                  <input
                    type="url"
                    className="form-input"
                    placeholder="https://example.com"
                    value={businessInfo.website}
                    onChange={(e) => setBusinessInfo(prev => ({...prev, website: e.target.value}))}
                  />
                </div>
                <div className="form-group">
                  <label>תחום עיסוק</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="לדוגמה: שיווק דיגיטלי"
                    value={businessInfo.industry}
                    onChange={(e) => setBusinessInfo(prev => ({...prev, industry: e.target.value}))}
                  />
                </div>
                <div className="form-group">
                  <label>שעות פעילות</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="א'-ה' 09:00-18:00, ו' 09:00-13:00"
                    value={businessInfo.hours}
                    onChange={(e) => setBusinessInfo(prev => ({...prev, hours: e.target.value}))}
                  />
                </div>
                <div className="form-group">
                  <label>אודות העסק</label>
                  <textarea
                    className="form-textarea"
                    rows={4}
                    placeholder="ספר בקצרה על העסק, המומחיות והיתרונות"
                    value={businessInfo.about}
                    onChange={(e) => setBusinessInfo(prev => ({...prev, about: e.target.value}))}
                  />
                </div>
                <div className="save-actions">
                  <button type="button" className="save-btn" onClick={() => { /* hook to persist businessInfo/products if needed */ }}>
                    שמור
                  </button>
                </div>
              </div>

              {/* Services Card (kept) */}
              <div className="management-card">
                <div className="card-header">
                  <h3><span className="card-icon">{renderTabIcon('services')}</span>שירותים ותמחור</h3>
                  <button className="add-btn" onClick={openAddService}>+ הוסף שירות</button>
                </div>
                <div className="services-container">
                  {selectedAgent?.services?.map((service, index) => (
                    <div key={index} className="service-item" style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'center', gap: 8 }}>
                      <div className="service-name">{service.name}</div>
                      <div className="service-price">{service.price}</div>
                      <div className="rule-controls" style={{ display: 'flex', gap: 8 }}>
                        <button className="rule-action-btn" title="ערוך שירות" onClick={() => editService(index)}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                            <path d="M16.862 3.487a2.07 2.07 0 0 1 2.93 2.93L9.91 16.3 6 17l.7-3.91 10.162-9.603Z" stroke="#64748b" strokeWidth="1.6"/>
                            <path d="M19 13v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6" stroke="#64748b" strokeWidth="1.6"/>
                          </svg>
                        </button>
                        <button className="rule-action-btn delete" title="מחק שירות" onClick={() => openDeleteService(index)}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                            <path d="M3 6h18" strokeWidth="1.8" strokeLinecap="round"/>
                            <path d="M8 6V4.5A2.5 2.5 0 0 1 10.5 2h3A2.5 2.5 0 0 1 16 4.5V6" strokeWidth="1.8"/>
                            <path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" strokeWidth="1.8"/>
                            <path d="M10 11v6M14 11v6" strokeWidth="1.8" strokeLinecap="round"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                  {(!selectedAgent?.services || selectedAgent.services.length === 0) && (
                    <div className="empty-state">
                      <p>עדיין לא הוגדרו שירותים. הוסף את השירות הראשון שלך כדי להתחיל.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Products Card (new) */}
              <div className="management-card">
                <div className="card-header">
                  <h3><span className="card-icon">{renderTabIcon('products')}</span>מוצרים</h3>
                  <button className="add-btn" onClick={openAddProduct}>+ הוסף מוצר</button>
                </div>
                <div className="services-container">
                  {products.map((product, index) => (
                    <div key={index} className="service-item" style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'center', gap: 8 }}>
                      <div className="service-name">{product.name}</div>
                      <div className="service-price">{formatPriceWithCurrency(product.price)}</div>
                      <div className="rule-controls" style={{ display: 'flex', gap: 8 }}>
                        <button className="rule-action-btn" title="ערוך מוצר" onClick={() => editProduct(index)}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                            <path d="M16.862 3.487a2.07 2.07 0 0 1 2.93 2.93L9.91 16.3 6 17l.7-3.91 10.162-9.603Z" stroke="#64748b" strokeWidth="1.6"/>
                            <path d="M19 13v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6" stroke="#64748b" strokeWidth="1.6"/>
                          </svg>
                        </button>
                        <button className="rule-action-btn delete" title="מחק מוצר" onClick={() => openDeleteProduct(index)}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                            <path d="M3 6h18" strokeWidth="1.8" strokeLinecap="round"/>
                            <path d="M8 6V4.5A2.5 2.5 0 0 1 10.5 2h3A2.5 2.5 0 0 1 16 4.5V6" strokeWidth="1.8"/>
                            <path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" strokeWidth="1.8"/>
                            <path d="M10 11v6M14 11v6" strokeWidth="1.8" strokeLinecap="round"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                  {products.length === 0 && (
                    <div className="empty-state">
                      <p>אין מוצרים עדיין. הוסף מוצר ראשון כדי להתחיל.</p>
                    </div>
                  )}
                </div>
              </div>
              {deleteServiceState.open && (
                <div className="confirm-modal" onClick={closeDeleteService}>
                  <div className="confirm-card" onClick={(e) => e.stopPropagation()}>
                    <h3>מחיקת שירות</h3>
                    <p>האם למחוק את השירות? פעולה זו אינה ניתנת לשחזור.</p>
                  <div className="confirm-actions">
                    <button className="btn-primary" onClick={closeDeleteService}>בטל</button>
                    <button className="btn-danger" onClick={confirmDeleteService}>מחק</button>
                  </div>
                  </div>
                </div>
              )}
              {deleteProductState.open && (
                <div className="confirm-modal" onClick={closeDeleteProduct}>
                  <div className="confirm-card" onClick={(e) => e.stopPropagation()}>
                    <h3>מחיקת מוצר</h3>
                    <p>האם למחוק את המוצר? פעולה זו אינה ניתנת לשחזור.</p>
                    <div className="confirm-actions">
                      <button className="btn-primary" onClick={closeDeleteProduct}>בטל</button>
                      <button className="btn-danger" onClick={confirmDeleteProduct}>מחק</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )

      case 'faq':
        return (
          <div className="management-tab-content active">
            <div className="management-card">
              <div className="card-header">
                <h3><span className="card-icon">{renderTabIcon('faq')}</span>מאגר שאלות ותשובות</h3>
                <button 
                  className="add-btn"
                  onClick={(e) => { e.stopPropagation(); openAddFAQ() }}
                >
                  + הוסף שאלה
                </button>
              </div>
              <div className="faq-container">
                {selectedAgent?.faq?.map((item, index) => (
                  <div key={index} className="faq-item">
                    <div className="faq-header" style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 8 }}>
                      <div className="faq-question">ש: {item.question}</div>
                      <div className="rule-controls" style={{ display: 'flex', gap: 8 }}>
                        <button className="rule-action-btn" title="ערוך שאלה" onClick={(e) => { e.stopPropagation(); editFAQ(index) }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                            <path d="M16.862 3.487a2.07 2.07 0 0 1 2.93 2.93L9.91 16.3 6 17l.7-3.91 10.162-9.603Z" stroke="#64748b" strokeWidth="1.6"/>
                            <path d="M19 13v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6" stroke="#64748b" strokeWidth="1.6"/>
                          </svg>
                        </button>
                        <button className="rule-action-btn delete" title="מחק שאלה" onClick={(e) => { e.stopPropagation(); openDeleteFAQ(index) }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                            <path d="M3 6h18" strokeWidth="1.8" strokeLinecap="round"/>
                            <path d="M8 6V4.5A2.5 2.5 0 0 1 10.5 2h3A2.5 2.5 0 0 1 16 4.5V6" strokeWidth="1.8"/>
                            <path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" strokeWidth="1.8"/>
                            <path d="M10 11v6M14 11v6" strokeWidth="1.8" strokeLinecap="round"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className="faq-answer">ת: {item.answer}</div>
                  </div>
                ))}
                {(!selectedAgent?.faq || selectedAgent.faq.length === 0) && (
                  <div className="empty-state">
                    <p>עדיין לא הוגדרו שאלות ותשובות. הוסף את השאלה הראשונה שלך כדי להתחיל.</p>
                  </div>
                )}
              </div>
            </div>
            {isEditFAQOpen && (
              <div className="confirm-modal" onClick={closeEditFAQ}>
                <div className="confirm-card" onClick={(e) => e.stopPropagation()} style={{maxWidth: 600, width: '90%', direction: 'rtl'}}>
                  <h3>עריכת שאלה</h3>
                  <div className="form-group">
                    <label>שאלה</label>
                    <input type="text" className="form-input" placeholder="לדוגמה: מה שעות הפעילות?" value={editFAQData.question} onChange={(e) => setEditFAQData(prev => ({...prev, question: e.target.value}))} />
                  </div>
                  <div className="form-group">
                    <label>תשובה</label>
                    <textarea className="form-input" rows="4" placeholder="לדוגמה: אנו זמינים בימים א'-ה' בין 9:00-18:00" value={editFAQData.answer} onChange={(e) => setEditFAQData(prev => ({...prev, answer: e.target.value}))} />
                  </div>
                  <div className="form-group">
                    <label>הערות לבוט (לא מוצג ללקוח) — לא חובה</label>
                    <textarea className="form-input" rows="3" placeholder="הנחיות פנימיות לבוט לגבי מתי להשתמש בתשובה הזו" value={editFAQData.notes} onChange={(e) => setEditFAQData(prev => ({...prev, notes: e.target.value}))} />
                  </div>
                  <div className="confirm-actions">
                    <button className="btn-danger" onClick={closeEditFAQ}>בטל</button>
                    <button className="btn-primary" onClick={saveEditedFAQ}>שמור</button>
                  </div>
                </div>
              </div>
            )}
            {isAddFAQOpen && (
              <div className="confirm-modal" onClick={closeAddFAQ}>
                <div className="confirm-card" onClick={(e) => e.stopPropagation()} style={{maxWidth: 600, width: '90%', direction: 'rtl'}}>
                  <h3>הוסף שאלה</h3>
                  <div className="form-group">
                    <label>שאלה</label>
                    <input type="text" className="form-input" placeholder="לדוגמה: מה שעות הפעילות?" value={newFAQData.question} onChange={(e) => setNewFAQData(prev => ({...prev, question: e.target.value}))} />
                  </div>
                  <div className="form-group">
                    <label>תשובה</label>
                    <textarea className="form-input" rows="4" placeholder="לדוגמה: אנו זמינים בימים א'-ה' בין 9:00-18:00" value={newFAQData.answer} onChange={(e) => setNewFAQData(prev => ({...prev, answer: e.target.value}))} />
                  </div>
                  <div className="form-group">
                    <label>הערות לבוט (לא מוצג ללקוח) — לא חובה</label>
                    <textarea className="form-input" rows="3" placeholder="הנחיות פנימיות לבוט לגבי מתי להשתמש בתשובה הזו" value={newFAQData.notes} onChange={(e) => setNewFAQData(prev => ({...prev, notes: e.target.value}))} />
                  </div>
                  <div className="confirm-actions">
                    <button className="btn-danger" onClick={closeAddFAQ}>בטל</button>
                    <button className="btn-primary" onClick={saveNewFAQ}>שמור</button>
                  </div>
                </div>
              </div>
            )}
            {deleteFAQState.open && (
              <div className="confirm-modal" onClick={closeDeleteFAQ}>
                <div className="confirm-card" onClick={(e) => e.stopPropagation()}>
                  <h3>מחיקת שאלה</h3>
                  <p>האם למחוק את השאלה? פעולה זו אינה ניתנת לשחזור.</p>
                  <div className="confirm-actions">
                    <button className="btn-primary" onClick={closeDeleteFAQ}>בטל</button>
                    <button className="btn-danger" onClick={confirmDeleteFAQ}>מחק</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )

      case 'simulator':
        return (
          <div className="management-tab-content active simulator-tab">
            <div className="chat-simulator">
              {/* Chat Header */}
              <div className="chat-header">
                <div className="bot-avatar">
                  <img src={selectedAgent?.avatar || '/vite.svg'} alt={selectedAgent?.name || 'bot'} />
                </div>
                <div className="bot-info">
                  <h4>{selectedAgent?.name || 'בוט הסימולציה - הדרכה חכמה'}</h4>
                  <div className="status-line"><span className="status-dot"></span>מקוון</div>
                </div>
              </div>

              {/* Chat Messages */}
              <div className="chat-messages" ref={chatScrollRef}>
                {chatMessages.map((m, i) => (
                  <div key={i} className={`message ${m.type === 'user' ? 'owner' : 'customer'}`}>
                    <div className="message-avatar">
                      <img
                        src={m.type === 'user' ? '/vite.svg' : (selectedAgent?.avatar || '/vite.svg')}
                        alt={m.type === 'user' ? 'you' : (selectedAgent?.name || 'bot')}
                      />
                    </div>
                    <div className="message-bubble">
                      <div className="message-text">{m.content}</div>
                      <div className="message-time">{m.time}</div>
                    </div>
                  </div>
                ))}

                {isTyping && (
                  <div className="message customer">
                    <div className="message-avatar">
                      <img src={selectedAgent?.avatar || '/vite.svg'} alt={selectedAgent?.name || 'bot'} />
                    </div>
                    <div className="message-bubble">
                      <div className="typing-indicator"><span></span><span></span><span></span></div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input */}
              <div className="chat-input-container">
                <div className="chat-input-wrapper">
                  <input
                    type="text"
                    className="chat-input"
                    placeholder="שלח הודעה לבוט..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleChatSend()}
                  />
                  <button
                    className="chat-send-btn"
                    onClick={handleChatSend}
                    disabled={!chatInput.trim()}
                    title="שלח"
                  >
                    ➤
                  </button>
                </div>
              </div>
            </div>
          </div>
        )

      case 'training':
        return (
          <div className="management-tab-content active">
            <div className="training-layout">
              <div className="training-chat">
                {!isMobile && (
                  <div className="training-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div className="bot-avatar">
                        <img src={selectedAgent?.avatar} alt={selectedAgent?.name} />
                      </div>
                      <div className="bot-info">
                        <h4 style={{ margin: 0 }}>{selectedAgent?.name} — מצב אימון</h4>
                        <div className="status-indicator" title="פעיל"></div>
                      </div>
                    </div>
                    <button
                      className="new-session-btn"
                      onClick={startNewTrainingSession}
                    >
                      סשן חדש
                    </button>
                  </div>
                )}

                <div className="chat-simulator">

                  
                  <div className="chat-messages training-messages">
                    {trainingMessages.map((message, index) => (
                      <div
                        key={index}
                        className={`message training-message ${message.type} ${message.type === 'bot' ? 'bot-training' : 'user-training'}`}
                      >
                        {message.type === 'bot' && (
                          <div className="bot-avatar-message-training">
                            <img src={selectedAgent?.avatar || '/vite.svg'} alt={selectedAgent?.name || 'bot'} />
                          </div>
                        )}
                        <div className="message-content-training">{message.content}</div>
                      </div>
                    ))}
                  </div>

                  <div className="chat-input-container">
                    <input
                      type="text"
                      className="chat-input"
                      placeholder="הגב כדי לאמן את הבוט..."
                      value={trainingInput}
                      onChange={(e) => setTrainingInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleTrainingSend()}
                    />
                    <button className="send-btn" onClick={handleTrainingSend}>
                      ➤
                    </button>
                  </div>
                </div>
              </div>

              <aside className="questions-bank">
                <div className="bank-header">
                  <div className="bank-title">
                    <div className="bank-icon">🏦</div>
                    <div className="bank-details">
                      <h4>בנק שאלות</h4>
                      <p>שאלות ותשובות שנאספו מהשיחה</p>
                    </div>
                  </div>
                  <div className="bank-actions">
                    <div className="question-counter">{trainingQuestions.length} שאלות</div>
                    <button className="upload-btn">📤 העלה</button>
                  </div>
                </div>
                <div className="questions-list">
                  {trainingQuestions.map((item, index) => (
                    <div key={index} className="question-item">
                      <div className="question-header">
                        <div className="question-label">
                          <span className="q-icon">Q</span>
                          <span>שאלה</span>
                        </div>
                        <button
                          className="remove-question-btn"
                          onClick={() => removeTrainingQuestion(index)}
                        >
                          ×
                        </button>
                      </div>
                      {editingTrainingIndex === index ? (
                        <input
                          className="form-input"
                          value={trainingEditDraft.question}
                          onChange={(e) => setTrainingEditDraft(d => ({ ...d, question: e.target.value }))}
                        />
                      ) : (
                        <div className="question-text">{item.question}</div>
                      )}
                      <div className="answer-section">
                        <div className="answer-label">
                          <span className="a-icon">A</span>
                          <span>תשובה</span>
                        </div>
                        {editingTrainingIndex === index ? (
                          <textarea
                            className="form-textarea"
                            rows={3}
                            value={trainingEditDraft.answer}
                            onChange={(e) => setTrainingEditDraft(d => ({ ...d, answer: e.target.value }))}
                          />
                        ) : (
                          <div className="answer-text">{item.answer}</div>
                        )}
                      </div>
                      <div className="question-date">{item.date}</div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        {editingTrainingIndex === index ? (
                          <>
                            <button className="btn-primary" onClick={saveEditTrainingQA}>שמור</button>
                            <button className="btn-neutral" onClick={cancelEditTrainingQA}>בטל</button>
                          </>
                        ) : (
                          <button className="btn-primary" onClick={() => startEditTrainingQA(index)}>ערוך</button>
                        )}
                      </div>
                    </div>
                  ))}
                  {trainingQuestions.length === 0 && (
                    <div className="empty-state">
                      <p>אין עדיין נתוני אימון. התחל שיחה כדי לאסוף זוגות שאלות ותשובות.</p>
                    </div>
                  )}
                </div>
              </aside>

              {showQuestionsBankModal && (
                <div className={`questions-bank-modal ${showQuestionsBankModal ? 'active' : ''}`}>
                  <div className="questions-bank-content">
                    <div className="modal-header">
                      <h3 className="modal-title">בנק שאלות</h3>
                      <button
                        className="modal-close-btn"
                        onClick={() => setShowQuestionsBankModal(false)}
                      >
                        ×
                      </button>
                    </div>
                    <div className="modal-questions-list">
                      <div className="bank-actions" style={{ marginBottom: '16px' }}>
                        <div className="question-counter">{trainingQuestions.length} שאלות נאספו</div>
                        <button className="upload-btn">📤 העלה</button>
                      </div>
                      {trainingQuestions.map((item, index) => (
                        <div key={index} className="question-item">
                          <div className="question-header">
                            <div className="question-label">
                              <span className="q-icon">Q</span>
                              <span>שאלה</span>
                            </div>
                            <button
                              className="remove-question-btn"
                              onClick={() => removeTrainingQuestion(index)}
                            >
                              ×
                            </button>
                          </div>
                          <div className="question-text">{item.question}</div>
                          <div className="answer-section">
                            <div className="answer-label">
                              <span className="a-icon">A</span>
                              <span>תשובה</span>
                            </div>
                        {editingTrainingIndex === index ? (
                          <textarea
                            className="form-textarea"
                            rows={3}
                            value={trainingEditDraft.answer}
                            onChange={(e) => setTrainingEditDraft(d => ({ ...d, answer: e.target.value }))}
                          />
                        ) : (
                          <div className="answer-text">{item.answer}</div>
                        )}
                          </div>
                      <div className="question-date">{item.date}</div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        {editingTrainingIndex === index ? (
                          <>
                            <button className="btn-primary" onClick={saveEditTrainingQA}>שמור</button>
                            <button className="btn-neutral" onClick={cancelEditTrainingQA}>בטל</button>
                          </>
                        ) : (
                          <button className="btn-primary" onClick={() => startEditTrainingQA(index)}>ערוך</button>
                        )}
                      </div>
                        </div>
                      ))}
                      {trainingQuestions.length === 0 && (
                        <div className="empty-state">
                          <p>אין עדיין נתוני אימון. התחל שיחה כדי לאסוף זוגות שאלות ותשובות.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )

      case 'workflow':
        return (
          <div className="management-tab-content active">
            <div className="workflow-container">
              {deleteWorkflowState?.open && (
                <div className="confirm-modal" onClick={() => setDeleteWorkflowState({ open: false, stepId: null })}>
                  <div className="confirm-card" onClick={(e) => e.stopPropagation()}>
                    <h3>מחיקת תרחיש</h3>
                    <p>האם אתה בטוח שברצונך למחוק את התרחיש? <br></br> פעולה זו אינה ניתנת לשחזור.</p>
                    <div className="confirm-actions">
                      <button className="btn-primary" onClick={() => setDeleteWorkflowState({ open: false, stepId: null })}>בטל</button>
                      <button className="btn-danger" onClick={() => {
                        setWorkflowSteps(prev => prev.filter(s => s.id !== deleteWorkflowState.stepId))
                        setDeleteWorkflowState({ open: false, stepId: null })
                      }}>מחק</button>
                    </div>
                  </div>
                </div>
              )}
              <div className="workflow-header">
                <h3>תרחישים</h3>
                <button className="add-btn" onClick={openAddWorkflow}>+ הוסף תרחיש</button>
              </div>
              
              <div className="workflow-steps">
                {workflowSteps.map((step, index) => (
                  <div key={step.id} className={`workflow-step-item ${expandedWorkflow.has(step.id) ? 'expanded' : ''}`} onClick={() => {
                    setExpandedWorkflow(prev => {
                      const next = new Set(prev)
                      if (next.has(step.id)) next.delete(step.id); else next.add(step.id)
                      return next
                    })
                  }}>
                    <div className="step-header">
                      <div className="step-number">{index + 1}</div>
                      <div className="step-info">
                        <h4>{step.title}</h4>
                        <p>{step.description}</p>
                      </div>
                      <button className="rule-action-btn delete" title="מחק תרחיש" onClick={(e) => { e.stopPropagation(); setDeleteWorkflowState({ open: true, stepId: step.id }) }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                          <path d="M3 6h18" strokeWidth="1.8" strokeLinecap="round"/>
                          <path d="M8 6V4.5A2.5 2.5 0 0 1 10.5 2h3A2.5 2.5 0 0 1 16 4.5V6" strokeWidth="1.8"/>
                          <path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" strokeWidth="1.8"/>
                          <path d="M10 11v6M14 11v6" strokeWidth="1.8" strokeLinecap="round"/>
                        </svg>
                      </button>
                    </div>
                    {expandedWorkflow.has(step.id) && (
                      <div className={`step-details-content ${expandedWorkflow.has(step.id) ? 'expanded' : ''}`} onClick={e => e.stopPropagation()}>
                        
                        <div className="form-group">
                          <label>מתי להשתמש בתרחיש</label>
                          <textarea
                            className="form-textarea"
                            value={workflowDrafts[step.id]?.whenToUse ?? step.whenToUse ?? ''}
                            onChange={(e) => setWorkflowDrafts(prev => ({
                              ...prev,
                              [step.id]: { ...(prev[step.id] || {}), whenToUse: e.target.value }
                            }))}
                            rows={3}
                          />
                        </div>
                        <div className="form-group">
                          <label>התגובה הראשונית של הבוט</label>
                          <textarea
                            className="form-textarea"
                            value={workflowDrafts[step.id]?.initialReply ?? step.initialReply ?? ''}
                            onChange={(e) => setWorkflowDrafts(prev => ({
                              ...prev,
                              [step.id]: { ...(prev[step.id] || {}), initialReply: e.target.value }
                            }))}
                            rows={3}
                          />
                        </div>
                        <div className="form-group">
                          <label>
                            <input
                              type="checkbox"
                              checked={workflowDrafts[step.id]?.collectQuestions ?? step.collectQuestions ?? false}
                              onChange={(e) => setWorkflowDrafts(prev => ({
                                ...prev,
                                [step.id]: { ...(prev[step.id] || {}), collectQuestions: e.target.checked }
                              }))}
                            />
                            <span style={{ marginRight: 8 }}>האם יש שאלות לאסוף</span>
                          </label>
                        </div>
                        {(workflowDrafts[step.id]?.collectQuestions ?? step.collectQuestions ?? false) && (
                          <div className="form-group">
                            <label>שאלות שהבוט חייב לשאול</label>
                            <textarea
                              className="form-textarea"
                              value={workflowDrafts[step.id]?.requiredQuestions ?? step.requiredQuestions ?? ''}
                              onChange={(e) => setWorkflowDrafts(prev => ({
                                ...prev,
                                [step.id]: { ...(prev[step.id] || {}), requiredQuestions: e.target.value }
                              }))}
                              rows={3}
                            />
                          </div>
                        )}
                        <div className="form-group">
                          <label>הוראות פנימיות לבוט</label>
                          <textarea
                            className="form-textarea"
                            value={workflowDrafts[step.id]?.internalInstructions ?? step.internalInstructions ?? ''}
                            onChange={(e) => setWorkflowDrafts(prev => ({
                              ...prev,
                              [step.id]: { ...(prev[step.id] || {}), internalInstructions: e.target.value }
                            }))}
                            rows={3}
                          />
                        </div>
                        <div className="form-group">
                          <label className="goal-title">פעולה רצויה בסוף</label>
                          <div className="goal-buttons" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'stretch' }}>
                            {(() => { const selectedGoal = (workflowDrafts[step.id]?.goal ?? step.goal ?? 'schedule_call'); return (
                              <>
                                <button
                                  type="button"
                                  className={`goal-btn ${selectedGoal === 'schedule_call' ? 'active' : ''}`}
                                  onClick={() => setWorkflowDrafts(prev => ({
                                    ...prev,
                                    [step.id]: { ...(prev[step.id] || {}), goal: 'schedule_call' }
                                  }))}
                                >
                                  תיאום שיחה 📞
                                </button>
                                <button
                                  type="button"
                                  className={`goal-btn ${selectedGoal === 'purchase_redirect' ? 'active' : ''}`}
                                  onClick={() => setWorkflowDrafts(prev => ({
                                    ...prev,
                                    [step.id]: { ...(prev[step.id] || {}), goal: 'purchase_redirect' }
                                  }))}
                                >
                                  הפניה לרכישה באתר 🛒
                                </button>
                              </>
                            ) })()}
                          </div>
                        </div>
                        <div className="form-group">
                          <label>מעורבות נציג אנושי</label>
                          {(() => { const isHumanBackup = ((workflowDrafts[step.id]?.humanHandOff ?? step.humanHandOff ?? 'auto') !== 'never'); return (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 12,
                                padding: '10px 12px',
                                backgroundColor: isHumanBackup ? '#f0f8f0' : '#f8f9fa',
                                border: isHumanBackup ? '1px solid #34C759' : '1px solid #e0e0e0',
                                borderRadius: 8,
                                transition: 'all 0.2s ease'
                              }}
                            >
                              <div style={{ flex: 1 }}>
                                <div style={{
                                  fontSize: 14,
                                  fontWeight: 600,
                                  color: '#333',
                                  marginBottom: 2,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6
                                }}>
                                  <span role="img" aria-label="sos">🆘</span>
                                  תערב אותי אם מסתבך
                                </div>
                                <div style={{ fontSize: 12, color: '#666', lineHeight: 1.3 }}>
                                  הבוט יפנה אליך במצבים מורכבים
                                </div>
                              </div>
                              <button
                                type="button"
                                aria-pressed={isHumanBackup}
                                onClick={() => setWorkflowDrafts(prev => ({
                                  ...prev,
                                  [step.id]: { ...(prev[step.id] || {}), humanHandOff: isHumanBackup ? 'never' : 'auto' }
                                }))}
                                style={{
                                  width: 42,
                                  height: 24,
                                  borderRadius: 12,
                                  border: 'none',
                                  backgroundColor: isHumanBackup ? '#34C759' : '#ccc',
                                  position: 'relative',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease',
                                  flexShrink: 0
                                }}
                              >
                                <span
                                  style={{
                                    position: 'absolute',
                                    top: 3,
                                    left: isHumanBackup ? 22 : 3,
                                    width: 18,
                                    height: 18,
                                    borderRadius: '50%',
                                    background: '#fff',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                                    transition: 'left 0.2s ease'
                                  }}
                                />
                              </button>
                            </div>
                          ) })()}
                        </div>

                        <div className="rule-expanded-actions">
                          <button className="rule-edit-btn danger" onClick={() => setExpandedWorkflow(prev => { const n = new Set(prev); n.delete(step.id); return n })}>בטל</button>
                          <button className="rule-edit-btn primary" onClick={() => {
                            const draft = workflowDrafts[step.id]
                            if (!draft) { setExpandedWorkflow(prev => { const n = new Set(prev); n.delete(step.id); return n }); return }
                            setWorkflowSteps(prev => prev.map(s => s.id === step.id ? { ...s, ...draft } : s))
                            setExpandedWorkflow(prev => { const n = new Set(prev); n.delete(step.id); return n })
                          }}>שמור</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  const renderMobileDashboard = () => (
    <div className="mobile-dashboard-container">
      <div className="mobile-agent-header">
        <img 
          src={selectedAgent?.avatar} 
          alt={selectedAgent?.name}
          className="mobile-agent-avatar"
        />
        <div className="mobile-agent-info">
          <h1>{selectedAgent?.name}</h1>
          <div className="subtitle">{selectedAgent?.role}</div>
          {/* Removed active status indicator from header per request */}
        </div>
        <button 
          className="mobile-back-btn"
          onClick={handleBackToMainDashboard}
          title="חזרה לרשימת הבוטים"
          aria-label="חזרה"
        >
          →
        </button>
      </div>


      <div className="mobile-tab-grid">
        {[
          { key: 'dashboard', label: 'סקירה כללית', desc: 'נתונים ומטריקות' },
          { key: 'rules', label: 'כללי בוט', desc: 'הגדרות והנחיות' },
          { key: 'workflow', label: 'זרימת עבודה', desc: 'תהליכי מכירה' },
          { key: 'training', label: 'אימון בוט', desc: 'שיפור ולמידה' },
          { key: 'simulator', label: 'סימולציה', desc: 'בדיקת שיחות' },
          { key: 'personality', label: 'אישיות בוט', desc: 'טון ואופי' },
          { key: 'services', label: 'מידע עסקי', desc: 'מוצרים ושירותים' },
          { key: 'faq', label: 'שאלות ותשובות', desc: 'תשובות מוכנות' }
        ].map(tab => (
          <button
            key={tab.key}
            className="mobile-tab-btn"
            onClick={() => setActiveTab(tab.key)}
          >
            <div className="tab-info">
              <div className="tab-title">{tab.label}</div>
              <div className="tab-description">{tab.desc}</div>
            </div>
            <div className="mobile-icon-wrapper">
              <div className="mobile-tab-icon">{renderTabIcon(tab.key)}</div>
              <div className="mobile-play-button"></div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )



  const toggleRuleExpanded = (ruleIndex) => {
    setExpandedRules(prev => {
      const newExpanded = new Set(prev)
      if (newExpanded.has(ruleIndex)) {
        newExpanded.delete(ruleIndex)
      } else {
        newExpanded.add(ruleIndex)
      }
      return newExpanded
    })
  }

  

  return (
    <>
      {/* רקע לכל הדף */}
      <div style={{
        position: 'fixed',
        top: '20px',
        left: '20px',
        width: 'calc(100vw - 40px)',
        height: 'calc(100vh - 40px)',
        backgroundImage: 'url("/images/background.png")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        borderRadius: '150px',
        zIndex: -1
      }}></div>
      
      {/* Navigation Dock - responsive positioning handled by CSS */}
      <Dock 
        currentPage={currentPage}
        onNavigate={handleNavigation}
        onOpenAccountSettings={handleOpenAccountSettings}
        onOpenSalesBot={handleOpenSalesBot}
      />
      
      <div className="salesbot-overlay">
      <div className="main-container">
          {/* Main Dashboard */}
          <div className="messages-dashboard active">
            <div className="dashboard-header">             
              <div className="dashboard-title">
                {activeView === 'management' && selectedAgent ? (
                  <>
                    {/* Desktop: Show back button only */}
                    {!isMobile && (
                      <>
                        <button 
                          className="back-arrow-btn"
                          onClick={handleBackToMainDashboard}
                          title="חזרה לרשימת הבוטים"
                          aria-label="חזרה"
                        >
                          →
                        </button>
                      </>
                    )}
                    
                    {/* Mobile: Show simple header for non-dashboard tabs */}
                    {isMobile && activeTab !== 'dashboard' && (
                      <div className="mobile-tab-header">
                        <button 
                          className="mobile-back-btn"
                          onClick={() => setActiveTab('dashboard')}
                          title="חזרה לדאשבורד"
                          aria-label="חזרה"
                        >
                          →
                        </button>
                        <h1 className="mobile-tab-title">
                          {activeTab === 'rules' && 'כללי בוט'}
                          {activeTab === 'workflow' && 'זרימת עבודה'}
                          {activeTab === 'training' && 'אימון בוט'}
                          {activeTab === 'simulator' && 'סימולציה'}
                          {activeTab === 'personality' && 'אישיות בוט'}
                          {activeTab === 'services' && 'מידע עסקי'}
                          {activeTab === 'faq' && 'שאלות ותשובות'}
                        </h1>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <h1>דאשבורד ניהול בוטים</h1>
                  </>
                )}
              </div>

              <div className="header-actions">
                <div className="user-profile">
                  <div className="user-avatar"></div>
                  <div className="user-info">
                    <div className="user-name">איל מזרחי</div>
                    <div className="user-role">מנהל מכירות</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="dashboard-content">
              {activeView === 'agents' ? renderAgentsDashboard() : 
               (isMobile && activeTab === 'dashboard') ? 
                 renderMobileDashboard() : 
                 renderAgentManagement()}
            </div>
          </div>
        </div>
      </div>
      {isAddWorkflowOpen && (
        <div className="confirm-modal" onClick={closeAddWorkflow}>
          <div className="confirm-card" onClick={(e) => e.stopPropagation()} style={{maxWidth: 720, width: '90%', direction: 'rtl'}}>
            <h3>הוסף תרחיש חדש</h3>
            <div className="form-group">
              <label>כותרת התרחיש</label>
              <input
                type="text"
                className="form-input"
                placeholder="למשל: יצירת קשר ראשוני"
                value={newWorkflowDraft.title}
                onChange={(e) => setNewWorkflowDraft(prev => ({...prev, title: e.target.value}))}
              />
            </div>
            <div className="form-group">
              <label>תיאור קצר</label>
              <input
                type="text"
                className="form-input"
                placeholder="מה קורה בתרחיש?"
                value={newWorkflowDraft.description}
                onChange={(e) => setNewWorkflowDraft(prev => ({...prev, description: e.target.value}))}
              />
            </div>
            <div className="form-group">
              <label>מתי להשתמש בתרחיש</label>
              <textarea
                className="form-textarea"
                rows={3}
                value={newWorkflowDraft.whenToUse}
                onChange={(e) => setNewWorkflowDraft(prev => ({...prev, whenToUse: e.target.value}))}
              />
            </div>
            <div className="form-group">
              <label>התגובה הראשונית של הבוט</label>
              <textarea
                className="form-textarea"
                rows={3}
                value={newWorkflowDraft.initialReply}
                onChange={(e) => setNewWorkflowDraft(prev => ({...prev, initialReply: e.target.value}))}
              />
            </div>
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={newWorkflowDraft.collectQuestions}
                  onChange={(e) => setNewWorkflowDraft(prev => ({...prev, collectQuestions: e.target.checked}))}
                />
                <span style={{ marginRight: 8 }}>האם יש שאלות לאסוף</span>
              </label>
            </div>
            {newWorkflowDraft.collectQuestions && (
              <div className="form-group">
                <label>שאלות שהבוט חייב לשאול</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  value={newWorkflowDraft.requiredQuestions}
                  onChange={(e) => setNewWorkflowDraft(prev => ({...prev, requiredQuestions: e.target.value}))}
                />
              </div>
            )}
            <div className="form-group">
              <label>הוראות פנימיות לבוט</label>
              <textarea
                className="form-textarea"
                rows={3}
                value={newWorkflowDraft.internalInstructions}
                onChange={(e) => setNewWorkflowDraft(prev => ({...prev, internalInstructions: e.target.value}))}
              />
            </div>
            <div className="form-group">
              <label>מעורבות נציג אנושי</label>
              {(() => { const isHumanBackup = (newWorkflowDraft.humanHandOff !== 'never'); return (
                <div
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                    padding: '10px 12px', backgroundColor: isHumanBackup ? '#f0f8f0' : '#f8f9fa',
                    border: isHumanBackup ? '1px solid #34C759' : '1px solid #e0e0e0', borderRadius: 8
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#333', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span role="img" aria-label="sos">🆘</span>
                      תערב אותי אם מסתבך
                    </div>
                    <div style={{ fontSize: 12, color: '#666' }}>הבוט יפנה אליך במצבים מורכבים</div>
                  </div>
                  <button
                    type="button"
                    aria-pressed={isHumanBackup}
                    onClick={() => setNewWorkflowDraft(prev => ({...prev, humanHandOff: isHumanBackup ? 'never' : 'auto'}))}
                    style={{ width: 42, height: 24, borderRadius: 12, border: 'none', backgroundColor: isHumanBackup ? '#34C759' : '#ccc', position: 'relative', cursor: 'pointer' }}
                  >
                    <span style={{ position: 'absolute', top: 3, left: isHumanBackup ? 22 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.15)', transition: 'left 0.2s ease' }} />
                  </button>
                </div>
              ) })()}
            </div>
            <div className="form-group">
              <label className="goal-title">פעולה רצויה בסוף</label>
              <div className="goal-buttons" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'stretch' }}>
                <button
                  type="button"
                  className={`goal-btn ${newWorkflowDraft.goal === 'schedule_call' ? 'active' : ''}`}
                  onClick={() => setNewWorkflowDraft(prev => ({...prev, goal: 'schedule_call'}))}
                >
                  תיאום שיחה 📞
                </button>
                <button
                  type="button"
                  className={`goal-btn ${newWorkflowDraft.goal === 'purchase_redirect' ? 'active' : ''}`}
                  onClick={() => setNewWorkflowDraft(prev => ({...prev, goal: 'purchase_redirect'}))}
                >
                  הפניה לרכישה באתר 🛒
                </button>
              </div>
            </div>
            <div className="confirm-actions">
              <button className="btn-danger" onClick={closeAddWorkflow}>בטל</button>
              <button className="btn-primary" onClick={saveNewWorkflow}>שמור</button>
            </div>
          </div>
        </div>
      )}
      {isAddServiceOpen && (
        <div className="confirm-modal" onClick={closeAddService}>
          <div className="confirm-card" onClick={(e) => e.stopPropagation()} style={{maxWidth: 600, width: '90%', direction: 'rtl'}}>
            <h3>הוסף שירות</h3>
            <div className="form-group">
              <label>שם השירות</label>
              <input type="text" className="form-input" placeholder="לדוגמה: ייעוץ מכירות" value={newService.name} onChange={(e) => setNewService(prev => ({...prev, name: e.target.value}))} />
            </div>
            <div className="form-group">
              <label>תיאור השירות</label>
              <textarea className="form-textarea" rows={3} placeholder="מה כולל השירות?" value={newService.description} onChange={(e) => setNewService(prev => ({...prev, description: e.target.value}))} />
            </div>
            <div className="form-group">
              <label>מחיר</label>
              <input type="text" className="form-input" placeholder="לדוגמה: ₪299" value={newService.price} onChange={(e) => setNewService(prev => ({...prev, price: e.target.value}))} />
            </div>
            <div className="form-group">
              <label>סוג חיוב</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className={`style-btn ${newService.billing === 'one_time' ? 'active' : ''}`} onClick={() => setNewService(prev => ({...prev, billing: 'one_time'}))}>חד פעמי</button>
                <button type="button" className={`style-btn ${newService.billing === 'monthly' ? 'active' : ''}`} onClick={() => setNewService(prev => ({...prev, billing: 'monthly'}))}>חודשי</button>
              </div>
            </div>
            <div className="confirm-actions">
              <button className="btn-danger" onClick={closeAddService}>בטל</button>
              <button className="btn-primary" onClick={saveNewService}>שמור</button>
            </div>
          </div>
        </div>
      )}
      {isEditServiceOpen && (
        <div className="confirm-modal" onClick={closeEditService}>
          <div className="confirm-card" onClick={(e) => e.stopPropagation()} style={{maxWidth: 600, width: '90%', direction: 'rtl'}}>
            <h3>עריכת שירות</h3>
            <div className="form-group">
              <label>שם השירות</label>
              <input
                type="text"
                className="form-input"
                placeholder="לדוגמה: ייעוץ מכירות"
                value={editServiceData.name}
                onChange={(e) => setEditServiceData(prev => ({...prev, name: e.target.value}))}
              />
            </div>
            <div className="form-group">
              <label>תיאור השירות</label>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder="מה כולל השירות?"
                value={editServiceData.description}
                onChange={(e) => setEditServiceData(prev => ({...prev, description: e.target.value}))}
              />
            </div>
            <div className="form-group">
              <label>מחיר</label>
              <input
                type="text"
                className="form-input"
                placeholder="לדוגמה: ₪299 או ₪299/חודש"
                value={editServiceData.price}
                onChange={(e) => setEditServiceData(prev => ({...prev, price: e.target.value}))}
              />
            </div>
            <div className="form-group">
              <label>סוג חיוב</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className={`style-btn ${editServiceData.billing === 'one_time' ? 'active' : ''}`}
                  onClick={() => setEditServiceData(prev => ({...prev, billing: 'one_time'}))}
                >חד פעמי</button>
                <button
                  type="button"
                  className={`style-btn ${editServiceData.billing === 'monthly' ? 'active' : ''}`}
                  onClick={() => setEditServiceData(prev => ({...prev, billing: 'monthly'}))}
                >חודשי</button>
              </div>
            </div>
            <div className="confirm-actions">
              <button className="btn-danger" onClick={closeEditService}>בטל</button>
              <button className="btn-primary" onClick={saveEditedService}>שמור</button>
            </div>
          </div>
        </div>
      )}
      {isAddProductOpen && (
        <div className="confirm-modal" onClick={closeAddProduct}>
          <div className="confirm-card" onClick={(e) => e.stopPropagation()} style={{maxWidth: 600, width: '90%', direction: 'rtl'}}>
            <h3>הוסף מוצר</h3>
            <div className="form-group">
              <label>שם המוצר</label>
              <input type="text" className="form-input" placeholder="לדוגמה: Power Pack" value={newProduct.name} onChange={(e) => setNewProduct(prev => ({...prev, name: e.target.value}))} />
            </div>
            <div className="form-group">
              <label>תיאור המוצר</label>
              <textarea className="form-textarea" rows={3} placeholder="תיאור קצר של המוצר" value={newProduct.description} onChange={(e) => setNewProduct(prev => ({...prev, description: e.target.value}))} />
            </div>
            <div className="form-group">
              <label>קישור לקנייה (אם רלוונטי)</label>
              <input type="url" className="form-input" placeholder="https://example.com/buy" value={newProduct.link} onChange={(e) => setNewProduct(prev => ({...prev, link: e.target.value}))} />
            </div>
            <div className="form-group">
              <label>מחיר</label>
              <input type="text" className="form-input" placeholder="לדוגמה: ₪249" value={newProduct.price} onChange={(e) => setNewProduct(prev => ({...prev, price: e.target.value}))} />
            </div>
            <div className="form-group">
              <label>סוג המוצר</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className={`style-btn ${newProduct.type === 'digital' ? 'active' : ''}`} onClick={() => setNewProduct(prev => ({...prev, type: 'digital'}))}>דיגיטלי</button>
                <button type="button" className={`style-btn ${newProduct.type === 'physical' ? 'active' : ''}`} onClick={() => setNewProduct(prev => ({...prev, type: 'physical'}))}>פיזי</button>
              </div>
            </div>
            <div className="confirm-actions">
              <button className="btn-danger" onClick={closeAddProduct}>בטל</button>
              <button className="btn-primary" onClick={saveNewProduct}>שמור</button>
            </div>
          </div>
        </div>
      )}
      {isEditProductOpen && (
        <div className="confirm-modal" onClick={closeEditProduct}>
          <div className="confirm-card" onClick={(e) => e.stopPropagation()} style={{maxWidth: 600, width: '90%', direction: 'rtl'}}>
            <h3>עריכת מוצר</h3>
            <div className="form-group">
              <label>שם המוצר</label>
              <input type="text" className="form-input" placeholder="לדוגמה: Power Pack" value={editProductData.name} onChange={(e) => setEditProductData(prev => ({...prev, name: e.target.value}))} />
            </div>
            <div className="form-group">
              <label>תיאור המוצר</label>
              <textarea className="form-textarea" rows={3} placeholder="תיאור קצר של המוצר" value={editProductData.description} onChange={(e) => setEditProductData(prev => ({...prev, description: e.target.value}))} />
            </div>
            <div className="form-group">
              <label>קישור לקנייה (אם רלוונטי)</label>
              <input type="url" className="form-input" placeholder="https://example.com/buy" value={editProductData.link} onChange={(e) => setEditProductData(prev => ({...prev, link: e.target.value}))} />
            </div>
            <div className="form-group">
              <label>מחיר</label>
              <input type="text" className="form-input" placeholder="לדוגמה: ₪249" value={editProductData.price} onChange={(e) => setEditProductData(prev => ({...prev, price: e.target.value}))} />
            </div>
            <div className="form-group">
              <label>סוג המוצר</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className={`style-btn ${editProductData.type === 'digital' ? 'active' : ''}`} onClick={() => setEditProductData(prev => ({...prev, type: 'digital'}))}>דיגיטלי</button>
                <button type="button" className={`style-btn ${editProductData.type === 'physical' ? 'active' : ''}`} onClick={() => setEditProductData(prev => ({...prev, type: 'physical'}))}>פיזי</button>
              </div>
            </div>
            <div className="confirm-actions">
              <button className="btn-danger" onClick={closeEditProduct}>בטל</button>
              <button className="btn-primary" onClick={saveEditedProduct}>שמור</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default SalesBot 