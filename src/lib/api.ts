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
  limit,
  serverTimestamp,
  handleFirestoreError,
  OperationType,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "../firebase";
import imageCompression from "browser-image-compression";

/**
 * Sanitizes user-provided string input against script injection / XSS attacks.
 */
export function sanitizeString(val: string): string {
  if (!val) return val;
  return val
    // Remove <script>...</script> block tags completely
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    // Remove onX event handlers (e.g. onclick, onload, onerror, etc.)
    .replace(/\bon[a-z]+\s*=\s*(['"])(.*?)\1/gi, "")
    .replace(/\bon[a-z]+\s*=\s*([^\s>]+)/gi, "")
    // Remove javascript:, vbscript:, and data: schemes that execute scripting
    .replace(/(javascript|vbscript|data):/gi, "")
    // Strip other dangerous HTML tags like iframe, embed, object, link, style
    .replace(/<\/?(iframe|embed|object|link|style|meta|html|body|applet)[^>]*>/gi, "")
    // Escape generic < and > characters to avoid raw HTML injection and protect rendering
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Recursively sanitizes any primitive strings inside an object or array.
 * Keeps special objects like Dates and Firestore FieldValues untampered.
 */
export function sanitizeData<T>(data: T): T {
  if (typeof data === "string") {
    return sanitizeString(data) as any;
  }
  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item)) as any;
  }
  if (data !== null && typeof data === "object") {
    if (
      data.constructor && 
      data.constructor.name !== "Object" && 
      data.constructor.name !== "Array"
    ) {
      return data;
    }
    const sanitized: any = {};
    for (const key of Object.keys(data)) {
      sanitized[key] = sanitizeData((data as any)[key]);
    }
    return sanitized;
  }
  return data;
}

// API utility with explicit fetch functions and graceful error handling
export const api = {
  // Generic list fetcher with graceful fallback and optional ordering
  async fetchList(collectionName: string, orderField: string = "order", userId?: string) {
    const collectionsWithOrder = ["projects", "certificates", "skills", "experience", "testimonials"];
    const shouldOrder = collectionsWithOrder.includes(collectionName);

    try {
      const colRef = collection(db, collectionName);

      // If an administrator requests general logs/leads/queries/chats/sessions, return all documents.
      const isQueryingAllAdminData = !userId && [
        "contactMessages",
        "leads",
        "chatSessions",
        "chatMessages",
        "sessions",
        "users"
      ].includes(collectionName);

      if (isQueryingAllAdminData) {
        console.log(`[api.fetchList] Admin requested all ${collectionName}. Fetching...`);
        const snapshot = await getDocs(colRef);
        const results = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
        if (shouldOrder) {
          results.sort((a, b) => (a[orderField] || 0) - (b[orderField] || 0));
        }
        return results;
      }

      const searchId = userId || "global";
      const masterUserIds = [
        "global", 
        "muhammad-bilal-rasheed-default", 
        "6v6v6v6v6v6v6v6v6v6v6v6v6v6v",
        "muhammad-bilal-rasheed",
        "ChawipBei1fxQIQqe7k0",
        "JELMOVP0a4CjM3zNYDMs",
        "QRdHJwS9Kg039SqGtbJy",
        "b0duY6KaDfHjYjI6H9RL",
        "cPRxJLMJgEeBL0qmJp0G",
        "kq8L2QmTovazGU7FqDt6",
        "lhxfRn9aK7MVi31NVa5w",
        "tO0l5FmPRqlx36ddIhWi"
      ];
      
      const isGlobalOrMaster = searchId === "global" || masterUserIds.includes(searchId);
      const uidField = (collectionName === "contactMessages") ? "userUid" : "userId";
      const publicCollections = ["projects", "certificates", "skills", "experience", "testimonials"];
      const isPublicPortfolioCollection = publicCollections.includes(collectionName);
      
      console.log(`[api.fetchList] Fetching ${collectionName} for searchId: ${searchId}`);

      let results: any[] = [];
      
      // Try 1: Secure Query (Modern) - Only run if not a global portfolio request
      // If it's a global request for projects/skills, we skip Try 1 to avoid restricted filtering
      if (!isGlobalOrMaster || !isPublicPortfolioCollection) {
        try {
          // Fetch simple collection with key filter to avoid composite index requirements
          const q = query(colRef, where(uidField, "==", searchId));
          const snapshot = await getDocs(q as any);
          results = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
          console.log(`[api.fetchList] Try 1 (${searchId}) returned ${results.length} docs`);
        } catch (queryErr) {
          console.warn(`[api.fetchList] Secure query failed for ${collectionName}:`, queryErr);
        }
      }

      // Try 2: Enhanced Fallback/Inclusive check for Admin/Global/Portfolio deployments
      if (isGlobalOrMaster || results.length === 0) {
        console.log(`[api.fetchList] Running inclusive fallback for ${collectionName}...`);
        try {
          const legacySnapshot = await getDocs(colRef);
          const allDocs = legacySnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
          
          if (isPublicPortfolioCollection && isGlobalOrMaster) {
            // For portfolio data in global/master mode, return EVERYTHING
            results = allDocs;
          } else {
            // Filter by known IDs or missing IDs
            const legacyResults = allDocs.filter(d => {
              const uId = d.userId;
              const uUid = d.userUid;
              
              const isLegacyAdmin = !uId && !uUid || 
                     masterUserIds.includes(uId) || 
                     masterUserIds.includes(uUid);
              
              return isLegacyAdmin || d.email === "muhammadbilalrasheed78@gmail.com";
            });
            
            // Merge results
            const existingIds = new Set(results.map(r => r.id));
            legacyResults.forEach(item => {
              if (!existingIds.has(item.id)) {
                results.push(item);
              }
            });
          }
        } catch (legacyErr) {
          console.error(`[api.fetchList] Fallback failed for ${collectionName}:`, legacyErr);
        }
      }

      // Always sort the unified results in memory
      if (shouldOrder) {
         results.sort((a, b) => (a[orderField] || 0) - (b[orderField] || 0));
      }

      return results;
    } catch (error: any) {
      console.error(`[api.fetchList] Fatal error for ${collectionName}:`, error);
      return [];
    }
  },

  async fetchProjects(userId?: string) {
    return this.fetchList("projects", "order", userId);
  },

  async saveProject(data: any, userId?: string) {
    try {
      const sanitizedData = sanitizeData(data);
      const payload: any = {
        ...sanitizedData,
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
      console.log(`[api.fetchSettings] Fetching for settingsId: ${settingsId}`);
      const docRef = doc(db, "settings", settingsId);
      const snapshot = await getDoc(docRef);
      
      if (snapshot.exists()) {
        console.log(`[api.fetchSettings] Found settings for: ${settingsId}`);
        return { ...DEFAULT_SETTINGS, ...snapshot.data() };
      }

      // Try fallback: If "global" is requested but missing, find ANY available settings
      // or specifically the one for the master admin.
      if (settingsId === "global") {
        console.log(`[api.fetchSettings] "global" not found, looking for master admin or first settings doc...`);
        const q = query(collection(db, "settings"), limit(1)); // We just need one to start
        const fallbackSnapshot = await getDocs(q);
        
        if (!fallbackSnapshot.empty) {
          const fallbackData = fallbackSnapshot.docs[0].data();
          console.log(`[api.fetchSettings] Falling back to settings from: ${fallbackSnapshot.docs[0].id}`);
          return { ...DEFAULT_SETTINGS, ...fallbackData };
        }
      }

      console.log(`[api.fetchSettings] No settings doc found for: ${settingsId}, returning default`);
      return DEFAULT_SETTINGS;
    } catch (error) {
      console.error("[api.fetchSettings] Failed to fetch settings from Firebase:", error);
      return DEFAULT_SETTINGS;
    }
  },

  // Legacy compatibility and Mutations
  async get(collectionName: string, userId?: string) { return this.fetchList(collectionName, "order", userId); },
  async getSettings(userId?: string) { return this.fetchSettings(userId); },

  async post(collectionName: string, data: any, userId?: string) {
    try {
      console.log(`Attempting to post to ${collectionName}:`, data);
      const sensitiveCollections = ["projects", "certificates", "testimonials", "skills", "experience", "settings"];
      const clientData = sensitiveCollections.includes(collectionName) ? sanitizeData(data) : data;
      const payload: any = {
        ...clientData,
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
      const sensitiveCollections = ["projects", "certificates", "testimonials", "skills", "experience", "settings"];
      const clientData = sensitiveCollections.includes(collectionName) ? sanitizeData(data) : data;
      await updateDoc(docRef, { ...clientData, updatedAt: serverTimestamp() });
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
      
      const sanitizedData = sanitizeData(data);
      const payload: any = { 
        ...sanitizedData, 
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

  async getUserProfile(uid: string) {
    try {
      const docRef = doc(db, "users", uid);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        return snapshot.data();
      }
      return null;
    } catch (error) {
      console.error("Failed to fetch user profile:", error);
      return null;
    }
  },

  async saveUserProfile(uid: string, data: any) {
    try {
      const docRef = doc(db, "users", uid);
      const payload = {
        ...data,
        uid: uid, // Ensure uid is always included as immutable identifier
        lastUpdated: serverTimestamp()
      };
      await setDoc(docRef, payload, { merge: true });
      return { status: "saved" };
    } catch (error) {
      console.error("Failed to save user profile:", error);
      throw error;
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
      const sanitizedData = sanitizeData(data);
      const payload: any = { 
        ...sanitizedData, 
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

  async saveChatMessage(data: any) {
    try {
      const docRef = doc(collection(db, "chatMessages"));
      await setDoc(docRef, {
        ...data,
        timestamp: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      console.error("Failed to save chat message log:", error);
    }
  },

  async notify(data: any) {
    console.log("Notification requested (Simulated):", data);
    return { status: "simulated" };
  }
};

