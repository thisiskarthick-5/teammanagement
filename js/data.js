import { db, auth } from './firebase-config.js';
import { sendMail } from './mail-helper.js';
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
    orderBy,
    onSnapshot,
    deleteDoc
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
    // Generate a username if not provided
    if (!userData.username) {
        const nameClean = userData.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const randomNum = Math.floor(100 + Math.random() * 900);
        userData.username = `${nameClean}${randomNum}`;
    }
    // Generate a password if not provided
    if (!userData.password) {
        const randomPart = Math.random().toString(36).substring(2, 8);
        userData.password = `ts-${randomPart}`;
    }
    await setDoc(doc(db, COLLECTIONS.USERS, userData.id), userData);

    // Send mail notification to the new user with credentials
    try {
        if (userData.email) {
            await sendMail({
                toEmail: userData.email,
                toName: userData.name,
                subject: `Welcome to TEAMLINK! Your Account Credentials`,
                bodyTitle: `Your profile has been created`,
                bodyText: `Hello ${userData.name.split(' ')[0]},\n\nYour profile has been set up on TEAMLINK by your administrator.\n\nHere are your login credentials:\nUsername/Email: ${userData.email}\nPassword: ${userData.password}\n\nPlease keep these credentials secure.`,
                actionUrl: 'index.html',
                actionText: 'Sign In Now'
            });
        }
    } catch (mailErr) {
        console.error("Failed to send welcome mail notification:", mailErr);
    }

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
    const user = getCurrentUser();
    const docRef = await addDoc(collection(db, COLLECTIONS.TASKS), {
        ...taskData,
        teamId: user ? user.teamId : null,
        status: 'Not Started',
        createdAt: new Date().toISOString()
    });

    // Send mail notification to assignee
    try {
        if (taskData.assignedTo) {
            const assignee = await getUser(taskData.assignedTo);
            if (assignee && assignee.email) {
                await sendMail({
                    toEmail: assignee.email,
                    toName: assignee.name,
                    subject: `New Task Assigned: ${taskData.title}`,
                    bodyTitle: `You have been assigned a new task`,
                    bodyText: `Hello ${assignee.name.split(' ')[0]},\n\nYou have been assigned a new task on TEAMLINK.\n\nTask: ${taskData.title}\nPriority: ${taskData.priority}\nDeadline: ${taskData.deadline}\n\nPlease check your tasks list in the app.`,
                    actionUrl: 'tasks.html',
                    actionText: 'View Tasks'
                });
            }
        }
    } catch (mailErr) {
        console.error("Failed to send assignment mail notification:", mailErr);
    }

    return { id: docRef.id, ...taskData, teamId: user ? user.teamId : null };
}

export async function getTasks(filters = {}) {
    const q = collection(db, COLLECTIONS.TASKS);
    const querySnapshot = await getDocs(q);
    let tasks = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const user = getCurrentUser();
    if (user && user.teamId) {
        tasks = tasks.filter(t => t.teamId === user.teamId);
    }
    if (filters.assignedTo) {
        tasks = tasks.filter(t => t.assignedTo === filters.assignedTo);
    }
    return tasks;
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

    // Send mail notification to assignee
    try {
        const assignee = await getUser(userId);
        if (assignee && assignee.email) {
            await sendMail({
                toEmail: assignee.email,
                toName: assignee.name,
                subject: `Task Approved: ${taskTitle}`,
                bodyTitle: `Your task submission has been approved!`,
                bodyText: `Hello ${assignee.name.split(' ')[0]},\n\nGreat job! Your submission for the task "${taskTitle}" has been verified and approved. Your activity streak has been updated.`,
                actionUrl: `profile.html?id=${userId}`,
                actionText: 'View Portfolio'
            });
        }
    } catch (mailErr) {
        console.error("Failed to send approval mail notification:", mailErr);
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

    // Send mail notification to assignee
    try {
        const assignee = await getUser(userId);
        if (assignee && assignee.email) {
            await sendMail({
                toEmail: assignee.email,
                toName: assignee.name,
                subject: `Revision Required: ${taskTitle}`,
                bodyTitle: `Revision requested for your task submission`,
                bodyText: `Hello ${assignee.name.split(' ')[0]},\n\nThe reviewer has requested changes for the task "${taskTitle}".\n\nFeedback:\n"${message}"\n\nPlease revise your work and re-submit.`,
                actionUrl: 'tasks.html',
                actionText: 'View Tasks'
            });
        }
    } catch (mailErr) {
        console.error("Failed to send rejection mail notification:", mailErr);
    }
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

export async function markAttendanceForDate(userId, date, status = 'Present') {
    const attendanceId = `${userId}_${date}`;
    const attendanceRef = doc(db, COLLECTIONS.ATTENDANCE, attendanceId);
    
    const snap = await getDoc(attendanceRef);
    if (snap.exists()) return false;
    
    await setDoc(attendanceRef, {
        userId,
        date,
        time: new Date().toLocaleTimeString(),
        status
    });

    // Update streak if marking for today
    const today = new Date().toISOString().split('T')[0];
    if (date === today) {
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
    }
    return true;
}

export async function removeAttendanceForDate(userId, date) {
    const attendanceId = `${userId}_${date}`;
    const attendanceRef = doc(db, COLLECTIONS.ATTENDANCE, attendanceId);
    
    const snap = await getDoc(attendanceRef);
    if (!snap.exists()) return false;
    
    await deleteDoc(attendanceRef);

    // Update streak if removing for today
    const today = new Date().toISOString().split('T')[0];
    if (date === today) {
        const userRef = doc(db, COLLECTIONS.USERS, userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            const userData = userSnap.data();
            const newStreak = Math.max(0, (userData.streak || 0) - 1);
            await updateDoc(userRef, {
                streak: newStreak
            });
        }
    }
    return true;
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

// --- Team & Chat Logic ---

// Helper to generate a random 6-character code
function generateTeamCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

export async function createTeam(teamName) {
    const user = getCurrentUser();
    if (!user) throw new Error("No authenticated user.");

    const code = generateTeamCode();
    const teamRef = doc(collection(db, 'teams'));
    const teamId = teamRef.id;

    const teamData = {
        id: teamId,
        name: teamName,
        code: code,
        createdBy: user.id,
        createdAt: new Date().toISOString()
    };

    await setDoc(teamRef, teamData);

    const userRef = doc(db, COLLECTIONS.USERS, user.id);
    await updateDoc(userRef, {
        teamId: teamId,
        teamName: teamName,
        role: 'admin'
    });

    user.teamId = teamId;
    user.teamName = teamName;
    user.role = 'admin';
    setCurrentUser(user);

    return teamData;
}

export async function joinTeam(inviteCode) {
    const user = getCurrentUser();
    if (!user) throw new Error("No authenticated user.");

    const q = query(collection(db, 'teams'), where('code', '==', inviteCode.trim().toUpperCase()));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        throw new Error("Invalid team invite code. Team not found.");
    }

    const teamDoc = querySnapshot.docs[0];
    const teamData = teamDoc.data();

    const userRef = doc(db, COLLECTIONS.USERS, user.id);
    await updateDoc(userRef, {
        teamId: teamData.id,
        teamName: teamData.name,
        role: 'member'
    });

    user.teamId = teamData.id;
    user.teamName = teamData.name;
    user.role = 'member';
    setCurrentUser(user);

    return teamData;
}

export async function getTeamDetails(teamId) {
    if (!teamId) return null;
    const docRef = doc(db, 'teams', teamId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
}

export async function getTeamMembers(teamId) {
    if (!teamId) return [];
    const q = query(collection(db, COLLECTIONS.USERS), where('teamId', '==', teamId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function leaveTeam() {
    const user = getCurrentUser();
    if (!user) return;

    const userRef = doc(db, COLLECTIONS.USERS, user.id);
    await updateDoc(userRef, {
        teamId: null,
        teamName: null,
        role: 'member'
    });

    user.teamId = null;
    user.teamName = null;
    user.role = 'member';
    setCurrentUser(user);
}

export async function deleteTeam(teamId) {
    const user = getCurrentUser();
    if (!user || user.role !== 'admin') return;

    const members = await getTeamMembers(teamId);
    for (const member of members) {
        const memberRef = doc(db, COLLECTIONS.USERS, member.id);
        await updateDoc(memberRef, {
            teamId: null,
            teamName: null,
            role: 'member'
        });
    }

    const teamRef = doc(db, 'teams', teamId);
    await deleteDoc(teamRef);

    user.teamId = null;
    user.teamName = null;
    user.role = 'member';
    setCurrentUser(user);
}

export async function sendChatMessage(teamId, messageText) {
    const user = getCurrentUser();
    if (!user) throw new Error("No authenticated user.");

    const messagesCol = collection(db, 'teams', teamId, 'messages');
    await addDoc(messagesCol, {
        senderId: user.id,
        senderName: user.name,
        senderAvatar: user.avatar,
        text: messageText,
        createdAt: new Date().toISOString()
    });
}

export function subscribeToChatMessages(teamId, callback) {
    const messagesCol = collection(db, 'teams', teamId, 'messages');
    const q = query(messagesCol, orderBy('createdAt', 'asc'));
    return onSnapshot(q, (snapshot) => {
        const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(messages);
    });
}
