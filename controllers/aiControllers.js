import Resume from "../models/Resume.js";
import ai from "../configs/ai.js";

// controller for enhacing resume professional summary
// POST: /api/ai/enhance-pro-sum

const callAI = async ({ model, messages, response_format }) => {
  if (ai?.responses?.create) {
    const input = messages.map((m) => `${m.role}: ${m.content}`).join("\n\n");
    return await ai.responses.create({
      model,
      input,
      response_format,
    });
  }
  if (ai?.chat?.completions?.create) {
    return await ai.chat.completions.create({
      model,
      messages,
      response_format,
    });
  }
  throw new Error("OpenAI client is not configured correctly");
};

export const enhanceProfessionalSummary = async (req, res) => {
  try {
    const { userContent } = req.body;

    if (!userContent) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const aiResp = await callAI({
      model: process.env.OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are an expert in resume writing. Enhance the professional summary into 1–2 ATS-friendly sentences. Return only plain text.",
        },
        {
          role: "user",
          content: userContent,
        },
      ],
    });

    const enhancedContent =
      aiResp?.output_text || aiResp?.choices?.[0]?.message?.content || "";

    res.status(200).json({ enhancedContent });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

// controller for enhancing a resume's job description
// POST: /api/ai/enhance-job-desc

export const enhanceJobDescription = async (req, res) => {
  try {
    const { userContent } = req.body;

    if (!userContent) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const aiResp = await callAI({
      model: process.env.OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are an expert in resume writing. Enhance the job description into 1–2 ATS-friendly sentences. Return only plain text.",
        },
        {
          role: "user",
          content: userContent,
        },
      ],
    });

    const enhancedContent =
      aiResp?.output_text || aiResp?.choices?.[0]?.message?.content || "";

    res.status(200).json({ enhancedContent });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

// controller for uploading a resume to the data base
// POST: /api/ai/upload-resume

export const uploadResume = async (req, res) => {
  try {
    const { resumeText, title } = req.body;
    const userId = req.userId;

    if (!resumeText) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const systemPrompt =
      "You are an expert AI agent that extracts structured resume data.";

    const userPrompt = `
Extract resume data and return ONLY valid JSON.
Do NOT include schema definitions, comments, or extra text.

JSON format:
{
  "professional_summary": "",
  "skills": [],
  "personal_info": {
    "image": "",
    "full_name": "",
    "profession": "",
    "email": "",
    "phone": "",
    "location": "",
    "linkedin": "",
    "website": ""
  },
  "experience": [
    {
      "company": "",
      "position": "",
      "start_date": "",
      "end_date": "",
      "description": "",
      "is_current": false
    }
  ],
  "project": [
    {
      "name": "",
      "type": "",
      "description": ""
    }
  ],
  "education": [
    {
      "company": "",
      "degree": "",
      "field": "",
      "graduation_date": "",
      "gpa": ""
    }
  ]
}

Resume text:
${resumeText}
`;

    let parsedData = {};

    try {
      const aiResp = await callAI({
        model: process.env.OPENAI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      });

      const extractedData =
        aiResp?.output_text || aiResp?.choices?.[0]?.message?.content || "{}";

      parsedData = JSON.parse(extractedData);
    } catch (error) {
      const text = resumeText || "";
      const firstLine =
        text
          .split("\n")
          .map((l) => l.trim())
          .find((l) => l.length > 0) || "";
      const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
      const phoneMatch = text.match(/(\+?\d[\d\s\-().]{7,}\d)/);
      const linkedinMatch = text.match(
        /https?:\/\/(?:www\.)?linkedin\.com\/[^\s]+/i
      );
      const websiteMatch = text.match(/https?:\/\/(?!.*linkedin\.com)[^\s]+/i);
      const skillsSection = (() => {
        const lines = text.split("\n");
        const idx = lines.findIndex((l) => /skills?/i.test(l));
        if (idx === -1) return [];
        const chunk = lines.slice(idx + 1, idx + 10).join(" ");
        const items = chunk
          .split(/[•\-\u2022,;]|and/i)
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        return items.slice(0, 20);
      })();
      parsedData = {
        professional_summary: text.slice(0, 600),
        skills: skillsSection,
        personal_info: {
          image: "",
          full_name: firstLine,
          profession: "",
          email: emailMatch ? emailMatch[0] : "",
          phone: phoneMatch ? phoneMatch[0] : "",
          location: "",
          linkedin: linkedinMatch ? linkedinMatch[0] : "",
          website: websiteMatch ? websiteMatch[0] : "",
        },
        experience: [],
        project: [],
        education: [],
      };
    }

    // 🔐 Normalize AI output (VERY IMPORTANT)
    const normalizedData = {
      professional_summary:
        typeof parsedData.professional_summary === "string"
          ? parsedData.professional_summary
          : "",
      skills: Array.isArray(parsedData.skills) ? parsedData.skills : [],
      personal_info:
        typeof parsedData.personal_info === "object"
          ? parsedData.personal_info
          : {},
      experience: Array.isArray(parsedData.experience)
        ? parsedData.experience
        : [],
      project: Array.isArray(parsedData.project) ? parsedData.project : [],
      education: Array.isArray(parsedData.education)
        ? parsedData.education
        : [],
    };

    const newResume = await Resume.create({
      userId,
      title,
      ...normalizedData,
      template: "classic",
      accent_color: "#3B82F6",
      public: false,
    });

    res.status(200).json({ resumeId: newResume._id });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};
