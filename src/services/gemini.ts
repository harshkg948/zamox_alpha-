import { GoogleGenAI, Type } from "@google/genai";
import { CareerAnalysis, Roadmap, CareerInsight, ChatMessage, WellnessLog, WellnessInsight, DailyQuizResponse, DailyTask, KnowledgeQuiz } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const generateDailyTasks = async (
  quiz: Partial<DailyQuizResponse>,
  goal: string,
  roadmapStage: string
): Promise<Array<Omit<DailyTask, 'id' | 'uid' | 'date' | 'status'>>> => {
  try {
    const prompt = `Generate 3-5 daily tasks for a student aiming to become a ${goal}. 
    Current Roadmap Stage: ${roadmapStage}
    Recent Check-in: Studied ${quiz.studyHours}h on ${quiz.topic} with difficulty ${quiz.difficulty}/10 and focus ${quiz.focus}/10.
    
    Tasks should be actionable, specific, and help them overcome current difficulties or progress in their roadmap.
    Return a JSON array of objects with:
    - title: string
    - description: string
    - type: "ai-generated"
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              type: { type: Type.STRING, enum: ["ai-generated"] }
            },
            required: ["title", "description", "type"]
          }
        }
      }
    });

    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Gemini API Error in generateDailyTasks:", error);
    return [
      { title: "Review past notes", description: "Take 15 minutes to review your most recent notes.", type: "ai-generated" },
      { title: "Practice fundamentals", description: "Focus on core concepts related to your goal.", type: "ai-generated" }
    ];
  }
};

export const generateIntegratedInsights = async (
  profile: any,
  quizzes: DailyQuizResponse[],
  tasks: any[]
): Promise<Array<{ title: string, summary: string, type: 'improvement' | 'strength' | 'weakness' }>> => {
  try {
    const prompt = `Analyze the student's progress and provide 3 integrated AI insights.
    Profile: ${JSON.stringify(profile)}
    Recent Quizzes: ${JSON.stringify(quizzes.slice(-5))}
    Task Completion: ${tasks.filter(t => t.status === 'completed').length}/${tasks.length} tasks done.
    
    Detect:
    - Weak areas based on high difficulty scores in quizzes.
    - Consistency patterns.
    - Suggestions for improvement.
    
    Return a JSON array of objects with:
    - title: string
    - summary: string
    - type: "improvement" | "strength" | "weakness"
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              summary: { type: Type.STRING },
              type: { type: Type.STRING, enum: ["improvement", "strength", "weakness"] }
            },
            required: ["title", "summary", "type"]
          }
        }
      }
    });

    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Gemini API Error in generateIntegratedInsights:", error);
    return [
      { title: "Consistent Learner", summary: "Keep up the good work and maintain your streak!", type: "strength" }
    ];
  }
};

export const processWellnessCheckIn = async (text: string): Promise<{ studyTime: number, focus: number, rest: number, breaks: number, summary: string }> => {
  try {
    const prompt = `The user is checking in for their daily wellness log. 
    Extract the following metrics from their message:
    - studyTime (number of hours spent studying)
    - focus (focus level from 1-10)
    - rest (rest/sleep quality from 1-10)
    - breaks (number of breaks taken)
    - summary (a short, encouraging summary of their day)

    User message: "${text}"
    
    If a metric is not mentioned, estimate it reasonably based on the tone or context, or use neutral defaults (Study: 4, Focus: 7, Rest: 7, Breaks: 3).
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            studyTime: { type: Type.NUMBER },
            focus: { type: Type.NUMBER },
            rest: { type: Type.NUMBER },
            breaks: { type: Type.NUMBER },
            summary: { type: Type.STRING }
          },
          required: ["studyTime", "focus", "rest", "breaks", "summary"]
        }
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Gemini API Error in processWellnessCheckIn:", error);
    return { studyTime: 2, focus: 7, rest: 7, breaks: 2, summary: "You're doing great, keep finding balance." };
  }
};

export const generateWellnessInsights = async (logs: WellnessLog[]): Promise<WellnessInsight[]> => {
  try {
    const prompt = `Analyze the following wellness logs for a student and provide 3 actionable AI Growth Insights.
    Logs (last 7 days): ${JSON.stringify(logs)}
    
    Detect patterns such as:
    - Correlation between study hours and focus levels.
    - Impact of rest on productivity.
    - Effectiveness of breaks.
    
    Provide 3 insights, each with:
    - title: Short catchy title
    - desc: Detailed observation and a specific suggestion (e.g., Pomodoro, more sleep, consistent schedule)
    - type: "positive" | "neutral" | "negative"
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              desc: { type: Type.STRING },
              type: { type: Type.STRING, enum: ["positive", "neutral", "negative"] }
            },
            required: ["title", "desc", "type"]
          }
        }
      }
    });

    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Gemini API Error in generateWellnessInsights:", error);
    return [
      { title: "Steady Pace", desc: "Maintain your current routine for consistent results.", type: "positive" }
    ];
  }
};

export const analyzeCareer = async (answers: Record<string, string>): Promise<CareerAnalysis> => {
  try {
    const prompt = `Analyze the following career assessment answers and provide a detailed career analysis.
    Answers: ${JSON.stringify(answers)}
    
    Return a JSON object with:
    - strengths: string[]
    - weaknesses: string[]
    - careerFitScore: number (0-100)
    - suggestions: exactly 3 career path options
    - each suggestion must be suitable for roadmap generation
    - each suggestion: { title: string, matchScore: number, description: string, strengths: string[] }
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
            weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
            careerFitScore: { type: Type.NUMBER },
            suggestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  matchScore: { type: Type.NUMBER },
                  description: { type: Type.STRING },
                  strengths: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["title", "matchScore", "description", "strengths"]
              }
            }
          },
          required: ["strengths", "weaknesses", "careerFitScore", "suggestions"]
        }
      }
    });

    const data = JSON.parse(response.text || "{}");
    const fallbackSuggestions = [
      { title: "Software Engineering", matchScore: 90, description: "Strong fit for building applications with both frontend and backend skills.", strengths: ["Problem Solving", "Logic"] },
      { title: "Frontend Engineering", matchScore: 84, description: "Good fit if you enjoy crafting user interfaces and product experiences.", strengths: ["Creativity", "UI Thinking"] },
      { title: "Backend Engineering", matchScore: 82, description: "Good fit if you prefer APIs, databases, system logic, and reliability.", strengths: ["System Thinking", "Analytical Skills"] }
    ];

    return {
      strengths: Array.isArray(data.strengths) ? data.strengths : ["Problem Solving"],
      weaknesses: Array.isArray(data.weaknesses) ? data.weaknesses : ["Time Management"],
      careerFitScore: typeof data.careerFitScore === "number" ? data.careerFitScore : 85,
      suggestions: Array.isArray(data.suggestions) && data.suggestions.length > 0
        ? data.suggestions.slice(0, 3).map((suggestion: any, index: number) => ({
            title: String(suggestion?.title || fallbackSuggestions[index]?.title || `Career Path ${index + 1}`).trim(),
            matchScore: typeof suggestion?.matchScore === "number" ? suggestion.matchScore : fallbackSuggestions[index]?.matchScore || 75,
            description: String(suggestion?.description || fallbackSuggestions[index]?.description || "A strong option based on your analysis.").trim(),
            strengths: Array.isArray(suggestion?.strengths) ? suggestion.strengths.map((strength: any) => String(strength).trim()).filter(Boolean) : fallbackSuggestions[index]?.strengths || []
          }))
        : fallbackSuggestions
    };
  } catch (error) {
    console.error("Gemini API Error in analyzeCareer:", error);
    return {
      strengths: ["Problem Solving"],
      weaknesses: ["Time Management"],
      careerFitScore: 85,
      suggestions: [
        { title: "Software Engineering", matchScore: 90, description: "Strong fit for building applications with both frontend and backend skills.", strengths: ["Problem Solving", "Logic"] },
        { title: "Frontend Engineering", matchScore: 84, description: "Good fit if you enjoy crafting user interfaces and product experiences.", strengths: ["Creativity", "UI Thinking"] },
        { title: "Backend Engineering", matchScore: 82, description: "Good fit if you prefer APIs, databases, system logic, and reliability.", strengths: ["System Thinking", "Analytical Skills"] }
      ]
    };
  }
};

export const generateRoadmap = async (careerTitle: string, currentSkills: string[]): Promise<Omit<Roadmap, 'uid'>> => {
  const normalizedSkills = currentSkills.filter(Boolean).map(skill => skill.trim()).filter(Boolean);
  const fallbackRoadmap = {
    title: careerTitle || "Software Engineering Career Roadmap",
    description: "A structured 6-month plan covering fundamentals, frontend, backend, databases, testing, deployment, and interview preparation.",
    months: [
      {
        month: 1,
        focus: "Programming Foundations and Problem Solving",
        goals: [
          "Strengthen JavaScript or TypeScript fundamentals",
          "Practice problem solving consistently",
          "Build confidence with Git and command line basics"
        ],
        weeks: [
          { week: 1, tasks: ["Review variables, functions, arrays, objects, and control flow", "Solve 5 beginner coding problems", "Set up Git and push a practice repository"] },
          { week: 2, tasks: ["Study ES6 features and asynchronous JavaScript", "Build a small calculator or to-do app", "Practice array and string interview questions"] },
          { week: 3, tasks: ["Learn debugging with browser dev tools", "Refactor your mini project for readability", "Write notes on common JavaScript pitfalls"] },
          { week: 4, tasks: ["Solve 8 timed coding problems", "Review Git branching and pull requests", "Summarize what you learned in a README"] }
        ]
      },
      {
        month: 2,
        focus: "Frontend Development",
        goals: [
          "Build responsive user interfaces",
          "Understand React fundamentals",
          "Create polished small frontend projects"
        ],
        weeks: [
          { week: 1, tasks: ["Learn semantic HTML and modern CSS layout", "Recreate a landing page from a design reference", "Practice responsive design for mobile and desktop"] },
          { week: 2, tasks: ["Study React components, props, and state", "Build a small notes app in React", "Organize components into reusable pieces"] },
          { week: 3, tasks: ["Learn forms, events, and conditional rendering", "Add search or filtering to your notes app", "Handle loading and empty states cleanly"] },
          { week: 4, tasks: ["Study API integration in React", "Connect your app to a public API", "Deploy the frontend to a hosting platform"] }
        ]
      },
      {
        month: 3,
        focus: "Backend Development and APIs",
        goals: [
          "Understand server fundamentals",
          "Build REST APIs",
          "Handle validation and error management"
        ],
        weeks: [
          { week: 1, tasks: ["Learn Node.js runtime basics", "Create a simple Express server", "Implement routes for health check and sample data"] },
          { week: 2, tasks: ["Design REST endpoints for a small app", "Add request validation and structured responses", "Test endpoints with Postman or Hoppscotch"] },
          { week: 3, tasks: ["Learn middleware, authentication basics, and environment variables", "Protect one endpoint with token-based auth", "Handle common API error cases"] },
          { week: 4, tasks: ["Connect frontend and backend projects", "Document your API in README", "Refactor folder structure for maintainability"] }
        ]
      },
      {
        month: 4,
        focus: "Databases and Full-Stack Integration",
        goals: [
          "Model application data correctly",
          "Use a database with CRUD operations",
          "Ship a complete full-stack project"
        ],
        weeks: [
          { week: 1, tasks: ["Learn relational database basics and SQL queries", "Design tables for a task tracker", "Practice SELECT, INSERT, UPDATE, and DELETE queries"] },
          { week: 2, tasks: ["Connect your backend to a database", "Implement CRUD endpoints backed by real data", "Add seed data for development"] },
          { week: 3, tasks: ["Study indexing and data validation basics", "Add pagination or filtering to one endpoint", "Handle duplicate or invalid records safely"] },
          { week: 4, tasks: ["Build a full-stack project milestone", "Add authentication and protected user data", "Record a short demo of the project"] }
        ]
      },
      {
        month: 5,
        focus: "Testing, Deployment, and Engineering Quality",
        goals: [
          "Write reliable tests",
          "Understand deployment workflows",
          "Improve code quality and maintainability"
        ],
        weeks: [
          { week: 1, tasks: ["Learn unit and integration testing basics", "Add tests for utility functions and API routes", "Fix failing edge cases found by tests"] },
          { week: 2, tasks: ["Study linting, formatting, and clean architecture basics", "Set up ESLint and formatting rules", "Refactor one feature for readability and reuse"] },
          { week: 3, tasks: ["Learn CI/CD basics", "Deploy frontend and backend services", "Verify environment variables and production builds"] },
          { week: 4, tasks: ["Write project documentation and setup instructions", "Add a test checklist for critical flows", "Review app performance and accessibility basics"] }
        ]
      },
      {
        month: 6,
        focus: "Portfolio, Resume, and Interview Preparation",
        goals: [
          "Prepare for technical interviews",
          "Package projects into a strong portfolio",
          "Be ready to apply confidently"
        ],
        weeks: [
          { week: 1, tasks: ["Solve 10 interview-style coding problems", "Review core data structures and algorithms", "Explain tradeoffs aloud for two solutions"] },
          { week: 2, tasks: ["Prepare project case studies", "Update resume with quantified impact", "Improve GitHub profile and repository READMEs"] },
          { week: 3, tasks: ["Practice mock interviews", "Prepare answers for behavioral questions", "Review system design basics for junior roles"] },
          { week: 4, tasks: ["Create an application tracker", "Finalize portfolio links and deployment URLs", "Set a weekly job application target"] }
        ]
      }
    ]
  };

  try {
    const prompt = `Generate a high-quality 6-month career roadmap for someone aiming to become a ${careerTitle}.
    Current skills: ${normalizedSkills.length > 0 ? normalizedSkills.join(", ") : "Beginner level / not specified"}.

    Requirements:
    - Make the roadmap realistic for a beginner-to-intermediate learner.
    - Focus on software engineering progression: programming fundamentals, frontend, backend, databases, testing, deployment, and interview preparation.
    - Each month must have a distinct focus area and 3-4 concrete goals.
    - Each month must contain exactly 4 weeks.
    - Each week must contain 3 actionable tasks.
    - Tasks must be specific, outcome-oriented, and portfolio-friendly.
    - Avoid vague tasks like "learn coding" or "study more".
    - Use concise language suitable for a product UI.
    - Keep difficulty progressive from month 1 to month 6.

    Return a JSON object with:
    - title: string
    - description: string
    - months: Array of { month: number, focus: string, goals: string[], weeks: Array of { week: number, tasks: string[] } }`;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            months: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  month: { type: Type.NUMBER },
                  focus: { type: Type.STRING },
                  goals: { type: Type.ARRAY, items: { type: Type.STRING } },
                  weeks: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        week: { type: Type.NUMBER },
                        tasks: { type: Type.ARRAY, items: { type: Type.STRING } }
                      },
                      required: ["week", "tasks"]
                    }
                  }
                },
                required: ["month", "focus", "goals", "weeks"]
              }
            }
          },
          required: ["title", "description", "months"]
        }
      }
    });

    const data = JSON.parse(response.text || "{}");
    const months = Array.isArray(data.months) && data.months.length > 0 ? data.months.slice(0, 6).map((month: any, monthIndex: number) => ({
      month: typeof month?.month === "number" ? month.month : monthIndex + 1,
      focus: typeof month?.focus === "string" && month.focus.trim() ? month.focus.trim() : fallbackRoadmap.months[monthIndex]?.focus || `Month ${monthIndex + 1} Focus`,
      goals: Array.isArray(month?.goals) && month.goals.length > 0 ? month.goals.slice(0, 4).map((goal: any) => String(goal).trim()).filter(Boolean) : fallbackRoadmap.months[monthIndex]?.goals || [],
      weeks: Array.isArray(month?.weeks) && month.weeks.length > 0 ? month.weeks.slice(0, 4).map((week: any, weekIndex: number) => ({
        week: typeof week?.week === "number" ? week.week : weekIndex + 1,
        tasks: Array.isArray(week?.tasks) && week.tasks.length > 0 ? week.tasks.slice(0, 3).map((task: any) => String(task).trim()).filter(Boolean) : fallbackRoadmap.months[monthIndex]?.weeks[weekIndex]?.tasks || []
      })) : fallbackRoadmap.months[monthIndex]?.weeks || []
    })) : fallbackRoadmap.months;

    return {
      title: typeof data.title === "string" && data.title.trim() ? data.title.trim() : fallbackRoadmap.title,
      description: typeof data.description === "string" && data.description.trim() ? data.description.trim() : fallbackRoadmap.description,
      months,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString()
    };
  } catch (error) {
    console.error("Gemini API Error in generateRoadmap:", error);
    return {
      ...fallbackRoadmap,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString()
    };
  }
};

export const fetchCareerNews = async (goals: string[], preferredSources?: string[]): Promise<CareerInsight[]> => {
  try {
    const query = goals && goals.length > 0 ? goals.join(' ') : 'Technology Career';
    const sourceTerms = preferredSources?.filter(Boolean).join(' OR ');
    const searchQuery = sourceTerms ? `${query} (${sourceTerms})` : query;
    const params = new URLSearchParams({ query: searchQuery });
    const response = await fetch(`/api/news?${params.toString()}`);
    const contentType = response.headers.get("content-type") || "";

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    if (!contentType.includes("application/json")) {
      const body = await response.text();
      throw new Error(`Expected JSON from /api/news but received ${contentType || "unknown content type"}: ${body.slice(0, 120)}`);
    }
    const data = await response.json();

    if (!data.articles || data.articles.length === 0) {
      return [];
    }

    const shuffledArticles = [...data.articles].sort(() => 0.5 - Math.random());

    return shuffledArticles.slice(0, 5).map((article: any): CareerInsight => ({
      title: article.title || "Industry Update",
      summary: article.description || article.content || "Click the source to read the full article.",
      importance: "medium",
      trend: article.publishedAt ? "Recent News" : "Industry Update",
      skills: ["Industry Awareness"],
      warnings: [],
      nextSteps: "Read the source and note one relevant takeaway for your roadmap.",
      sources: [{
        title: article.source?.name || article.author || "External Link",
        url: article.url || "#"
      }]
    }));
  } catch (error) {
    console.error("News API Error in fetchCareerNews:", error);
    return [
      {
        title: "Tech Industry Trends",
        summary: "The industry continues to evolve with learning at the forefront.",
        importance: "high",
        trend: "Upward",
        skills: ["Adaptability", "Continuous Learning"],
        warnings: [],
        nextSteps: "Keep expanding your knowledge base",
        sources: [{ title: "Tech News", url: "https://news.ycombinator.com" }]
      }
    ];
  }
};

export const chatWithMentor = async (history: ChatMessage[], message: string, context: string): Promise<string> => {
  try {
    // Convert history to Gemini format
    const contents = history.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    const chat = ai.chats.create({
      model: "gemini-3.1-flash-lite-preview",
      config: {
        systemInstruction: `You are ZAMOX AI Mentor, a career growth specialist. 
        Your goal is to provide short, actionable advice to students.
        Context about the user: ${context}
        Be encouraging, professional, and growth-oriented. 
        Use the "Plant -> Nurture -> Bloom" metaphor when appropriate.`
      },
      history: contents
    });

    const response = await chat.sendMessage({
      message: message
    });

    return response.text || "I'm sorry, I encountered an error. Please try again later.";
  } catch (error) {
    console.error("Gemini API Error in chatWithMentor:", error);
    return "I'm sorry, I encountered an error. Please try again later.";
  }
};

export const generateKnowledgeQuiz = async (
  goal: string,
  roadmapTasks: string[],
  dailyTasks: string[],
  focusScore: number
): Promise<Omit<KnowledgeQuiz, 'id' | 'uid' | 'date'>> => {
  try {
    const difficulty = focusScore > 80 ? 'Advanced' : focusScore > 50 ? 'Intermediate' : 'Beginner';

    const prompt = `Generate a 5-question multiple choice quiz for a student aiming to become a ${goal}.
    Difficulty Level: ${difficulty} (based on Focus Score: ${focusScore}/100)
    Context:
    - Roadmap Tasks: ${roadmapTasks.join(", ")}
    - Daily Tasks: ${dailyTasks.join(", ")}
    
    The quiz should test their knowledge on these topics.
    Return a JSON object with:
    - topic: string
    - difficulty: string
    - questions: Array of { question: string, options: string[], correctAnswer: number (index), explanation: string }
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            topic: { type: Type.STRING },
            difficulty: { type: Type.STRING },
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  correctAnswer: { type: Type.INTEGER },
                  explanation: { type: Type.STRING }
                },
                required: ["question", "options", "correctAnswer", "explanation"]
              }
            }
          },
          required: ["topic", "difficulty", "questions"]
        }
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Gemini API Error in generateKnowledgeQuiz:", error);
    return {
      topic: "General Knowledge",
      difficulty: "Beginner",
      questions: [
        {
          question: "What is a main goal of code refactoring?",
          options: ["Making code slower", "Improving readability", "Adding more bugs", "None of the above"],
          correctAnswer: 1,
          explanation: "Refactoring aims to improve the nonfunctional attributes of the software."
        }
      ]
    };
  }
};
