import Resume from "../models/Resume.js";
import ai from "../configs/ai.js";
import https from "https";

let nigeriaCache = { names: [], updatedAt: 0 };
let globalCache = { names: [], updatedAt: 0 };

const getJSONCommon = async (url, ms = 5000) => {
  if (typeof fetch === "function") {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), ms);
    try {
      const resp = await fetch(url, { signal: controller.signal });
      clearTimeout(id);
      if (!resp.ok) return [];
      return await resp.json();
    } catch {
      clearTimeout(id);
    }
  }
  return await new Promise((resolve) => {
    const req = https.get(url, (resp) => {
      let data = "";
      resp.on("data", (chunk) => (data += chunk));
      resp.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve([]);
        }
      });
    });
    req.on("error", () => resolve([]));
    req.setTimeout(ms, () => {
      try {
        req.destroy();
      } catch {}
      resolve([]);
    });
  });
};

export const listUniversities = async (req, res) => {
  try {
    const country = (req.query.country || "").trim();
    const now = Date.now();
    const ttl = 24 * 60 * 60 * 1000;

    if (country) {
      if (!nigeriaCache.names.length || now - nigeriaCache.updatedAt > ttl) {
        const names = await buildCache(country);
        nigeriaCache = { names, updatedAt: now };
      }
      return res.status(200).json({ suggestions: nigeriaCache.names });
    } else {
      if (!globalCache.names.length || now - globalCache.updatedAt > ttl) {
        const names = await buildCache("");
        globalCache = { names, updatedAt: now };
      }
      return res.status(200).json({ suggestions: globalCache.names });
    }
  } catch (error) {
    return res.status(200).json({ suggestions: [] });
  }
};
const buildCache = async (country) => {
  const prefixes = [
    "a",
    "b",
    "c",
    "d",
    "e",
    "f",
    "g",
    "h",
    "i",
    "j",
    "k",
    "l",
    "m",
    "n",
    "o",
    "p",
    "q",
    "r",
    "s",
    "t",
    "u",
    "v",
    "w",
    "x",
    "y",
    "z",
  ];
  const seen = new Set();
  const names = [];
  for (const p of prefixes) {
    const url =
      "https://universities.hipolabs.com/search?name=" +
      encodeURIComponent(p) +
      (country ? "&country=" + encodeURIComponent(country) : "");
    const list = await getJSONCommon(url);
    for (const u of list) {
      const n = u?.name ? String(u.name).trim() : "";
      if (n && !seen.has(n)) {
        names.push(n);
        seen.add(n);
      }
    }
  }
  names.sort((a, b) => a.localeCompare(b));
  return names;
};

// controller for enhacing resume professional summary
// POST: /api/ai/enhance-pro-sum

const callAI = async ({ messages, response_format }) => {
  try {
    const prompt = messages.map((m) => m.content).join("\n\n");

    // For JSON response
    if (response_format?.type === "json_object") {
      const result = await ai.generateContent(
        prompt + "\n\nReturn strictly valid JSON."
      );
      const text = result.response.text();
      // Clean up markdown code blocks if present
      const cleanedText = text.replace(/```json\n?|\n?```/g, "").trim();
      return { output_text: cleanedText };
    }

    // For normal text
    const result = await ai.generateContent(prompt);
    return { output_text: result.response.text() };
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

export const enhanceProfessionalSummary = async (req, res) => {
  try {
    const { userContent } = req.body;

    if (!userContent) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const aiResp = await callAI({
      messages: [
        {
          role: "user",
          content: `You are an expert in resume writing. Enhance the following professional summary into 1–2 ATS-friendly sentences: ${userContent}`,
        },
      ],
    });

    let out = aiResp.output_text || "";
    out = out
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .join(" ");
    out = out
      .replace(/[*_`~]+/g, "")
      .replace(/\s+/g, " ")
      .trim();
    const sentences = out.split(/[.!?]\s+/).slice(0, 2);
    if (sentences.length > 0) {
      const joined = sentences.join(". ");
      out = /[.!?]$/.test(joined) ? joined : joined + ".";
    }
    res.status(200).json({ enhancedContent: out });
  } catch (error) {
    console.error("AI Controller Error:", error);
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

    const hasBullets =
      /(^|\n)\s*(?:[-•*]|[0-9]+\.)\s+/.test(userContent) ||
      userContent
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0).length >= 4;

    const prompt = hasBullets
      ? `You are an expert resume writer. Rewrite the following as 4–8 concise bullet points. Each bullet MUST be one line (≤18 words), start with "• " and use strong action verbs; quantify impact when possible. Return ONLY the bullets as plain text with no headings, numbering, labels, or extra text.
Text:
${userContent}`
      : `You are an expert resume writer. Rewrite the following job description as exactly ONE concise ATS-friendly sentence (22–32 words). Use strong action verbs, quantify impact when possible. Return ONLY plain text with no headings, bullets, labels, markdown, or special characters.
Text:
${userContent}`;

    const aiResp = await callAI({
      messages: [{ role: "user", content: prompt }],
    });

    let out = aiResp.output_text || "";

    if (hasBullets) {
      const lines = out
        .split("\n")
        .map((l) => l.trim())
        .filter(
          (l) =>
            l.length > 0 &&
            !/^\s*(\*{0,3}\s*)?option/i.test(l) &&
            !/^\s*\*{3}\s*$/.test(l)
        )
        .map((l) => l.replace(/^\s*(?:[-•*]|[0-9]+\.)\s*/, "").trim())
        .map((l) => l.replace(/\s+/g, " "))
        .slice(0, 8);
      const normalized = lines.map((l) => (l.startsWith("• ") ? l : "• " + l));
      out = normalized.join("\n").trim();
    } else {
      out = out
        .split("\n")
        .filter(
          (l) => !/^\s*(\*{0,3}\s*)?option/i.test(l) && !/^\s*\*{3}\s*$/.test(l)
        )
        .join(" ");
      out = out.replace(/\s+/g, " ").trim();
      const sentences = out.split(/[.!?]\s+/);
      if (sentences.length > 0) {
        const first = sentences[0].trim();
        out = first.endsWith(".") ? first : first + ".";
      }
    }
    res.status(200).json({ enhancedContent: out });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

export const uploadResume = async (req, res) => {
  try {
    const { resumeText } = req.body;

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
      "institution": "",
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
        messages: [
          { role: "user", content: systemPrompt + "\n\n" + userPrompt },
        ],
        response_format: { type: "json_object" },
      });

      parsedData = JSON.parse(aiResp.output_text);
    } catch (error) {
      console.error("AI Parsing failed, using fallback:", error);
      const text = resumeText || "";

      let lines = text
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      // If text seems to be one blob, try splitting by multiple spaces (common in PDF extraction)
      if (lines.length === 0 || (lines.length === 1 && lines[0].length > 100)) {
        const spaceSplit = text
          .split(/\s{4,}/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        if (spaceSplit.length > 1) {
          lines = spaceSplit;
        }
      }

      // --- Helper Functions for Rule-Based Parsing ---
      const findSectionStartIndex = (keywords) => {
        // 1. Try strict match first (short line + keyword)
        let idx = lines.findIndex(
          (line) =>
            line.length < 50 &&
            keywords.some((keyword) =>
              line.toLowerCase().includes(keyword.toLowerCase())
            )
        );

        // 2. If not found, try looser match (just keyword, but check it's not a long sentence)
        if (idx === -1) {
          idx = lines.findIndex(
            (line) =>
              line.length < 80 &&
              keywords.some((keyword) =>
                line.toLowerCase().includes(keyword.toLowerCase())
              )
          );
        }
        return idx;
      };

      const extractSectionContent = (startIndex, endKeywords) => {
        if (startIndex === -1) return "";
        let content = "";
        for (let i = startIndex + 1; i < lines.length; i++) {
          // Check if this line looks like a start of another section
          const isNextSection = endKeywords.some(
            (keyword) =>
              lines[i].length < 50 &&
              lines[i].toLowerCase().includes(keyword.toLowerCase())
          );

          if (isNextSection) {
            break;
          }
          content += lines[i] + "\n";
        }
        return content.trim();
      };

      // 1. Personal Info Extraction
      let firstLine = lines[0] || "";
      const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
      const phoneMatch = text.match(/(\+?\d[\d\s\-().]{7,}\d)/);
      const linkedinMatch = text.match(
        /https?:\/\/(?:www\.)?linkedin\.com\/[^\s]+/i
      );
      const websiteMatch = text.match(/https?:\/\/(?!.*linkedin\.com)[^\s]+/i);

      // Smart Name Cleaning
      if (emailMatch) {
        const idx = firstLine.indexOf(emailMatch[0]);
        if (idx > 0) firstLine = firstLine.substring(0, idx).trim();
      }
      if (phoneMatch && phoneMatch[0].length > 6) {
        const idx = firstLine.indexOf(phoneMatch[0]);
        if (idx > 0) firstLine = firstLine.substring(0, idx).trim();
      }
      if (firstLine.length > 50) firstLine = firstLine.substring(0, 50) + "...";

      // 2. Sections Indices
      const experienceIdx = findSectionStartIndex([
        "experience",
        "employment",
        "work history",
        "professional experience",
      ]);
      const educationIdx = findSectionStartIndex([
        "education",
        "academic",
        "qualifications",
      ]);
      const skillsIdx = findSectionStartIndex([
        "skills",
        "technologies",
        "competencies",
        "technical skills",
        "core competencies",
      ]);
      const projectsIdx = findSectionStartIndex([
        "projects",
        "portfolio",
        "personal projects",
      ]);
      const summaryIdx = findSectionStartIndex([
        "summary",
        "profile",
        "objective",
        "professional summary",
      ]);

      // 3. Extract Content
      // Experience
      const experienceRaw = extractSectionContent(experienceIdx, [
        "education",
        "skills",
        "projects",
        "certifications",
        "summary",
        "profile",
      ]);
      let experienceItems = [];
      if (experienceRaw) {
        experienceItems = experienceRaw
          .split(/\n\s*\n/)
          .map((block) => {
            const lines = block.split("\n");
            return {
              company: lines[0] || "",
              position: lines[1] || "",
              start_date: "",
              end_date: "",
              description: block, // Keep full block in description so nothing is lost
              is_current: false,
            };
          })
          .slice(0, 3);
      }

      // Education
      const educationRaw = extractSectionContent(educationIdx, [
        "skills",
        "projects",
        "certifications",
        "experience",
        "summary",
      ]);
      let educationItems = [];
      if (educationRaw) {
        educationItems = educationRaw
          .split(/\n\s*\n/)
          .map((block) => {
            const lines = block.split("\n");
            return {
              institution: lines[0] || "",
              degree: lines[1] || "",
              field: "",
              graduation_date: "",
              gpa: "",
            };
          })
          .slice(0, 2);
      }

      // Skills
      let skillsList = [];
      if (skillsIdx !== -1) {
        const skillsRaw = extractSectionContent(skillsIdx, [
          "experience",
          "education",
          "projects",
          "summary",
        ]);
        skillsList = skillsRaw
          .split(/[•\-\u2022,;]|\n/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && s.length < 40) // Increased length slightly
          .slice(0, 20);
      }

      // Summary
      let summaryText = "";
      if (summaryIdx !== -1) {
        summaryText = extractSectionContent(summaryIdx, [
          "experience",
          "education",
          "skills",
          "projects",
        ]);
      } else if (experienceIdx > 1) {
        // If no explicit summary header, assume text before first section is summary (skipping name/contact)
        // Be careful not to include name (line 0)
        summaryText = lines.slice(1, experienceIdx).join("\n");
      }
      if (summaryText.length > 800) summaryText = summaryText.slice(0, 800);

      parsedData = {
        professional_summary: summaryText,
        skills: skillsList,
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
        experience: experienceItems,
        project: [],
        education: educationItems,
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
        ? parsedData.education.map((e) =>
            e && !e.institution && e.company
              ? { ...e, institution: e.company }
              : e
          )
        : [],
    };

    const userId = req.userId;
    const { title } = req.body;
    const newResume = await Resume.create({
      userId,
      title: title || "Untitled Resume",
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

export const searchUniversities = async (req, res) => {
  try {
    let q = (req.query.q || req.query.query || "").trim();
    const lower = q.toLowerCase();
    const corrected = lower
      .replace(/\buniveristy\b/g, "university")
      .replace(/\buniverisity\b/g, "university")
      .replace(/\buniversoty\b/g, "university")
      .replace(/\buniservity\b/g, "university");
    q = corrected;
    if (!q || q.length < 2) {
      return res.status(200).json({ suggestions: [] });
    }
    const getJSON = async (url, ms = 2000) => {
      if (typeof fetch === "function") {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), ms);
        try {
          const resp = await fetch(url, { signal: controller.signal });
          clearTimeout(id);
          if (!resp.ok) return [];
          return await resp.json();
        } catch {
          clearTimeout(id);
        }
      }
      return await new Promise((resolve) => {
        const req = https.get(url, (resp) => {
          let data = "";
          resp.on("data", (chunk) => (data += chunk));
          resp.on("end", () => {
            try {
              resolve(JSON.parse(data));
            } catch {
              resolve([]);
            }
          });
        });
        req.on("error", () => resolve([]));
        req.setTimeout(ms, () => {
          try {
            req.destroy();
          } catch {}
          resolve([]);
        });
      });
    };
    const nigeriaUrl = `https://universities.hipolabs.com/search?name=${encodeURIComponent(
      q
    )}&country=Nigeria`;
    const globalUrl = `https://universities.hipolabs.com/search?name=${encodeURIComponent(
      q
    )}`;
    const [r1, r2] = await Promise.all([
      getJSON(nigeriaUrl),
      getJSON(globalUrl),
    ]);
    const names = [];
    const seen = new Set();
    [...r1, ...r2].forEach((u) => {
      const n = (u && u.name ? String(u.name).trim() : "") || "";
      if (n && !seen.has(n)) {
        names.push(n);
        seen.add(n);
      }
    });
    if (names.length === 0) {
      const tokens = q
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 3);
      const extraResults = await Promise.all(
        tokens.map((t) =>
          getJSON(
            `https://universities.hipolabs.com/search?name=${encodeURIComponent(
              t
            )}`
          )
        )
      );
      extraResults.flat().forEach((u) => {
        const n = (u && u.name ? String(u.name).trim() : "") || "";
        if (n && !seen.has(n)) {
          names.push(n);
          seen.add(n);
        }
      });
    }
    if (names.length === 0) {
      const nigeriaOnly = await getJSON(
        "https://universities.hipolabs.com/search?country=Nigeria"
      );
      nigeriaOnly.forEach((u) => {
        const n = (u && u.name ? String(u.name).trim() : "") || "";
        if (n && !seen.has(n)) {
          names.push(n);
          seen.add(n);
        }
      });
    }
    return res.status(200).json({ suggestions: names.slice(0, 25) });
  } catch (error) {
    return res.status(200).json({ suggestions: [] });
  }
};
