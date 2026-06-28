import React, { createContext, useContext, useEffect, useState } from 'react';
import { db, isPlaceholder } from '@/src/lib/firebase';
import { doc, getDocs, setDoc, collection, deleteDoc } from 'firebase/firestore';

interface UserData {
  uid: string;
  studentId: string;
  name: string;
  nickname?: string;
  password?: string;
  code?: string;
  role: 'user' | 'admin';
  status: 'approved';
  isProfileComplete: boolean;
  isPrivate?: boolean;
  selectedSubjects?: string[];
}

interface AuthContextType {
  user: { uid: string } | null;
  userData: UserData | null;
  loading: boolean;
  loginWithID: (id: string, pass: string) => Promise<void>;
  loginWithCode: (code: string) => Promise<void>;
  setupPassword: (password: string) => Promise<void>;
  updateProfileName: (name: string) => Promise<void>;
  updateProfileNickname: (nickname: string) => Promise<void>;
  togglePrivacy: () => Promise<void>;
  saveSelectedSubjects: (subjects: string[]) => Promise<void>;
  resetDatabase: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'exam_app_session';
const USERS_DB_KEY = 'exam_app_users_db';
const RESULTS_DB_KEY = 'exam_app_results_db';

// Deterministic hash to generate a secure and elegant 4-character invite code
function getDeterministicHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) & 0xffffffff;
  }
  const hashValue = Math.abs(hash);
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let result = '';
  let temp = hashValue;
  for (let i = 0; i < 4; i++) {
    result += chars[temp % chars.length];
    temp = Math.floor(temp / chars.length);
  }
  return result;
}

// Dynamically generate the 434 students of Grade 2
const generatePredefinedStudents = (): { studentId: string; name: string; code: string }[] => {
  const students: { studentId: string; name: string; code: string }[] = [];
  
  // 1. 20n01 ~ 20n31 (n is 1 to 9)
  for (let n = 1; n <= 9; n++) {
    for (let idx = 1; idx <= 31; idx++) {
      const classStr = n.toString();
      const idxStr = idx.toString().padStart(2, '0');
      const studentNum = `20${classStr}${idxStr}`; // e.g., 20101
      const studentId = `26-${studentNum}`;
      const hash = getDeterministicHash(studentId);
      const code = `CD26-${studentNum}-${hash}`;
      students.push({ studentId, name: '', code });
    }
  }
  
  // 2. 21m01 ~ 21m31 (m is 0 to 4)
  for (let m = 0; m <= 4; m++) {
    for (let idx = 1; idx <= 31; idx++) {
      const classStr = m.toString();
      const idxStr = idx.toString().padStart(2, '0');
      const studentNum = `21${classStr}${idxStr}`; // e.g., 21001
      const studentId = `26-${studentNum}`;
      const hash = getDeterministicHash(studentId);
      const code = `CD26-${studentNum}-${hash}`;
      students.push({ studentId, name: '', code });
    }
  }
  
  return students;
};

const PREDEFINED_STUDENTS = generatePredefinedStudents();

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<{ uid: string } | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function initAuth() {
      try {
        // Initialize DB with fixed accounts if empty or not fully populated
        const localDb = getInternalDB();
        const adminId = '26-20411';
        const cleanDB: Record<string, UserData> = {};

        const defaultSubjects = ['exam-speech-lang', 'exam-english1', 'exam-algebra', 'exam-physics', 'exam-earth', 'exam-ai-basics'];

        // Try fetching all users from Firestore if available
        let firestoreUsers: Record<string, UserData> = {};
        if (!isPlaceholder && db) {
          try {
            const querySnap = await getDocs(collection(db, 'users'));
            querySnap.forEach((doc) => {
              firestoreUsers[doc.id] = doc.data() as UserData;
            });
          } catch (e) {
            console.error("Failed to load users from Firestore", e);
          }
        }

        // Keep / Initialize Admin
        const combinedAdmin = firestoreUsers[adminId] || localDb[adminId];
        if (combinedAdmin) {
          cleanDB[adminId] = {
            ...combinedAdmin,
            role: 'admin',
            password: combinedAdmin.password || '26-20411'
          };
        } else {
          cleanDB[adminId] = {
            uid: adminId,
            studentId: adminId,
            name: '관리자 (Admin)',
            role: 'admin',
            status: 'approved',
            isProfileComplete: true,
            selectedSubjects: defaultSubjects,
            password: '26-20411'
          };
        }

        // Initialize students of Class 2-1
        PREDEFINED_STUDENTS.forEach(student => {
          const sid = student.studentId;
          const combinedStudent = firestoreUsers[sid] || localDb[sid];
          if (combinedStudent) {
            // Keep registered student data
            cleanDB[sid] = {
              ...combinedStudent,
              uid: sid,
              studentId: sid,
              name: student.name || combinedStudent.name || '',
              code: student.code,
              role: 'user',
              status: 'approved',
            };
          } else {
            cleanDB[sid] = {
              uid: sid,
              studentId: sid,
              name: student.name,
              code: student.code,
              role: 'user',
              status: 'approved',
              isProfileComplete: false,
              // Password remains empty until registered via their Code!
              password: '', 
              selectedSubjects: [],
            };
          }
        });

        // Completely overwrite user DB with ONLY admin and the predefined 30 students!
        // This deletes any other unregistered, unapproved or raw dummy accounts.
        localStorage.setItem(USERS_DB_KEY, JSON.stringify(cleanDB));

        const savedSession = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (savedSession) {
          try {
            let data = JSON.parse(savedSession) as UserData;
            const freshData = cleanDB[data.uid];
            
            if (freshData) {
              // Restore fresh profile complete status and subjects
              setUser({ uid: freshData.uid });
              setUserData(freshData);
            } else {
              // If the user in session is deleted (not part of the 30 allowed students or admin)
              localStorage.removeItem(LOCAL_STORAGE_KEY);
            }
          } catch (e) {
            console.warn("Session restore failed", e);
            localStorage.removeItem(LOCAL_STORAGE_KEY);
          }
        }
      } catch (e) {
        console.error("Auth initialization fatal error", e);
      } finally {
        setLoading(false);
      }
    }
    initAuth();
  }, []);

  const getInternalDB = (): Record<string, UserData> => {
    try {
      const dbStr = localStorage.getItem(USERS_DB_KEY);
      return dbStr ? JSON.parse(dbStr) : {};
    } catch (e) {
      console.warn("DB restore failed", e);
      return {};
    }
  };

  const saveToInternalDB = (data: UserData) => {
    const db = getInternalDB();
    db[data.uid] = data;
    localStorage.setItem(USERS_DB_KEY, JSON.stringify(db));
  };

  const loginWithID = async (id: string, pass: string) => {
    let cleanId = id.trim().toUpperCase();
    if (!cleanId) throw new Error('학번을 입력해 주세요.');

    // Auto prepends 26- if user inputs standard 5-digit student ID like 20101
    if (/^\d{5}$/.test(cleanId)) {
      cleanId = `26-${cleanId}`;
    }

    const db = getInternalDB();
    const existingUser = db[cleanId];

    if (!existingUser) {
      throw new Error('등록되지 않은 학번이거나 본 학급 학생이 아닙니다.');
    }

    const isAdminId = cleanId === '26-20411' || cleanId === 'ADMIN-MASTER';

    if (isAdminId) {
      if (existingUser.password !== pass) {
        throw new Error('비밀번호가 일치하지 않습니다.');
      }
      const userToSet = { ...existingUser, role: 'admin' as const };
      setSession(userToSet);
      return;
    }

    // Student Login
    if (!existingUser.password) {
      throw new Error("최초 접속자입니다. 상단의 '인증 코드로 입장'을 통해 할당받은 인증 코드로 최초 접속하여 비밀번호를 설정해 주시기 바랍니다.");
    }

    if (existingUser.password !== pass) {
      throw new Error('비밀번호가 일치하지 않습니다.');
    }

    setSession(existingUser);
  };

  const loginWithCode = async (code: string) => {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) throw new Error('코드를 입력해 주세요.');
    
    // Find user by code in DB
    const db = getInternalDB();
    const targetUser = Object.values(db).find(u => u.code === cleanCode);

    if (!targetUser) {
      throw new Error('유효하지 않은 가입용 코드입니다. 올바른 할당 코드를 입력해 주세요.');
    }

    if (targetUser.password && targetUser.password.trim() !== '') {
      throw new Error('이미 회원가입 및 비밀번호 설정이 완료된 코드입니다. 학번과 비밀번호로 로그인해 주시기 바랍니다.');
    }

    setSession(targetUser);
  };

  const setSession = async (data: UserData) => {
    setUser({ uid: data.uid });
    setUserData(data);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
    saveToInternalDB(data);

    // Synchronize to Firestore for cross-account/cross-device visibility
    if (!isPlaceholder && db) {
      try {
        await setDoc(doc(db, 'users', data.uid), data, { merge: true });
      } catch (e) {
        console.error("Failed to sync user session to Firestore", e);
      }
    }
  };

  const setupPassword = async (password: string) => {
    if (!userData) throw new Error('세션이 만료되었습니다.');
    
    const hasSubjects = userData.selectedSubjects && userData.selectedSubjects.length > 0;
    const updated: UserData = {
      ...userData,
      password: password,
      isProfileComplete: !!hasSubjects
    };
    setSession(updated);
  };

  const updateProfileName = async (newName: string) => {
    if (!userData) throw new Error('세션이 만료되었습니다.');
    const updated: UserData = {
      ...userData,
      name: newName
    };
    setSession(updated);
  };

  const updateProfileNickname = async (newNickname: string) => {
    if (!userData) throw new Error('세션이 만료되었습니다.');
    const updated: UserData = {
      ...userData,
      nickname: newNickname
    };
    setSession(updated);
  };

  const togglePrivacy = async () => {
    if (!userData) throw new Error('세션이 만료되었습니다.');
    const updated: UserData = {
      ...userData,
      isPrivate: !userData.isPrivate
    };
    setSession(updated);
  };

  const saveSelectedSubjects = async (subjects: string[]) => {
    if (!userData) throw new Error('세션이 만료되었습니다.');
    const hasPassword = !!(userData.password || '').trim();
    const updated: UserData = {
      ...userData,
      selectedSubjects: subjects,
      isProfileComplete: hasPassword
    };
    setSession(updated);
  };

  const resetDatabase = async () => {
    // 1. Clear Local Storage
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    localStorage.removeItem(USERS_DB_KEY);
    localStorage.removeItem(RESULTS_DB_KEY);
    localStorage.removeItem('exam_app_real_submissions_v3');
    localStorage.removeItem('exam_user_votes_v3');
    localStorage.removeItem('exam_votes_stats_v3');
    
    // 2. Firestore reset (if not placeholder)
    if (!isPlaceholder && db) {
      try {
        // Clear users collection except Admin
        const usersSnap = await getDocs(collection(db, 'users'));
        for (const docObj of usersSnap.docs) {
          if (docObj.id !== '26-20411') {
            await deleteDoc(docObj.ref);
          }
        }
        
        // Clear submissions for all 8 exams
        const examIds = [
          'exam-speech-lang',
          'exam-algebra',
          'exam-english1',
          'exam-physics',
          'exam-chemistry',
          'exam-earth',
          'exam-ai-basics',
          'exam-ai-math'
        ];
        
        for (const examId of examIds) {
          try {
            const subsSnap = await getDocs(collection(db, 'exams', examId, 'submissions'));
            for (const docObj of subsSnap.docs) {
              await deleteDoc(docObj.ref);
            }
          } catch (e) {
            console.error(`Failed to clear submissions for ${examId}:`, e);
          }
        }
      } catch (e) {
        console.error("Firestore database reset failed:", e);
        throw e;
      }
    }
    
    // Reload to force re-initialization
    window.location.href = '/login';
  };

  const logout = () => {
    setUser(null);
    setUserData(null);
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      userData, 
      loading, 
      loginWithID, 
      loginWithCode,
      setupPassword,
      updateProfileName,
      updateProfileNickname,
      togglePrivacy,
      saveSelectedSubjects,
      resetDatabase,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
