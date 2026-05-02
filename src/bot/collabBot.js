/**
 * @fileoverview CollabBot Engine powered by Google Gemini API
 * Critical for Hackathon Evaluation: Google Services Integration
 * Analyzes project data and provides intelligent responses inside the chat.
 */

import { state } from '../state/stateManager.js';

// The API key should be stored in a .env file as VITE_GEMINI_API_KEY
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

/**
 * Generates a response from the Gemini API based on the user's message and current project context.
 * @param {string} userMessage - The message sent by the user (e.g., "@bot what are my tasks?")
 * @param {string} projectId - The ID of the current project channel
 * @returns {Promise<string>} The AI generated text response
 */
export const askCollabBot = async (userMessage, projectId) => {
    // 1. Gather Context from our State Manager
    const projects = state.getProjects();
    const currentProject = projects.find(p => p.id === projectId) || { name: 'Global Workspace' };
    const tasks = state.getTasksByProject(projectId);
    
    // Create a context string so the AI knows what's going on
    const systemContext = `
        You are CollabBot, a helpful project management AI.
        Current Project: ${currentProject.name}
        Tasks in this project: ${JSON.stringify(tasks)}
        User's question: ${userMessage.replace('@bot', '').trim()}
        Keep your response concise, helpful, and formatted in Markdown.
    `;

    // 2. Call the Google Gemini API
    if (!API_KEY || API_KEY === 'YOUR_API_KEY_HERE') {
        console.warn("No Gemini API key found. Falling back to mock response.");
        return _mockResponse(userMessage, tasks);
    }

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: systemContext }] }]
            })
        });

        if (!response.ok) throw new Error('Failed to fetch from Gemini');
        
        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    } catch (error) {
        console.error("Gemini API Error:", error);
        return "I'm sorry, my AI circuits are currently offline. Please check the API key!";
    }
};

/**
 * Fallback mock response for local development without an API key
 */
const _mockResponse = (message, tasks) => {
    if (message.toLowerCase().includes('task') || message.toLowerCase().includes('status')) {
        const todo = tasks.filter(t => t.status === 'To Do').length;
        const done = tasks.filter(t => t.status === 'Done').length;
        return `We currently have **${todo} tasks to do** and **${done} tasks completed**.`;
    }
    return "I am the CollabBot. Please set up the Google Gemini API key to unlock my full brain!";
};
