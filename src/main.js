import './style.css';
import { auth } from './firebase.js';
import { onAuthStateChanged } from 'firebase/auth';
import { 
    loginWithGoogle, logout, getAllUsers,
    createProject, subscribeToProjects, addMemberToProject,
    createTask, subscribeToTasks, updateTaskStatus, logTimeOnTask, uploadAttachment, addAttachmentToTask,
    createConversation, subscribeToConversations, sendMessage, subscribeToMessages 
} from './db.js';
import { askCollabBot } from './bot/collabBot.js';

const DOM = {
    // Auth
    loginScreen: document.getElementById('login-screen'),
    appScreen: document.getElementById('app'),
    btnLogin: document.getElementById('btn-login'),
    btnLogout: document.getElementById('btn-logout'),
    userName: document.getElementById('user-name'),
    
    // Nav Tabs
    tabDashboard: document.getElementById('tab-dashboard'),
    tabChat: document.getElementById('tab-chat'),
    viewDashboard: document.getElementById('view-dashboard'),
    viewChat: document.getElementById('view-chat'),
    
    // Sidebar & Projects
    projectList: document.getElementById('project-list'),
    btnNewProject: document.getElementById('btn-new-project'),
    currentProjectTitle: document.getElementById('current-project-title'),
    projectMembersList: document.getElementById('project-members-list'),
    btnAddMember: document.getElementById('btn-add-member'),
    projectStats: document.getElementById('project-stats'),
    
    // Tasks
    addTaskBtn: document.getElementById('add-task-btn'),
    taskList: document.getElementById('task-list'),
    
    // Chat Hub
    conversationList: document.getElementById('conversation-list'),
    btnNewChat: document.getElementById('btn-new-chat'),
    activeChatHeader: document.getElementById('active-chat-header'),
    chatHubMessages: document.getElementById('chat-hub-messages'),
    chatHubForm: document.getElementById('chat-hub-form'),
    chatHubInput: document.getElementById('chat-hub-input'),

    // Modal
    modalContainer: document.getElementById('modal-container'),
    modalContent: document.getElementById('modal-content')
};

let currentUser = null;
let activeProjectId = null;
let activeConversationId = null;
let allSystemUsers = [];

// Unsubscribe functions
let projectsUnsub = null;
let tasksUnsub = null;
let convsUnsub = null;
let chatUnsub = null;

// --- AUTHENTICATION ---
DOM.btnLogin.addEventListener('click', loginWithGoogle);
DOM.btnLogout.addEventListener('click', logout);

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        DOM.loginScreen.classList.add('hidden');
        DOM.appScreen.classList.remove('hidden');
        DOM.userName.textContent = user.displayName;
        
        allSystemUsers = await getAllUsers();
        initDashboard();
        initChatHub();
    } else {
        currentUser = null;
        DOM.loginScreen.classList.remove('hidden');
        DOM.appScreen.classList.add('hidden');
        if (projectsUnsub) projectsUnsub();
        if (tasksUnsub) tasksUnsub();
        if (convsUnsub) convsUnsub();
        if (chatUnsub) chatUnsub();
    }
});

// --- NAVIGATION ---
DOM.tabDashboard.addEventListener('click', () => {
    DOM.tabDashboard.classList.add('active');
    DOM.tabChat.classList.remove('active');
    DOM.viewDashboard.classList.remove('hidden');
    DOM.viewChat.classList.add('hidden');
});

DOM.tabChat.addEventListener('click', () => {
    DOM.tabChat.classList.add('active');
    DOM.tabDashboard.classList.remove('active');
    DOM.viewChat.classList.remove('hidden');
    DOM.viewDashboard.classList.add('hidden');
});

// --- DASHBOARD & PROJECTS ---
const initDashboard = () => {
    if (projectsUnsub) projectsUnsub();
    projectsUnsub = subscribeToProjects(currentUser.uid, (projects) => {
        renderProjectList(projects);
    });
};

const renderProjectList = (projects) => {
    DOM.projectList.innerHTML = '';
    if (projects.length === 0) {
        DOM.projectList.innerHTML = `<div style="padding:1rem;font-size:0.8rem;color:#94a3b8;">No projects yet.</div>`;
        return;
    }
    
    if (!activeProjectId) switchProject(projects[0]);

    projects.forEach(p => {
        const div = document.createElement('div');
        div.className = `project-item ${p.id === activeProjectId ? 'active' : ''}`;
        div.innerHTML = `<span>📁</span> <span>${p.name}</span>`;
        div.onclick = () => switchProject(p);
        DOM.projectList.appendChild(div);
    });
};

const switchProject = (project) => {
    activeProjectId = project.id;
    DOM.currentProjectTitle.textContent = project.name;
    DOM.btnAddMember.style.display = 'block';
    DOM.addTaskBtn.style.display = 'block';
    
    // Render Members
    DOM.projectMembersList.innerHTML = '';
    project.members.forEach(mId => {
        const u = allSystemUsers.find(user => user.uid === mId);
        if (u) {
            const img = document.createElement('img');
            img.src = u.photoURL || `https://ui-avatars.com/api/?name=${u.displayName}`;
            img.title = u.displayName;
            img.style = "width:24px;height:24px;border-radius:50%;border:1px solid var(--border);";
            DOM.projectMembersList.appendChild(img);
        }
    });

    if (tasksUnsub) tasksUnsub();
    tasksUnsub = subscribeToTasks(project.id, renderTasks);
    
    // Update Sidebar Highlight
    Array.from(DOM.projectList.children).forEach(child => {
        child.classList.toggle('active', child.textContent.includes(project.name));
    });
};

DOM.btnNewProject.addEventListener('click', () => {
    showModal(`
        <h3>Create New Project</h3>
        <input type="text" id="new-proj-name" placeholder="Project Name" style="margin:1rem 0; width:100%;">
        <button id="confirm-new-proj" class="primary">Create Project</button>
    `);
    document.getElementById('confirm-new-proj').onclick = async () => {
        const name = document.getElementById('new-proj-name').value;
        if (name) {
            await createProject(name, "New Portfolio", currentUser.uid);
            closeModal();
        }
    };
});

DOM.btnAddMember.addEventListener('click', () => {
    const otherUsers = allSystemUsers.filter(u => u.uid !== currentUser.uid);
    let options = otherUsers.map(u => `<option value="${u.uid}">${u.displayName} (${u.email})</option>`).join('');
    
    showModal(`
        <h3>Add Member to Project</h3>
        <select id="select-member" style="margin:1rem 0; width:100%;">${options}</select>
        <button id="confirm-add-member" class="primary">Add to Team</button>
    `);
    
    document.getElementById('confirm-add-member').onclick = async () => {
        const uid = document.getElementById('select-member').value;
        await addMemberToProject(activeProjectId, uid);
        closeModal();
        // Refresh project data (snapshot will handle members list)
    };
});

// --- TASKS ---
DOM.addTaskBtn.addEventListener('click', () => {
    // Only allow assigning to project members
    // For this hackathon, we fetch the project from our system state
    // But since we are using snapshots, let's just use all users for now OR ideally filter
    let options = allSystemUsers.map(u => `<option value="${u.uid}">${u.displayName}</option>`).join('');

    showModal(`
        <h3>Create New Task</h3>
        <input type="text" id="new-task-title" placeholder="What needs to be done?" style="margin-top:1rem; width:100%;">
        <select id="new-task-assignee" style="margin:1rem 0; width:100%;">${options}</select>
        <input type="number" id="new-task-hours" placeholder="Estimated Hours" style="margin-bottom:1rem; width:100%;">
        <button id="confirm-new-task" class="primary">Create Task</button>
    `);
    
    document.getElementById('confirm-new-task').onclick = async () => {
        const title = document.getElementById('new-task-title').value;
        const assigneeId = document.getElementById('new-task-assignee').value;
        const hours = document.getElementById('new-task-hours').value;
        if (title) {
            await createTask(activeProjectId, title, assigneeId, hours);
            closeModal();
        }
    };
});

const renderTasks = (tasks) => {
    DOM.taskList.innerHTML = '';
    
    // Stats
    const todo = tasks.filter(t => t.status !== 'Done').length;
    const done = tasks.filter(t => t.status === 'Done').length;
    DOM.projectStats.innerHTML = `
      <div class="stat-box"><div class="stat-number" style="color: var(--accent)">${todo}</div><div class="stat-label">Pending</div></div>
      <div class="stat-box"><div class="stat-number" style="color: var(--success)">${done}</div><div class="stat-label">Completed</div></div>
    `;

    tasks.forEach(task => {
        const assignee = allSystemUsers.find(u => u.uid === task.assigneeId);
        const div = document.createElement('div');
        div.className = 'task-card';
        
        let attachmentsHtml = (task.attachments || []).map(att => 
            `<a href="${att.url}" target="_blank" class="attachment-link">📎 ${att.name}</a>`
        ).join('');

        div.innerHTML = `
            <div class="task-header">
                <span style="font-weight: 600;">${task.title}</span>
                <button class="status-badge" data-status="${task.status}">${task.status}</button>
            </div>
            <div class="task-meta">
                <span>👤 Assignee: ${assignee ? assignee.displayName : 'Unassigned'}</span>
                <span>⏱️ ${task.timeLogged || 0} / ${task.estimatedHours || 0}h</span>
            </div>
            <div class="attachments-list">${attachmentsHtml}</div>
            <div class="task-actions">
                <button class="secondary btn-log">Log Time</button>
                <input type="file" id="file-${task.id}" class="hidden">
                <label for="file-${task.id}" class="secondary" style="cursor:pointer; padding:2px 5px; border:1px solid var(--border); border-radius:4px;">📎 Attach</label>
            </div>
        `;
        
        div.querySelector('.status-badge').onclick = () => {
            const next = task.status === 'To Do' ? 'In Progress' : (task.status === 'In Progress' ? 'Done' : 'To Do');
            updateTaskStatus(task.id, next);
        };
        
        div.querySelector('.btn-log').onclick = () => {
            const h = prompt("How many hours?");
            if (h) logTimeOnTask(task.id, task.timeLogged || 0, h);
        };
        
        div.querySelector('input[type="file"]').onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                const uploaded = await uploadAttachment(task.id, file);
                await addAttachmentToTask(task.id, task.attachments || [], uploaded);
            }
        };

        DOM.taskList.appendChild(div);
    });
};

// --- CHAT HUB ---
const initChatHub = () => {
    if (convsUnsub) convsUnsub();
    convsUnsub = subscribeToConversations(currentUser.uid, (convs) => {
        renderConversationList(convs);
    });
};

const renderConversationList = (convs) => {
    DOM.conversationList.innerHTML = '';
    convs.forEach(c => {
        const div = document.createElement('div');
        div.className = `conversation-item ${c.id === activeConversationId ? 'active' : ''}`;
        
        let displayName = c.name;
        if (c.type === 'dm') {
            const otherId = c.participants.find(p => p !== currentUser.uid);
            const otherUser = allSystemUsers.find(u => u.uid === otherId);
            displayName = otherUser ? otherUser.displayName : "Direct Message";
        }

        div.innerHTML = `
            <div class="conv-name">${displayName}</div>
            <div class="conv-preview">${c.lastMessage || 'No messages yet'}</div>
        `;
        div.onclick = () => switchChat(c, displayName);
        DOM.conversationList.appendChild(div);
    });
};

const switchChat = (conv, displayName) => {
    activeConversationId = conv.id;
    DOM.activeChatHeader.textContent = displayName;
    DOM.chatHubForm.style.display = 'flex';
    
    if (chatUnsub) chatUnsub();
    chatUnsub = subscribeToMessages(conv.id, (messages) => {
        DOM.chatHubMessages.innerHTML = '';
        messages.forEach(m => {
            const isMe = m.senderId === currentUser.uid;
            const msgDiv = document.createElement('div');
            msgDiv.className = `message ${isMe ? 'user' : 'bot'}`;
            msgDiv.innerHTML = `
                <div class="message-sender">${m.senderName}</div>
                <div>${m.text}</div>
            `;
            DOM.chatHubMessages.appendChild(msgDiv);
        });
        DOM.chatHubMessages.scrollTop = DOM.chatHubMessages.scrollHeight;
    });

    // Update highlight
    Array.from(DOM.conversationList.children).forEach(child => {
        child.classList.toggle('active', child.querySelector('.conv-name').textContent === displayName);
    });
};

DOM.chatHubForm.onsubmit = async (e) => {
    e.preventDefault();
    const text = DOM.chatHubInput.value.trim();
    if (text && activeConversationId) {
        DOM.chatHubInput.value = '';
        await sendMessage(activeConversationId, text, currentUser.uid, currentUser.displayName);
        
        if (text.includes('@bot')) {
            const reply = await askCollabBot(text, "global"); // Simple context for hub
            await sendMessage(activeConversationId, reply, 'bot', 'CollabBot');
        }
    }
};

DOM.btnNewChat.onclick = () => {
    let options = allSystemUsers.filter(u => u.uid !== currentUser.uid)
                    .map(u => `<option value="${u.uid}">${u.displayName}</option>`).join('');
    
    showModal(`
        <h3>Start New Conversation</h3>
        <p style="font-size:0.8rem; color:var(--text-secondary); margin:1rem 0;">Select a peer to start a private chat.</p>
        <select id="new-dm-user" style="width:100%; margin-bottom:1rem;">${options}</select>
        <button id="confirm-new-dm" class="primary">Start Chat</button>
    `);
    
    document.getElementById('confirm-new-dm').onclick = async () => {
        const targetId = document.getElementById('new-dm-user').value;
        const cId = await createConversation('dm', 'Direct Message', [currentUser.uid, targetId]);
        activeConversationId = cId;
        closeModal();
    };
};

// --- MODAL UTILS ---
const showModal = (html) => {
    DOM.modalContent.innerHTML = html + `<button onclick="this.closest('#modal-container').classList.add('hidden')" class="secondary" style="margin-top:1rem; width:100%;">Cancel</button>`;
    DOM.modalContainer.classList.remove('hidden');
};
const closeModal = () => DOM.modalContainer.classList.add('hidden');
window.closeModal = closeModal; // For the cancel button
