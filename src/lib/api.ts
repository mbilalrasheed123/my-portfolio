// API utility for custom backend
export const api = {
  async handleResponse(res: Response) {
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `HTTP error! status: ${res.status}`);
    }
    return data;
  },
  async get(collection: string) {
    const res = await fetch(`/api/data/${collection}`);
    return this.handleResponse(res);
  },
  async post(collection: string, data: any) {
    const res = await fetch(`/api/data/${collection}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return this.handleResponse(res);
  },
  async put(collection: string, id: string, data: any) {
    const res = await fetch(`/api/data/${collection}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return this.handleResponse(res);
  },
  async delete(collection: string, id: string) {
    const res = await fetch(`/api/data/${collection}/${id}`, {
      method: "DELETE",
    });
    return this.handleResponse(res);
  },
  async getSettings() {
    const res = await fetch("/api/settings");
    return this.handleResponse(res);
  },
  async saveSettings(data: any) {
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return this.handleResponse(res);
  },
  async notify(data: any) {
    const res = await fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return this.handleResponse(res);
  }
};
