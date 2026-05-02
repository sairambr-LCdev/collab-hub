import { db, auth, storage } from './firebase.js';
import { 
    collection, addDoc, updateDoc, doc, setDoc, getDoc, getDocs,
    onSnapshot, query, where, orderBy, serverTimestamp 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';

// --- Authentication & User Sync ---
const provider = new GoogleAuthProvider();

export const loginWithGoogle = async () => {
    try {
        const result = await signInWithPopup(auth, provider);
        await syncUser(result.user);
        return result.user;
    } catch (error) {
        console.error("Login Failed", error);
        throw error;
    }
};

export const logout = async () => {
    return signOut(auth);
};

const syncUser = async (user) => {
    const userRef = doc(db, "users", user.uid);
    await setDoc(userRef, {
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        lastActive: serverTimestamp()
    }, { merge: true });
};

export const getAllUsers = async () => {
    const snapshot = await getDocs(collection(db, "users"));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// --- Projects & Members ---
export const createProject = async (name, description, ownerId) => {
    const projectRef = await addDoc(collection(db, "projects"), {
        name,
        description,
        ownerId,
        members: [ownerId],
        createdAt: serverTimestamp()
    });
    
    // Auto-create a Project Group Chat
    await createConversation('project', name, [ownerId], projectRef.id);
    
    return projectRef;
};

export const addMemberToProject = async (projectId, userId) => {
    const projectRef = doc(db, "projects", projectId);
    const projectSnap = await getDoc(projectRef);
    const members = projectSnap.data().members || [];
    if (!members.includes(userId)) {
        await updateDoc(projectRef, {
            members: [...members, userId]
        });
        
        // Also add them to the Project Group Chat
        const q = query(collection(db, "conversations"), 
                        where("contextId", "==", projectId), 
                        where("type", "==", "project"));
        const chatSnap = await getDocs(q);
        if (!chatSnap.empty) {
            const chatDoc = chatSnap.docs[0];
            await updateDoc(doc(db, "conversations", chatDoc.id), {
                participants: [...chatDoc.data().participants, userId]
            });
        }
    }
};

export const subscribeToProjects = (userId, callback) => {
    const q = query(collection(db, "projects"), where("members", "array-contains", userId));
    return onSnapshot(q, (snapshot) => {
        const projects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(projects);
    });
};

// --- Tasks ---
export const createTask = async (projectId, title, assigneeId, estimatedHours) => {
    const taskRef = await addDoc(collection(db, "tasks"), {
        projectId,
        title,
        status: 'To Do',
        assigneeId,
        estimatedHours: Number(estimatedHours) || 0,
        timeLogged: 0,
        attachments: [],
        createdAt: serverTimestamp()
    });

    // Auto-create a Task Group Chat
    const participants = [auth.currentUser.uid];
    if (assigneeId && assigneeId !== auth.currentUser.uid) participants.push(assigneeId);
    
    await createConversation('task', `Task: ${title}`, participants, taskRef.id);
    
    return taskRef;
};

export const subscribeToTasks = (projectId, callback) => {
    if (!projectId) return callback([]);
    const q = query(collection(db, "tasks"), where("projectId", "==", projectId));
    return onSnapshot(q, (snapshot) => {
        const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(tasks);
    });
};

export const updateTaskStatus = async (taskId, newStatus) => {
    return updateDoc(doc(db, "tasks", taskId), { status: newStatus });
};

export const logTimeOnTask = async (taskId, currentLoggedTime, additionalHours) => {
    return updateDoc(doc(db, "tasks", taskId), { timeLogged: currentLoggedTime + Number(additionalHours) });
};

// --- Conversations & Messaging ---
export const createConversation = async (type, name, participants, contextId = null) => {
    // If DM, check if it already exists
    if (type === 'dm') {
        const q = query(collection(db, "conversations"), 
                        where("type", "==", "dm"), 
                        where("participants", "array-contains", participants[0]));
        const snap = await getDocs(q);
        const existing = snap.docs.find(d => d.data().participants.includes(participants[1]));
        if (existing) return existing.id;
    }

    const convRef = await addDoc(collection(db, "conversations"), {
        type, // 'dm', 'project', 'task', 'standalone'
        name,
        participants,
        contextId, // Stores projectId or taskId if applicable
        lastMessage: "",
        lastUpdatedAt: serverTimestamp()
    });
    return convRef.id;
};

export const subscribeToConversations = (userId, callback) => {
    const q = query(collection(db, "conversations"), 
                    where("participants", "array-contains", userId),
                    orderBy("lastUpdatedAt", "desc"));
    return onSnapshot(q, (snapshot) => {
        const convs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(convs);
    });
};

export const sendMessage = async (conversationId, text, senderId, senderName) => {
    await addDoc(collection(db, "messages"), {
        conversationId,
        text,
        senderId,
        senderName,
        createdAt: serverTimestamp()
    });
    
    // Update conversation preview
    return updateDoc(doc(db, "conversations", conversationId), {
        lastMessage: text,
        lastUpdatedAt: serverTimestamp()
    });
};

export const subscribeToMessages = (conversationId, callback) => {
    if (!conversationId) return callback([]);
    const q = query(collection(db, "messages"), 
                    where("conversationId", "==", conversationId), 
                    orderBy("createdAt", "asc"));
    return onSnapshot(q, (snapshot) => {
        const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(messages);
    });
};

// --- Storage ---
export const uploadAttachment = async (taskId, file) => {
    const storageRef = ref(storage, `tasks/${taskId}/${file.name}`);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return { name: file.name, url: downloadURL };
};

export const addAttachmentToTask = async (taskId, currentAttachments, newAttachment) => {
    return updateDoc(doc(db, "tasks", taskId), { 
        attachments: [...currentAttachments, newAttachment] 
    });
};
