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
  async fetchList(collectionName: string, orderField: string = "order", userId?: string) {
    const collectionsWithOrder = ["projects", "certificates", "skills", "experience"];
    const shouldOrder = collectionsWithOrder.includes(collectionName);

    try {
      const colRef = collection(db, collectionName);
      
      // CRITICAL: Always filter by userId if we want a proper multi-user system.
      // If userId is missing, we default to "global" or an empty state to prevent leakage.
      const searchId = userId || "global";
      
      const uidField = (collectionName === "contactMessages") ? "userUid" : "userId";
      let q;
      
      if (shouldOrder) {
        q = query(colRef, where(uidField, "==", searchId), orderBy(orderField, "asc"));
      } else {
        q = query(colRef, where(uidField, "==", searchId));
      }

      const snapshot = await getDocs(q as any);
      return snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) })) as any[];
    } catch (error: any) {
      console.warn(`Failed to fetch ${collectionName} for user ${userId}:`, error);
      return [];
    }
  },

  async fetchProjects(userId?: string) {
    return this.fetchList("projects", "order", userId);
  },

  async saveProject(data: any, userId?: string) {
    try {
      const payload: any = {
        ...data,
        updatedAt: serverTimestamp(),
      };

      const finalUserId = userId || data.userId;
      if (finalUserId) {
        payload.userId = finalUserId;
      }

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

  async fetchCertificates(userId?: string) {
    return this.fetchList("certificates", "order", userId);
  },

  async fetchSkills(userId?: string) {
    return this.fetchList("skills", "order", userId);
  },

  async fetchExperience(userId?: string) {
    return this.fetchList("experience", "order", userId);
  },

  async fetchSettings(userId?: string) {
    const DEFAULT_SETTINGS = {
      name: "User Portfolio",
      title: "Full Stack Developer",
      aboutText: "Welcome to my professional portfolio.",
      aboutTitle: "Full Stack Developer & UI Designer",
      aboutImage: "",
      experienceYears: "0+ Years",
      location: "Remote / Global",
      education: "BS Computer Science",
      email: "",
      logoType: "text", // "text" or "image"
      logoText: "My Portfolio",
      logoAlt: "My Portfolio Logo"
    };

    try {
      // Use userId as the document ID for settings
      const settingsId = userId || "global";
      const docRef = doc(db, "settings", settingsId);
      const snapshot = await getDoc(docRef);
      return snapshot.exists() ? { ...DEFAULT_SETTINGS, ...snapshot.data() } : DEFAULT_SETTINGS;
    } catch (error) {
      console.error("Failed to fetch settings from Firebase:", error);
      return DEFAULT_SETTINGS;
    }
  },

  // Legacy compatibility and Mutations
  async get(collectionName: string, userId?: string) { return this.fetchList(collectionName, "order", userId); },
  async getSettings(userId?: string) { return this.fetchSettings(userId); },

  async post(collectionName: string, data: any, userId?: string) {
    try {
      console.log(`Attempting to post to ${collectionName}:`, data);
      const payload: any = {
        ...data,
        updatedAt: serverTimestamp(),
      };
      
      const finalUserId = userId || data.userId;
      if (finalUserId) {
        const uidField = (collectionName === "contactMessages") ? "userUid" : "userId";
        payload[uidField] = finalUserId;
      }
      
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

  async saveSettings(data: any, userId?: string) {
    try {
      console.log("Saving settings to Firebase for user:", userId);
      const settingsId = userId || "global";
      const docRef = doc(db, "settings", settingsId);
      
      const payload: any = { 
        ...data, 
        updatedAt: serverTimestamp() 
      };
      
      if (userId) {
        payload.userId = userId;
      }
      
      await setDoc(docRef, payload, { merge: true });
      return { status: "saved" };
    } catch (error) {
      console.error("Failed to save settings:", error);
      handleFirestoreError(error, OperationType.WRITE, `settings/${userId || 'global'}`);
    }
  },

  async sendEmail(to: string, subject: string, text: string, html?: string) {
    try {
      const response = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, text, html }),
      });
      return await response.json();
    } catch (error) {
      console.error("Failed to send email through proxy:", error);
      return { success: false, error };
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
      // Primary attempt: Secured and ordered (requires composite index: userUid ASC, timestamp DESC)
      const q = query(
        collection(db, "contactMessages"),
        where("userUid", "==", userUid),
        orderBy("timestamp", "desc")
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
    } catch (error) {
      console.warn("Ordered fetch failed for contactMessages (Index likely missing):", error);
      // Fallback: Just filter by userUid (standard index, usually automatic)
      try {
        const q = query(collection(db, "contactMessages"), where("userUid", "==", userUid));
        const snapshot = await getDocs(q);
        // Manual sort in JS
        const results = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
        return results.sort((a, b) => {
          const tA = a.timestamp || a.createdAt;
          const tB = b.timestamp || b.createdAt;
          const getTime = (t: any) => t?.seconds ? t.seconds * 1000 : new Date(t).getTime() || 0;
          return getTime(tB) - getTime(tA);
        });
      } catch (inner) {
        console.error("Fatal fetch failure for user queries:", inner);
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

  async fetchKnowledgeBase(userId?: string, onlyEnabled = false) {
    try {
      let q = collection(db, "knowledgeBase");
      const constraints: any[] = [];
      
      if (userId) {
        constraints.push(where("userId", "==", userId));
      }
      
      if (onlyEnabled) {
        constraints.push(where("isEnabled", "==", true));
      }
      
      const firestoreQuery = constraints.length > 0 ? query(q, ...constraints) : q;
      const snapshot = await getDocs(firestoreQuery);
      return snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
    } catch (error) {
      console.error("Failed to fetch knowledge base:", error);
      return [];
    }
  },

  async saveKnowledgeEntry(data: any, userId?: string) {
    try {
      const payload: any = { 
        ...data, 
        updatedAt: serverTimestamp() 
      };

      const finalUserId = userId || data.userId;
      if (finalUserId) {
        payload.userId = finalUserId;
      }

      if (data.id) {
        const docRef = doc(db, "knowledgeBase", data.id);
        await updateDoc(docRef, payload);
        return { id: data.id };
      } else {
        payload.createdAt = serverTimestamp();
        const docRef = await addDoc(collection(db, "knowledgeBase"), payload);
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

