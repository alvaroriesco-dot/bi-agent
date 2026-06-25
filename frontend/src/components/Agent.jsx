import React, { useState, useEffect, useRef } from 'react';
import './Agent.css';

const Agent = () => {
  const [messages, setMessages] = useState([]);
  const [step, setStep] = useState('initial');
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [selectedMetric, setSelectedMetric] = useState(null);
  const [selectedGranularity, setSelectedGranularity] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState([]);
  const [granularities, setGranularities] = useState([]);
  const messagesEndRef = useRef(null);

  const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';

  // Scroll automático al final
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Cargar datos iniciales
  useEffect(() => {
    fetchTeamsAndGranularities();
    initConversation();
  }, []);

  const fetchTeamsAndGranularities = async () => {
    try {
      const teamsRes = await fetch(`${API_BASE}/api/teams`);
      const granuRes = await fetch(`${API_BASE}/api/granularities`);

      const teamsData = await teamsRes.json();
      const granuData = await granuRes.json();

      setTeams(teamsData.teams);
      setGranularities(granuData.granularities);
    } catch (error) {
      console.error('Error cargando datos:', error);
      addMessage('⚠️ Error conectando con el servidor. Intenta más tarde.', false);
    }
  };

  const initConversation = () => {
    addMessage('¡Hola! 👋 Soy tu asistente BI de Just Eat. Voy a ayudarte a encontrar la información que necesitas.', false);
    setTimeout(() => {
      addMessage('Para poder brindarte la mejor información, primero necesito saber... **¿A qué equipo perteneces?**', false);
      setStep('selecting_team');
    }, 800);
  };

  const addMessage = (text, isUser = false) => {
    setMessages((prev) => [...prev, { text, isUser, id: Date.now() }]);
  };

  const handleTeamSelect = (team) => {
    addMessage(team.label, true);
    setSelectedTeam(team);
    setTimeout(() => {
      addMessage(`Perfecto, equipo de ${team.label}. 👍`, false);
      setTimeout(() => {
        addMessage(`Ahora cuéntame... **¿Qué métrica necesitas consultar?**`, false);
        setStep('selecting_metric');
      }, 600);
    }, 500);
  };

  const handleMetricSelect = (metric) => {
    addMessage(metric, true);
    setSelectedMetric(metric);
    setTimeout(() => {
      addMessage(`Excelente, vamos a analizar **${metric}**. 📊`, false);
      setTimeout(() => {
        addMessage(`Por último... **¿A qué nivel de detalle necesitas verlo?**`, false);
        setStep('selecting_granularity');
      }, 600);
    }, 500);
  };

  const handleGranularitySelect = (granularity) => {
    addMessage(granularity.label, true);
    setSelectedGranularity(granularity);
    setTimeout(() => {
      addMessage('Perfecto. Ahora necesito el rango de fechas...', false);
      setTimeout(() => {
        addMessage('**¿Desde qué fecha? (YYYY-MM-DD)**', false);
        setStep('selecting_date_start');
      }, 600);
    }, 500);
  };

  const handleDateInput = (date, isStart) => {
    addMessage(date, true);
    if (isStart) {
      setStartDate(date);
      setTimeout(() => {
        addMessage(`Fecha inicio: ${date}. 📅`, false);
        setTimeout(() => {
          addMessage('**¿Hasta qué fecha? (YYYY-MM-DD)**', false);
          setStep('selecting_date_end');
        }, 600);
      }, 500);
    } else {
      setEndDate(date);
      setTimeout(() => {
        addMessage(`Fecha fin: ${date}. ✅`, false);
        setTimeout(() => {
          executeQuery(date);
        }, 600);
      }, 500);
    }
  };

  const executeQuery = async (endDateValue) => {
    setLoading(true);
    addMessage('Conectando con BigQuery para obtener los datos...', false);

    try {
      const response = await fetch(`${API_BASE}/api/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          team: selectedTeam.id,
          metric: selectedMetric,
          granularity: selectedGranularity.value,
          start_date: startDate,
          end_date: endDateValue,
        }),
      });

      if (!response.ok) {
        throw new Error('Error en la query');
      }

      const data = await response.json();
      displayResults(data);
    } catch (error) {
      console.error('Error ejecutando query:', error);
      addMessage('❌ Error al obtener los datos. Intenta de nuevo.', false);
      setStep('ready_for_new_query');
    } finally {
      setLoading(false);
    }
  };

  const displayResults = (result) => {
    addMessage('✅ Datos obtenidos exitosamente', false);

    // Mostrar resumen
    const summary = `
      <strong>📋 Resumen de tu consulta:</strong><br>
      Equipo: ${result.team}<br>
      Métrica: ${result.metric}<br>
      Granularidad: ${result.granularity}<br>
      Período: ${result.timestamp.split('T')[0]}
    `;
    addMessage(summary, false);

    // Mostrar datos en tabla
    setTimeout(() => {
      let dataHtml = '<strong>📊 Resultados:</strong><table style="width:100%; border-collapse:collapse; margin-top:10px;">';
      dataHtml += '<tr style="background:#f0f0f0;"><th style="border:1px solid #ddd; padding:8px; text-align:left;">Localización</th><th style="border:1px solid #ddd; padding:8px; text-align:right;">Valor</th></tr>';

      Object.entries(result.data).forEach(([key, value]) => {
        const formattedValue = typeof value === 'number' && value > 100 ? value.toLocaleString('es-ES') : value;
        dataHtml += `<tr><td style="border:1px solid #ddd; padding:8px;">${key}</td><td style="border:1px solid #ddd; padding:8px; text-align:right;"><strong>${formattedValue}</strong></td></tr>`;
      });
      dataHtml += '</table>';

      addMessage(dataHtml, false);

      setTimeout(() => {
        addMessage('¿Necesitas explorar otro dato o cambiar de equipo? 🚀', false);
        setStep('ready_for_new_query');
      }, 500);
    }, 800);
  };

  const handleNewQuery = (choice) => {
    if (choice === 'same_team') {
      addMessage('Vamos a analizar otra métrica...', true);
      setSelectedMetric(null);
      setSelectedGranularity(null);
      setStartDate('');
      setEndDate('');
      setTimeout(() => {
        addMessage(`¿Qué otra métrica necesitas de ${selectedTeam.label}?`, false);
        setStep('selecting_metric');
      }, 500);
    } else {
      resetConversation();
    }
  };

  const resetConversation = () => {
    setMessages([]);
    setStep('initial');
    setSelectedTeam(null);
    setSelectedMetric(null);
    setSelectedGranularity(null);
    setStartDate('');
    setEndDate('');
    setTimeout(() => {
      initConversation();
    }, 100);
  };

  return (
    <div className="agent-container">
      <div className="agent-header">
        <div className="header-left">
          <img 
            src="https://d21buns5ku92am.cloudfront.net/69688/images/445647-Just%20Eat-Logo-White-Secondary-Vertical-Stacked-On%20Orange-RGB-2828cf-original-1664805776.png" 
            alt="Just Eat Takeaway" 
            className="je-logo"
          />
          <div className="header-text">
            <h1>BI Chatbot help</h1>
            <p>Soporte para consultar data por parte de diferentes equipos</p>
          </div>
        </div>
        <button className="reset-btn" onClick={resetConversation}>
          ↻ Reiniciar
        </button>
      </div>

      <div className="agent-messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.isUser ? 'user' : 'agent'}`}>
            <div className="message-bubble">
              {msg.text.includes('<') ? (
                <div dangerouslySetInnerHTML={{ __html: msg.text }} />
              ) : (
                msg.text
              )}
            </div>
          </div>
        ))}

        {/* Mostrar opciones según step */}
        {step === 'selecting_team' && teams.length > 0 && (
          <div className="message agent">
            <div className="message-bubble">
              <div className="options">
                {teams.map((team) => (
                  <button
                    key={team.id}
                    className="option-btn"
                    onClick={() => handleTeamSelect(team)}
                  >
                    {team.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 'selecting_metric' && selectedTeam && (
          <div className="message agent">
            <div className="message-bubble">
              <div className="options">
                {selectedTeam.metrics.map((metric) => (
                  <button
                    key={metric}
                    className="option-btn"
                    onClick={() => handleMetricSelect(metric)}
                  >
                    {metric}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 'selecting_granularity' && granularities.length > 0 && (
          <div className="message agent">
            <div className="message-bubble">
              <div className="options">
                {granularities.map((gran) => (
                  <button
                    key={gran.value}
                    className="option-btn"
                    onClick={() => handleGranularitySelect(gran)}
                  >
                    {gran.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 'selecting_date_start' && (
          <div className="message agent">
            <div className="message-bubble">
              <input
                type="date"
                className="date-input"
                onChange={(e) => handleDateInput(e.target.value, true)}
                placeholder="YYYY-MM-DD"
              />
            </div>
          </div>
        )}

        {step === 'selecting_date_end' && (
          <div className="message agent">
            <div className="message-bubble">
              <input
                type="date"
                className="date-input"
                onChange={(e) => handleDateInput(e.target.value, false)}
                placeholder="YYYY-MM-DD"
              />
            </div>
          </div>
        )}

        {step === 'ready_for_new_query' && (
          <div className="message agent">
            <div className="message-bubble">
              <div className="options">
                <button
                  className="option-btn"
                  onClick={() => handleNewQuery('same_team')}
                >
                  📊 Otra métrica del mismo equipo
                </button>
                <button
                  className="option-btn"
                  onClick={() => handleNewQuery('change_team')}
                >
                  🔄 Cambiar de equipo
                </button>
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className="message agent">
            <div className="message-bubble">
              <div className="typing">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

export default Agent;
