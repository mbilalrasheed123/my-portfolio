import { 
  db, 
  storage,
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
  where,
  serverTimestamp,
  handleFirestoreError,
  OperationType,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "../firebase";
import imageCompression from "browser-image-compression";

// API utility with explicit fetch functions and graceful error handling
export const api = {
  // Generic list fetcher with graceful fallback and optional ordering
  async fetchList(collectionName: string, orderField: string = "order") {
    const collectionsWithOrder = ["projects", "certificates", "skills", "experience"];
    const shouldOrder = collectionsWithOrder.includes(collectionName);

    try {
      if (shouldOrder) {
        const q = query(collection(db, collectionName), orderBy(orderField, "asc"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) })) as any[];
      } else {
        // Higher density/unsorted collections
        const snapshot = await getDocs(collection(db, collectionName));
        return snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) })) as any[];
      }
    } catch (error) {
      console.warn(`Failed to fetch ${collectionName} with orderField ${orderField}:`, error);
      try {
        const snapshot = await getDocs(collection(db, collectionName));
        return snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) })) as any[];
      } catch (innerError) {
        console.error(`Fatal fetch failure for ${collectionName}:`, innerError);
        return [];
      }
    }
  },

  async fetchProjects() {
    return this.fetchList("projects");
  },

  async saveProject(data: any) {
    try {
      const payload = {
        ...data,
        updatedAt: serverTimestamp(),
      };

      if (!data.id) {
        payload.createdAt = serverTimestamp();
        const docRef = await addDoc(collection(db, "projects"), payload);
        return { id: docRef.id };
      } else {
        const docRef = doc(db, "projects", data.id);
        await updateDoc(docRef, payload);
        return { id: data.id };
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "projects");
    }
  },

  async deleteProject(id: string) {
    // Attempt to delete thumbnail if it exists in storage
    try {
      const projectDoc = await getDoc(doc(db, "projects", id));
      if (projectDoc.exists()) {
        const data = projectDoc.data();
        if (data.thumbnailUrl && data.thumbnailUrl.includes("firebase")) {
          const fileRef = ref(storage, `projects/${id}.jpg`);
          await deleteObject(fileRef).catch(e => console.warn("Thumbnail not found or already deleted"));
        }
      }
    } catch (e) {
      console.warn("Could not delete associated media:", e);
    }
    return this.delete("projects", id);
  },

  async uploadProjectThumbnail(file: File, id: string, onProgress?: (p: number) => void) {
    try {
      console.log(`Starting compressed upload for project ${id}:`, file.name);
      // 1. Compression options
      const options = {
        maxSizeMB: 0.15, // ~150KB for even better performance
        maxWidthOrHeight: 1200,
        useWebWorker: true,
      };

      // 2. Compress
      let compressedFile = file;
      if (file.type.startsWith('image/')) {
        try {
          compressedFile = await imageCompression(file, options);
          console.log(`Compression successful: ${file.size} -> ${compressedFile.size}`);
        } catch (e) {
          console.warn("Compression failed, uploading original:", e);
        }
      }
      
      // 3. Upload to Storage
      const storageRef = ref(storage, `projects/${id}.jpg`);
      const snapshot = await uploadBytes(storageRef, compressedFile);
      
      // 4. Get URL
      const downloadURL = await getDownloadURL(snapshot.ref);
      console.log(`Upload successful for project ${id}. Final URL:`, downloadURL);
      
      return downloadURL;
    } catch (error) {
      console.error("Image upload failed in api.ts:", error);
      throw error;
    }
  },

  async uploadCertificateImage(file: File, id: string, onProgress?: (p: number) => void) {
    try {
      console.log(`Starting compressed upload for certificate ${id}:`, file.name);
      const options = {
        maxSizeMB: 0.2,
        maxWidthOrHeight: 1600,
        useWebWorker: true,
      };

      let compressedFile = file;
      if (file.type.startsWith('image/')) {
        try {
          compressedFile = await imageCompression(file, options);
        } catch (e) {
          console.warn("Compression failed, uploading original:", e);
        }
      }
      
      const storageRef = ref(storage, `certificates/${id}.jpg`);
      const snapshot = await uploadBytes(storageRef, compressedFile);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      return downloadURL;
    } catch (error) {
      console.error("Certificate image upload failed:", error);
      throw error;
    }
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
      email: "muhammadbilalrasheed78@gmail.com",
      logoType: "text", // "text" or "image"
      logoText: "Bilal",
      logoAlt: "Bilal Rasheed Logo"
    };

    try {
      const docRef = doc(db, "settings", "global");
      const snapshot = await getDoc(docRef);
      return snapshot.exists() ? { ...DEFAULT_SETTINGS, ...snapshot.data() } : DEFAULT_SETTINGS;
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
      console.log(`Attempting to post to ${collectionName}:`, data);
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
      console.log(`Successfully posted to ${collectionName} with ID: ${docRef.id}`);
      return { id: docRef.id };
    } catch (error) {
      console.error(`Post failed for ${collectionName}:`, error);
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
      return snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
    } catch (error) {
      console.error("Failed to fetch users:", error);
      return [];
    }
  },

  async fetchUserQueries(userUid: string) {
    try {
      const q = query(
        collection(db, "contactMessages"),
        where("userUid", "==", userUid),
        orderBy("timestamp", "desc")
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
    } catch (error) {
      console.error("Failed to fetch user queries secured:", error);
      // Fallback if index isn't ready or other issue
      try {
        const q = query(collection(db, "contactMessages"), where("userUid", "==", userUid));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
      } catch (inner) {
        return [];
      }
    }
  },
  
  async saveChatSession(session: any) {
    try {
      const sessionId = session.id || `${session.userId || 'guest'}_${Date.now()}`;
      const docRef = doc(db, "chatSessions", sessionId);
      await setDoc(docRef, {
        ...session,
        id: sessionId,
        lastUpdated: serverTimestamp(),
        createdAt: session.createdAt || serverTimestamp()
      }, { merge: true });
      return sessionId;
    } catch (error) {
      console.error("Failed to save chat session:", error);
    }
  },

  async fetchChatSessions(userId?: string) {
    try {
      let q;
      if (userId && userId !== "all") {
        q = query(collection(db, "chatSessions"), where("userId", "==", userId));
      } else {
        q = collection(db, "chatSessions");
      }
      const snapshot = await getDocs(q as any);
      return snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
    } catch (error) {
      console.error("Failed to fetch chat sessions:", error);
      return [];
    }
  },

  async saveLead(lead: any) {
    try {
      const docRef = doc(collection(db, "leads"));
      await setDoc(docRef, {
        ...lead,
        status: "new",
        createdAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      console.error("Failed to save lead:", error);
    }
  },

  async fetchKnowledgeBase(onlyEnabled = false) {
    try {
      let q;
      if (onlyEnabled) {
        q = query(collection(db, "knowledgeBase"), where("isEnabled", "==", true));
      } else {
        q = collection(db, "knowledgeBase");
      }
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
    } catch (error) {
      console.error("Failed to fetch knowledge base:", error);
      return [];
    }
  },

  async saveKnowledgeEntry(data: any) {
    try {
      if (data.id) {
        const docRef = doc(db, "knowledgeBase", data.id);
        await updateDoc(docRef, { ...data, updatedAt: serverTimestamp() });
        return { id: data.id };
      } else {
        const docRef = await addDoc(collection(db, "knowledgeBase"), {
          ...data,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        return { id: docRef.id };
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "knowledgeBase");
    }
  },

  async deleteKnowledgeEntry(id: string) {
    return this.delete("knowledgeBase", id);
  },

  async notify(data: any) {
    console.log("Notification requested (Simulated):", data);
    return { status: "simulated" };
  }
};

