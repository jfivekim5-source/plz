import React, { createContext, useContext, useEffect, useState } from 'react';

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
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'exam_app_session';
const USERS_DB_KEY = 'exam_app_users_db';
const RESULTS_DB_KEY = 'exam_app_results_db';

// PREDEFINED_STUDENTS lists 30 students of 2학년 1반 (Grade 2 Class 1)
const PREDEFINED_STUDENTS = [
  { studentId: '26-20101', name: '', code: 'CD26-20101-7A39' },
  { studentId: '26-20102', name: '', code: 'CD26-20102-4D91' },
  { studentId: '26-20103', name: '', code: 'CD26-20103-6E82' },
  { studentId: '26-20104', name: '', code: 'CD26-20104-5C29' },
  { studentId: '26-20105', name: '', code: 'CD26-20105-8B74' },
  { studentId: '26-20106', name: '', code: 'CD26-20106-2F10' },
  { studentId: '26-20107', name: '', code: 'CD26-20107-9H53' },
  { studentId: '26-20108', name: '', code: 'CD26-20108-3K81' },
  { studentId: '26-20109', name: '', code: 'CD26-20109-1A92' },
  { studentId: '26-20110', name: '', code: 'CD26-20110-5X47' },
  { studentId: '26-20111', name: '', code: 'CD26-20111-9V63' },
  { studentId: '26-20112', name: '', code: 'CD26-20112-2M84' },
  { studentId: '26-20113', name: '', code: 'CD26-20113-7L39' },
  { studentId: '26-20114', name: '', code: 'CD26-20114-4R18' },
  { studentId: '26-20115', name: '', code: 'CD26-20115-8D62' },
  { studentId: '26-20116', name: '', code: 'CD26-20116-3T95' },
  { studentId: '26-20117', name: '', code: 'CD26-20117-6N54' },
  { studentId: '26-20118', name: '', code: 'CD26-20118-1W82' },
  { studentId: '26-20119', name: '', code: 'CD26-20119-9Y73' },
  { studentId: '26-20120', name: '', code: 'CD26-20120-2S41' },
  { studentId: '26-20121', name: '', code: 'CD26-20121-5G29' },
  { studentId: '26-20122', name: '', code: 'CD26-20122-8H47' },
  { studentId: '26-20123', name: '', code: 'CD26-20123-3K19' },
  { studentId: '26-20124', name: '', code: 'CD26-20124-7P83' },
  { studentId: '26-20125', name: '', code: 'CD26-20125-1Q54' },
  { studentId: '26-20126', name: '', code: 'CD26-20126-6C62' },
  { studentId: '26-20127', name: '', code: 'CD26-20127-9X18' },
  { studentId: '26-20128', name: '', code: 'CD26-20128-4J27' },
  { studentId: '26-20129', name: '', code: 'CD26-20129-8N39' },
  { studentId: '26-20130', name: '', code: 'CD26-20130-2Z74' },
];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<{ uid: string } | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      // Initialize DB with fixed accounts if empty or not fully populated
      const db = getInternalDB();
      const adminId = '26-20411';
      const cleanDB: Record<string, UserData> = {};

      const defaultSubjects = ['exam-speech-lang', 'exam-english1', 'exam-algebra', 'exam-physics', 'exam-earth', 'exam-ai-basics'];

      // Keep / Initialize Admin
      if (db[adminId]) {
        cleanDB[adminId] = {
          ...db[adminId],
          role: 'admin',
          password: db[adminId].password || '26-20411'
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
        if (db[sid]) {
          // Keep registered student data
          cleanDB[sid] = {
            ...db[sid],
            uid: sid,
            studentId: sid,
            name: student.name,
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
          const currentDB = cleanDB;
          const freshData = currentDB[data.uid];
          
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
    }
    setLoading(false);
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
      throw new Error("최초 가입자입니다. 하단의 '인증 코드로 로그인'을 통해 할당받은 인증 코드로 최초 접속하여 비밀번호를 설정해 주시기 바랍니다.");
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

    setSession(targetUser);
  };

  const setSession = (data: UserData) => {
    setUser({ uid: data.uid });
    setUserData(data);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
    saveToInternalDB(data);
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
