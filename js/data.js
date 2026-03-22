import { db, auth } from './firebase-config.js';
import {
    collection,
    addDoc,
    getDocs,
    getDoc,
    doc,
    setDoc,
    updateDoc,
    query,
    where,
    orderBy
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const COLLECTIONS = {
    USERS: 'users',
    TASKS: 'tasks',
    ATTENDANCE: 'attendance',
    SUBMISSIONS: 'submissions',
    NOTIFICATIONS: 'notifications'
};

// --- User Logic ---

export async function getUser(userId) {
    const docRef = doc(db, COLLECTIONS.USERS, userId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
}

export async function getAllUsers() {
    const querySnapshot = await getDocs(collection(db, COLLECTIONS.USERS));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function createUser(userData) {
    // Generate a TM-ID if not provided
    if (!userData.id) {
        const users = await getAllUsers();
        userData.id = `TM-${(users.length + 1).toString().padStart(3, '0')}`;
    }
    await setDoc(doc(db, COLLECTIONS.USERS, userData.id), userData);
    return userData;
}

export async function updateUser(userId, userData) {
    const userRef = doc(db, COLLECTIONS.USERS, userId);
    await updateDoc(userRef, userData);

    // Update local storage if it's the current user
    const currentUser = JSON.parse(localStorage.getItem('teamSync_user'));
    if (currentUser && currentUser.id === userId) {
        localStorage.setItem('teamSync_user', JSON.stringify({ ...currentUser, ...userData }));
    }
}

// --- Task Logic ---

export async function createTask(taskData) {
    const docRef = await addDoc(collection(db, COLLECTIONS.TASKS), {
        ...taskData,
        status: 'Not Started',
        createdAt: new Date().toISOString()
    });
    return { id: docRef.id, ...taskData };
}

export async function getTasks(filters = {}) {
    let q = collection(db, COLLECTIONS.TASKS);
    if (filters.assignedTo) {
        q = query(q, where('assignedTo', '==', filters.assignedTo));
    }
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function updateTaskStatus(taskId, status, submission = null) {
    const taskRef = doc(db, COLLECTIONS.TASKS, taskId);
    const updateData = { status };
    if (submission) updateData.submission = submission;
    await updateDoc(taskRef, updateData);
}

export async function submitTaskProof(taskId, submissionData) {
    const taskRef = doc(db, COLLECTIONS.TASKS, taskId);
    await updateDoc(taskRef, {
        status: 'Completed',
        submission: {
            ...submissionData,
            status: 'Pending'
        }
    });
}

export async function approveTask(taskId, userId) {
    const taskRef = doc(db, COLLECTIONS.TASKS, taskId);
    const taskSnap = await getDoc(taskRef);
    const taskTitle = taskSnap.exists() ? taskSnap.data().title : 'Task';

    await updateDoc(taskRef, {
        status: 'Approved',
        'submission.status': 'Approved'
    });

    // Notify user
    await createNotification({
        userId,
        type: 'approval',
        message: `Your work on '${taskTitle}' has been approved! Streak updated.`,
        taskId,
        taskTitle,
        createdAt: new Date().toISOString(),
        read: false
    });

    // Update user streak
    const userRef = doc(db, COLLECTIONS.USERS, userId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
        const userData = userSnap.data();
        const newStreak = (userData.streak || 0) + 1;
        await updateDoc(userRef, {
            streak: newStreak,
            longestStreak: Math.max(newStreak, userData.longestStreak || 0)
        });
    }
}

export async function rejectTask(taskId, userId, message) {
    const taskRef = doc(db, COLLECTIONS.TASKS, taskId);
    const taskSnap = await getDoc(taskRef);
    const taskTitle = taskSnap.exists() ? taskSnap.data().title : 'Task';

    await updateDoc(taskRef, {
        status: 'Action Required',
        'submission.status': 'Rejected',
        'submission.feedback': message
    });

    // Notify user
    await createNotification({
        userId,
        type: 'query',
        message: `Changes requested for '${taskTitle}': ${message}`,
        taskId,
        taskTitle,
        createdAt: new Date().toISOString(),
        read: false
    });
}

// --- Notification Logic ---

export async function createNotification(notificationData) {
    await addDoc(collection(db, COLLECTIONS.NOTIFICATIONS), notificationData);
}

export async function getNotifications(userId) {
    const q = query(
        collection(db, COLLECTIONS.NOTIFICATIONS),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function markNotificationAsRead(notificationId) {
    const ref = doc(db, COLLECTIONS.NOTIFICATIONS, notificationId);
    await updateDoc(ref, { read: true });
}

// --- Attendance Logic ---

export async function markAttendance(userId) {
    const today = new Date().toISOString().split('T')[0];
    const attendanceId = `${userId}_${today}`;
    const attendanceRef = doc(db, COLLECTIONS.ATTENDANCE, attendanceId);

    const snap = await getDoc(attendanceRef);
    if (snap.exists()) return false;

    await setDoc(attendanceRef, {
        userId,
        date: today,
        time: new Date().toLocaleTimeString(),
        status: 'Present'
    });

    // Boost streak for attendance
    const userRef = doc(db, COLLECTIONS.USERS, userId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
        const userData = userSnap.data();
        const newStreak = (userData.streak || 0) + 1;
        await updateDoc(userRef, {
            streak: newStreak,
            longestStreak: Math.max(newStreak, userData.longestStreak || 0),
            lastActive: today
        });
    }
    return true;
}

export async function getAttendance(userId) {
    const q = query(collection(db, COLLECTIONS.ATTENDANCE), where('userId', '==', userId));
    const snap = await getDocs(q);
    return snap.docs.map(doc => doc.data());
}

export async function getAllAttendance() {
    const querySnapshot = await getDocs(collection(db, COLLECTIONS.ATTENDANCE));
    return querySnapshot.docs.map(doc => doc.data());
}

// --- Auth Utilities ---
export function setCurrentUser(user) {
    localStorage.setItem('teamSync_user', JSON.stringify(user));
}

export function getCurrentUser() {
    return JSON.parse(localStorage.getItem('teamSync_user'));
}

export function logout() {
    localStorage.removeItem('teamSync_user');
    window.location.href = 'index.html';
}
