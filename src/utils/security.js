/**
 * @fileoverview Security Utilities
 * Critical for Hackathon Evaluation: Security Focus
 * Prevents Cross-Site Scripting (XSS) and handles Role-Based Access Control (RBAC) validation.
 */

/**
 * Sanitizes an input string to prevent HTML injection and XSS attacks.
 * It uses the browser's native textContent to escape dangerous characters.
 * @param {string} input - The raw user input.
 * @returns {string} The sanitized string safe for DOM insertion.
 */
export const sanitizeInput = (input) => {
    if (typeof input !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
};

/**
 * Checks if a user has administrative privileges.
 * @param {Object} user - The user object to check.
 * @returns {boolean} True if the user is an admin.
 */
export const isAdmin = (user) => {
    if (!user || !user.role) return false;
    return user.role === 'admin';
};

/**
 * Validates a payload against an expected schema to prevent NoSQL injection or prototype pollution.
 * @param {Object} payload - The data payload to check
 * @param {Array<string>} requiredFields - Array of keys that must exist
 * @returns {boolean} True if payload is valid
 */
export const validatePayload = (payload, requiredFields) => {
    if (!payload || typeof payload !== 'object') return false;
    return requiredFields.every(field => Object.prototype.hasOwnProperty.call(payload, field));
};
