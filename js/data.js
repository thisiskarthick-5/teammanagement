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
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

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

export async function createUser(userData, selfRegister = false) {
    const currentUser = getCurrentUser();
    
    // If it's an admin provisioning a user, we save a temporary user in Firestore to be migrated on their first login.
    if (currentUser && currentUser.role === 'admin' && !selfRegister) {
        if (!userData.id) {
            const users = await getAllUsers();
            userData.id = `TM-${(users.length + 1).toString().padStart(3, '0')}`;
        }
        if (!userData.username) {
            const nameClean = userData.name.toLowerCase().replace(/[^a-z0-9]/g, '');
            const randomNum = Math.floor(100 + Math.random() * 900);
            userData.username = `${nameClean}${randomNum}`;
        }
        if (!userData.password) {
            const randomPart = Math.random().toString(36).substring(2, 8);
            userData.password = `ts-${randomPart}`;
        }
        userData.needsMigration = true;
        await setDoc(doc(db, COLLECTIONS.USERS, userData.id), userData);

        // Send mail notification with temporary credentials
        try {
            if (userData.email) {
                await sendMail({
                    toEmail: userData.email,
                    toName: userData.name,
                    subject: `Welcome to TEAMLINK! Your Account Credentials`,
                    bodyTitle: `Your profile has been created`,
                    bodyText: `Hello ${userData.name.split(' ')[0]},\n\nYour profile has been set up on TEAMLINK by your administrator.\n\nHere are your login credentials:\nUsername: ${userData.username}\nTemporary Password: ${userData.password}\n\nPlease sign in to activate your account.`,
                    actionUrl: 'index.html',
                    actionText: 'Sign In Now'
                });
            }
        } catch (mailErr) {
            console.error("Failed to send welcome mail notification:", mailErr);
        }
        return userData;
    } else {
        // Self registration (or migrated account)
        if (!userData.id) {
            throw new Error("User UID must be provided for registered accounts.");
        }
        if (!userData.username) {
            const nameClean = userData.name.toLowerCase().replace(/[^a-z0-9]/g, '');
            const randomNum = Math.floor(100 + Math.random() * 900);
            userData.username = `${nameClean}${randomNum}`;
        }
        await setDoc(doc(db, COLLECTIONS.USERS, userData.id), userData);
        return userData;
    }
}

export async function updateUser(userId, userData) {
    const userRef = doc(db, COLLECTIONS.USERS, userId);
    await setDoc(userRef, userData, { merge: true });

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

export async function logout() {
    await signOut(auth);
    localStorage.removeItem('teamSync_user');
    window.location.href = 'index.html';
}

// Secure User Login with Username or Email and automatic migration
export async function loginUser(usernameOrEmail, password) {
    const cleanInput = usernameOrEmail.trim().toLowerCase();
    
    // Fetch all users to match username/email and handle migration
    const allUsers = await getAllUsers();
    let userDoc = allUsers.find(u => u.email?.toLowerCase() === cleanInput || u.username?.toLowerCase() === cleanInput);
    
    if (!userDoc) {
        if (cleanInput.includes('@')) {
            // Direct Firebase Auth login if email
            const userCredential = await signInWithEmailAndPassword(auth, cleanInput, password);
            const freshDoc = await getUser(userCredential.user.uid);
            if (freshDoc) {
                setCurrentUser(freshDoc);
                return freshDoc;
            }
            // Create minimal doc if not exists in Firestore
            const minimalUser = {
                id: userCredential.user.uid,
                email: cleanInput,
                name: cleanInput.split('@')[0],
                username: cleanInput.split('@')[0],
                role: 'member',
                streak: 0,
                longestStreak: 0,
                avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(cleanInput)}`
            };
            await createUser(minimalUser, true);
            setCurrentUser(minimalUser);
            return minimalUser;
        } else {
            throw new Error("Invalid username or password.");
        }
    }

    const email = userDoc.email;
    const oldId = userDoc.id;

    // Check if migration of plain text credentials is required
    if (userDoc.password) {
        if (userDoc.password === password) {
            console.log(`Migrating user ${userDoc.username} to Firebase Auth...`);
            let userCredential;
            try {
                userCredential = await createUserWithEmailAndPassword(auth, email, password);
            } catch (authErr) {
                if (authErr.code === 'auth/email-already-in-use') {
                    userCredential = await signInWithEmailAndPassword(auth, email, password);
                } else {
                    throw authErr;
                }
            }

            const newUid = userCredential.user.uid;

            if (oldId !== newUid) {
                console.log(`Migrating Firestore document from ${oldId} to ${newUid}`);
                const newUserData = { ...userDoc, id: newUid };
                delete newUserData.password;
                delete newUserData.needsMigration;
                newUserData.authMigrated = true;

                await setDoc(doc(db, COLLECTIONS.USERS, newUid), newUserData);
                await runMigrationScript(oldId, newUid);
                await deleteDoc(doc(db, COLLECTIONS.USERS, oldId));
                userDoc = newUserData;
            } else {
                const newUserData = { ...userDoc };
                delete newUserData.password;
                delete newUserData.needsMigration;
                newUserData.authMigrated = true;
                await setDoc(doc(db, COLLECTIONS.USERS, newUid), newUserData);
                userDoc = newUserData;
            }

            setCurrentUser(userDoc);
            return userDoc;
        } else {
            throw new Error("Invalid username or password.");
        }
    }

    // Standard Firebase Auth sign-in
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const freshUserDoc = await getUser(userCredential.user.uid);
    if (!freshUserDoc) {
        throw new Error("Login successful, but profile could not be loaded.");
    }
    setCurrentUser(freshUserDoc);
    return freshUserDoc;
}

// User Registration wrapper
export async function registerUser(name, email, username, password, role) {
    const allUsers = await getAllUsers();
    if (allUsers.find(u => u.username?.toLowerCase() === username.trim().toLowerCase())) {
        throw new Error("Username is already taken.");
    }
    if (allUsers.find(u => u.email?.toLowerCase() === email.trim().toLowerCase())) {
        throw new Error("Email is already registered.");
    }

    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;

    const newUser = {
        id: uid,
        name,
        email,
        username: username.trim().toLowerCase(),
        role,
        streak: 0,
        longestStreak: 0,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`
    };

    await createUser(newUser, true);
    setCurrentUser(newUser);
    return newUser;
}

// Send password reset email
export async function sendPasswordReset(email) {
    await sendPasswordResetEmail(auth, email);
}

// Migration script to update all relations from old custom ID to Firebase UID
async function runMigrationScript(oldId, newUid) {
    console.log(`Running database migration: updating references from ${oldId} -> ${newUid}`);

    // Update Tasks
    try {
        const querySnapshot = await getDocs(collection(db, COLLECTIONS.TASKS));
        for (const docSnap of querySnapshot.docs) {
            const taskData = docSnap.data();
            if (taskData.assignedTo === oldId) {
                await updateDoc(doc(db, COLLECTIONS.TASKS, docSnap.id), { assignedTo: newUid });
            }
        }
    } catch (e) {
        console.error("Migration error (Tasks):", e);
    }

    // Update Attendance
    try {
        const attQuery = query(collection(db, COLLECTIONS.ATTENDANCE), where('userId', '==', oldId));
        const attSnap = await getDocs(attQuery);
        for (const docSnap of attSnap.docs) {
            const attData = docSnap.data();
            const date = attData.date;
            const newAttId = `${newUid}_${date}`;
            await setDoc(doc(db, COLLECTIONS.ATTENDANCE, newAttId), {
                ...attData,
                userId: newUid
            });
            await deleteDoc(doc(db, COLLECTIONS.ATTENDANCE, docSnap.id));
        }
    } catch (e) {
        console.error("Migration error (Attendance):", e);
    }

    // Update Notifications
    try {
        const notifQuery = query(collection(db, COLLECTIONS.NOTIFICATIONS), where('userId', '==', oldId));
        const notifSnap = await getDocs(notifQuery);
        for (const docSnap of notifSnap.docs) {
            await updateDoc(doc(db, COLLECTIONS.NOTIFICATIONS, docSnap.id), { userId: newUid });
        }
    } catch (e) {
        console.error("Migration error (Notifications):", e);
    }

    // Update Teams
    try {
        const teamsQuery = query(collection(db, 'teams'), where('createdBy', '==', oldId));
        const teamsSnap = await getDocs(teamsQuery);
        for (const docSnap of teamsSnap.docs) {
            await updateDoc(doc(db, 'teams', docSnap.id), { createdBy: newUid });
        }
    } catch (e) {
        console.error("Migration error (Teams):", e);
    }
}

// Session Synchronization Hook
onAuthStateChanged(auth, async (firebaseUser) => {
    const path = window.location.pathname;
    const isLoginPage = path.endsWith('index.html') || path.endsWith('/') || path === '';

    if (firebaseUser) {
        const localUser = getCurrentUser();
        if (!localUser || localUser.id !== firebaseUser.uid) {
            console.log("Synchronizing storage session with active Firebase Auth state...");
            const freshUser = await getUser(firebaseUser.uid);
            if (freshUser) {
                setCurrentUser(freshUser);
                if (isLoginPage) {
                    window.location.href = 'dashboard.html';
                } else {
                    window.dispatchEvent(new CustomEvent('userSynced'));
                }
            }
        } else {
            if (isLoginPage) {
                window.location.href = 'dashboard.html';
            }
        }
    } else {
        if (!isLoginPage) {
            console.log("No authenticated Firebase Auth session found. Ending local session...");
            localStorage.removeItem('teamSync_user');
            window.location.href = 'index.html';
        }
    }
});

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

    // Update local user object properties first
    user.teamId = teamId;
    user.teamName = teamName;
    user.role = 'admin';

    const userRef = doc(db, COLLECTIONS.USERS, user.id);
    // Use setDoc with merge: true so if the user profile document is missing in Firestore, it gets created with all details
    await setDoc(userRef, user, { merge: true });

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

    // Update local user object properties first
    user.teamId = teamData.id;
    user.teamName = teamData.name;
    user.role = 'member';

    const userRef = doc(db, COLLECTIONS.USERS, user.id);
    // Use setDoc with merge: true so if the user profile document is missing in Firestore, it gets created with all details
    await setDoc(userRef, user, { merge: true });

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

    // Update local user object properties first
    user.teamId = null;
    user.teamName = null;
    user.role = 'member';

    const userRef = doc(db, COLLECTIONS.USERS, user.id);
    // Use setDoc with merge: true so if the user profile document is missing in Firestore, it gets created with all details
    await setDoc(userRef, user, { merge: true });

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
