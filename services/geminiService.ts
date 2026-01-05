// Updated to call Node.js backend with user context and memory
const API_URL = import.meta.env.VITE_API_URL || '/api';

interface UserContext {
  name?: string;
  course?: string;
  interests?: string;
  role?: string;
  userId?: string;
}

export const generateLibrarianResponse = async (
  userQuery: string, 
  userContext?: UserContext
): Promise<string> => {
  try {
    const response = await fetch(`${API_URL}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        query: userQuery,
        userContext: userContext || {},
        userId: userContext?.userId
      }),
    });

    if (!response.ok) throw new Error('Network response was not ok');
    
    const data = await response.json();
    return data.text || "I'm having trouble retrieving that information.";
  } catch (error) {
    console.error("AI Service Error:", error);
    return "I am currently experiencing high traffic. Please try again later.";
  }
};

// Fetch chat history for a user
export const getChatHistory = async (userId: string): Promise<Array<{id: string, role: string, text: string, timestamp: string}>> => {
  try {
    const response = await fetch(`${API_URL}/chat/history/${userId}`);
    if (!response.ok) return [];
    return await response.json();
  } catch (error) {
    console.error("Fetch Chat History Error:", error);
    return [];
  }
};

// Clear chat history for a user
export const clearChatHistory = async (userId: string): Promise<boolean> => {
  try {
    const response = await fetch(`${API_URL}/chat/history/${userId}`, {
      method: 'DELETE'
    });
    return response.ok;
  } catch (error) {
    console.error("Clear Chat History Error:", error);
    return false;
  }
};
