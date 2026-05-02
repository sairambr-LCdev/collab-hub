import './style.css';
import { state } from './state/stateManager.js';
import { askCollabBot } from './bot/collabBot.js';

// --- DOM Elements ---
const DOM = {
    projectList: document.getElementById('project-list'),
    currentProjectTitle: document.getElementById('current-project-title'),
    taskList: document.getElementById('task-list'),
    projectStats: document.getElementById('project-stats'),
    addTaskBtn: document.getElementById('add-task-btn'),
    chatMessages: document.getElementById('chat-messages'),
    chatForm: document.getElementById('chat-form'),
    chatInput: document.getElementById('chat-input'),
    userName: document.getElementById('user-name'),
};

// --- Global App State ---
let activeProjectId = 'p1';

// --- Initialization ---
const initApp = () => {
    const user = state.getCurrentUser();
    DOM.userName.textContent = `${user.name} (${user.role})`;
    renderProjects();
    renderTasks();
    renderStats();
    renderMessages();
};

// --- Render Functions ---
const renderProjects = () => {
    const projects = state.getProjects();
    DOM.projectList.innerHTML = '';
    
    projects.forEach(p => {
        const div = document.createElement('div');
        div.className = `project-item ${p.id === activeProjectId ? 'active' : ''}`;
        div.innerHTML = `<span>📁</span> <span>${p.name}</span>`;
        
        div.addEventListener('click', () => {
            activeProjectId = p.id;
            DOM.currentProjectTitle.textContent = p.name;
            renderProjects();
            renderTasks();
            renderStats();
            renderMessages();
        });
        DOM.projectList.appendChild(div);
        
        if(p.id === activeProjectId) {
            DOM.currentProjectTitle.textContent = p.name;
        }
    });
};

const renderStats = () => {
    const tasks = state.getTasksByProject(activeProjectId);
    const todo = tasks.filter(t => t.status === 'To Do' || t.status === 'In Progress').length;
    const done = tasks.filter(t => t.status === 'Done').length;
    
    DOM.projectStats.innerHTML = `
      <div class="stat-box">
        <div class="stat-number" style="color: var(--accent)">${todo}</div>
        <div class="stat-label">Pending</div>
      </div>
      <div class="stat-box">
        <div class="stat-number" style="color: var(--success)">${done}</div>
        <div class="stat-label">Completed</div>
      </div>
    `;
};

const renderTasks = () => {
    const tasks = state.getTasksByProject(activeProjectId);
    DOM.taskList.innerHTML = '';

    if (tasks.length === 0) {
        DOM.taskList.innerHTML = `<p style="color: var(--text-secondary);">No active tasks.</p>`;
        return;
    }

    tasks.forEach(task => {
        const div = document.createElement('div');
        div.className = 'task-card';
        div.innerHTML = `
            <span style="font-weight: 500;">${task.title}</span>
            <button class="status-badge" data-id="${task.id}" data-status="${task.status}">
                ${task.status}
            </button>
        `;
        DOM.taskList.appendChild(div);
    });
};

const renderMessages = () => {
    const messages = state.getMessages(activeProjectId);
    DOM.chatMessages.innerHTML = '';

    messages.forEach(msg => {
        const isBot = msg.senderId === 'bot';
        const div = document.createElement('div');
        div.className = `message ${isBot ? 'bot' : 'user'}`;
        
        const contentSpan = document.createElement('span');
        contentSpan.textContent = msg.text;
        div.appendChild(contentSpan);

        DOM.chatMessages.appendChild(div);
    });

    DOM.chatMessages.scrollTop = DOM.chatMessages.scrollHeight;
};

// --- Event Listeners ---
DOM.addTaskBtn.addEventListener('click', () => {
    const title = prompt("Enter new task title:");
    if (title) {
        state.addTask(activeProjectId, title);
        renderTasks();
        renderStats();
    }
});

DOM.taskList.addEventListener('click', (e) => {
    if (e.target.classList.contains('status-badge')) {
        const taskId = e.target.getAttribute('data-id');
        const currentStatus = e.target.getAttribute('data-status');
        const newStatus = currentStatus === 'To Do' ? 'In Progress' : currentStatus === 'In Progress' ? 'Done' : 'To Do';
        
        state.updateTaskStatus(taskId, newStatus);
        renderTasks();
        renderStats();
    }
});

DOM.chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = DOM.chatInput.value.trim();
    if (!text) return;

    state.addMessage(activeProjectId, text, state.getCurrentUser().id);
    DOM.chatInput.value = '';
    renderMessages();

    if (text.includes('@bot')) {
        state.addMessage(activeProjectId, "...", "bot");
        renderMessages();

        const botReplyText = await askCollabBot(text, activeProjectId);
        
        state.addMessage(activeProjectId, botReplyText, "bot");
        renderMessages();
    }
});

initApp();
