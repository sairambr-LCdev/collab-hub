/**
 * @fileoverview Application State Manager
 * Simulates a robust backend using LocalStorage to ensure speed and efficiency without needing a real database.
 * Handles Projects, Tasks, and Chat Messages.
 */

import { sanitizeInput, validatePayload } from '../utils/security.js';

const DB_KEY = 'collab_hub_db';

// Initial Seed Data for the Hackathon Demo
const initialData = {
    currentUser: { id: 'u1', name: 'Demo User', role: 'admin', avatar: '😎' },
    projects: [
        { id: 'p1', name: 'Website Redesign', description: 'Overhaul the corporate site' }
    ],
    tasks: [
        { id: 't1', projectId: 'p1', title: 'Design Mockups', status: 'In Progress', assignee: 'u1' },
        { id: 't2', projectId: 'p1', title: 'Setup Vite', status: 'Done', assignee: 'u1' }
    ],
    messages: [
        { id: 'm1', channelId: 'p1', senderId: 'bot', text: 'Welcome to the Website Redesign channel!', timestamp: new Date().toISOString() }
    ]
};

class StateManager {
    constructor() {
        this.db = this.loadDB();
    }

    loadDB() {
        const data = localStorage.getItem(DB_KEY);
        if (!data) {
            this.saveDB(initialData);
            return initialData;
        }
        try {
            return JSON.parse(data);
        } catch (e) {
            console.error('Failed to parse DB, resetting...', e);
            this.saveDB(initialData);
            return initialData;
        }
    }

    saveDB(data) {
        localStorage.setItem(DB_KEY, JSON.stringify(data));
        this.db = data;
    }

    // --- Users ---
    getCurrentUser() {
        return this.db.currentUser;
    }

    // --- Projects ---
    getProjects() {
        return this.db.projects;
    }

    addProject(name, description) {
        if (!validatePayload({name, description}, ['name'])) return null;
        
        const newProject = {
            id: `p${Date.now()}`,
            name: sanitizeInput(name),
            description: sanitizeInput(description)
        };
        
        const newData = { ...this.db, projects: [...this.db.projects, newProject] };
        this.saveDB(newData);
        return newProject;
    }

    // --- Tasks ---
    getTasksByProject(projectId) {
        return this.db.tasks.filter(t => t.projectId === projectId);
    }

    addTask(projectId, title) {
        const newTask = {
            id: `t${Date.now()}`,
            projectId: sanitizeInput(projectId),
            title: sanitizeInput(title),
            status: 'To Do',
            assignee: this.db.currentUser.id
        };
        this.saveDB({ ...this.db, tasks: [...this.db.tasks, newTask] });
        return newTask;
    }

    updateTaskStatus(taskId, newStatus) {
        const tasks = this.db.tasks.map(t => 
            t.id === taskId ? { ...t, status: sanitizeInput(newStatus) } : t
        );
        this.saveDB({ ...this.db, tasks });
    }

    // --- Chat Messages ---
    getMessages(channelId) {
        return this.db.messages.filter(m => m.channelId === channelId);
    }

    addMessage(channelId, text, senderId = this.db.currentUser.id) {
        const sanitizedText = sanitizeInput(text);
        if (!sanitizedText.trim()) return null;

        const newMessage = {
            id: `m${Date.now()}`,
            channelId: sanitizeInput(channelId),
            senderId: sanitizeInput(senderId),
            text: sanitizedText,
            timestamp: new Date().toISOString()
        };
        
        this.saveDB({ ...this.db, messages: [...this.db.messages, newMessage] });
        return newMessage;
    }
}

// Export a singleton instance
export const state = new StateManager();
