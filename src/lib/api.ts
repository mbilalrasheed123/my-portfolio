import { 
  db, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  serverTimestamp,
  handleFirestoreError,
  OperationType
} from "../firebase";

// API utility with explicit fetch functions and graceful error handling
export const api = {
  // Generic list fetcher with graceful fallback to empty array on error
  async fetchList(collectionName: string) {
    try {
      const q = query(collection(db, collectionName), orderBy("order", "asc"));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
    } catch (error) {
      console.warn(`Failed to fetch ${collectionName} with order, trying without:`, error);
      try {
        const snapshot = await getDocs(collection(db, collectionName));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      } catch (innerError) {
        console.error(`Gracefully handled fetch failure for ${collectionName}:`, innerError);
        return []; // Return empty list instead of crashing
      }
    }
  },

  async fetchProjects() {
    return this.fetchList("projects");
  },

  async fetchCertificates() {
    return this.fetchList("certificates");
  },

  async fetchSkills() {
    return this.fetchList("skills");
  },

  async fetchExperience() {
    return this.fetchList("experience");
  },

  async fetchSettings() {
    const DEFAULT_SETTINGS = {
      name: "Bilal Rasheed",
      title: "Full Stack Developer",
      aboutText: "Welcome to my professional portfolio.",
      email: "muhammadbilalrasheed78@gmail.com"
    };

    try {
      const docRef = doc(db, "settings", "global");
      const snapshot = await getDoc(docRef);
      return snapshot.exists() ? snapshot.data() : DEFAULT_SETTINGS;
    } catch (error) {
      console.error("Failed to fetch settings from Firebase, using default fallback:", error);
      return DEFAULT_SETTINGS;
    }
  },

  // Legacy compatibility and Mutations
  async get(collectionName: string) { return this.fetchList(collectionName); },
  async getSettings() { return this.fetchSettings(); },

  async post(collectionName: string, data: any) {
    try {
      const payload: any = {
        ...data,
        updatedAt: serverTimestamp(),
      };
      
      if (collectionName === "contactMessages") {
        payload.timestamp = serverTimestamp();
      } else {
        payload.createdAt = serverTimestamp();
      }
      
      const docRef = await addDoc(collection(db, collectionName), payload);
      return { id: docRef.id };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, collectionName);
    }
  },

  async put(collectionName: string, id: string, data: any) {
    try {
      const docRef = doc(db, collectionName, id);
      await updateDoc(docRef, { ...data, updatedAt: serverTimestamp() });
      return { id };
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${collectionName}/${id}`);
    }
  },

  async delete(collectionName: string, id: string) {
    try {
      await deleteDoc(doc(db, collectionName, id));
      return { status: "deleted" };
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${collectionName}/${id}`);
    }
  },

  async saveSettings(data: any) {
    try {
      const docRef = doc(db, "settings", "global");
      await setDoc(docRef, { ...data, updatedAt: serverTimestamp() }, { merge: true });
      return { status: "saved" };
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "settings/global");
    }
  },

  async saveUser(user: any) {
    if (!user) return;
    try {
      const docRef = doc(db, "users", user.uid);
      await setDoc(docRef, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        lastLogin: serverTimestamp(),
        createdAt: user.metadata.creationTime ? new Date(user.metadata.creationTime) : serverTimestamp(),
        emailVerified: user.emailVerified
      }, { merge: true });
      return { status: "saved" };
    } catch (error) {
      console.error("Failed to save user data:", error);
    }
  },

  async fetchUsers() {
    try {
      const snapshot = await getDocs(collection(db, "users"));
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error("Failed to fetch users:", error);
      return [];
    }
  },

  async notify(data: any) {
    console.log("Notification requested (Simulated):", data);
    return { status: "simulated" };
  }
};

