import './style.css';
import { state } from './state/stateManager.js';
import { askCollabBot } from './bot/collabBot.js';

// --- DOM Elements ---
const DOM = {
    projectList: document.getElementById('project-list'),
    currentProjectTitle: document.getElementById('current-project-title'),
    taskList: document.getElementById('task-list'),
    addTaskBtn: document.getElementById('add-task-btn'),
    chatMessages: document.getElementById('chat-messages'),
    chatForm: document.getElementById('chat-form'),
    chatInput: document.getElementById('chat-input'),
    userName: document.getElementById('user-name'),
    userAvatar: document.getElementById('user-avatar'),
};

// --- Global App State ---
let activeProjectId = 'p1'; // Default to first project

// --- Initialization ---
const initApp = () => {
    const user = state.getCurrentUser();
    DOM.userName.textContent = `${user.name} (${user.role})`;
    DOM.userAvatar.textContent = user.avatar;

    renderProjects();
    renderTasks();
    renderMessages();
};

// --- Render Functions ---
const renderProjects = () => {
    const projects = state.getProjects();
    DOM.projectList.innerHTML = '';
    
    projects.forEach(p => {
        const li = document.createElement('li');
        li.style.padding = '0.5rem 0';
        li.style.cursor = 'pointer';
        li.style.color = p.id === activeProjectId ? 'var(--text-primary)' : 'var(--text-secondary)';
        li.style.fontWeight = p.id === activeProjectId ? '600' : '400';
        li.textContent = `📁 ${p.name}`;
        
        li.addEventListener('click', () => {
            activeProjectId = p.id;
            DOM.currentProjectTitle.textContent = p.name;
            renderProjects();
            renderTasks();
            renderMessages();
        });
        DOM.projectList.appendChild(li);
        
        if(p.id === activeProjectId) {
            DOM.currentProjectTitle.textContent = p.name;
        }
    });
};

const renderTasks = () => {
    const tasks = state.getTasksByProject(activeProjectId);
    DOM.taskList.innerHTML = '';

    if (tasks.length === 0) {
        DOM.taskList.innerHTML = `<p style="color: var(--text-secondary);">No tasks yet. Create one!</p>`;
        return;
    }

    tasks.forEach(task => {
        const div = document.createElement('div');
        div.className = 'task-card glass';
        div.innerHTML = `
            <span>${task.title}</span>
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
        
        // Ensure text is rendered safely using textContent via DOM manipulation
        const contentSpan = document.createElement('span');
        contentSpan.textContent = msg.text;
        div.appendChild(contentSpan);

        DOM.chatMessages.appendChild(div);
    });

    // Auto-scroll to bottom
    DOM.chatMessages.scrollTop = DOM.chatMessages.scrollHeight;
};

// --- Event Listeners ---

// Add Task
DOM.addTaskBtn.addEventListener('click', () => {
    const title = prompt("Enter new task title:");
    if (title) {
        state.addTask(activeProjectId, title);
        renderTasks();
    }
});

// Toggle Task Status
DOM.taskList.addEventListener('click', (e) => {
    if (e.target.classList.contains('status-badge')) {
        const taskId = e.target.getAttribute('data-id');
        const currentStatus = e.target.getAttribute('data-status');
        const newStatus = currentStatus === 'To Do' ? 'In Progress' : currentStatus === 'In Progress' ? 'Done' : 'To Do';
        
        state.updateTaskStatus(taskId, newStatus);
        renderTasks();
    }
});

// Chat Form Submission (And Bot Interception)
DOM.chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = DOM.chatInput.value.trim();
    if (!text) return;

    // Save User Message
    state.addMessage(activeProjectId, text, state.getCurrentUser().id);
    DOM.chatInput.value = '';
    renderMessages();

    // Check if Bot was mentioned
    if (text.includes('@bot')) {
        // Add a temporary typing message
        const typingMsg = state.addMessage(activeProjectId, "...", "bot");
        renderMessages();

        // Fetch AI Response
        const botReplyText = await askCollabBot(text, activeProjectId);
        
        // Replace typing message with real response in the state DB
        // For simplicity in hackathon, we just add a new message and filter out the '...' one if we wanted, 
        // but here we will just add the real one to the DB.
        state.addMessage(activeProjectId, botReplyText, "bot");
        renderMessages();
    }
});

// Start the app!
initApp();
