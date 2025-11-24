const natural = require("natural");
const compromise = require("compromise");
const pdf = require("pdf-parse");

// Skill database
const SKILLS_DB = [
  "javascript",
  "react",
  "node.js",
  "python",
  "java",
  "html",
  "css",
  "mongodb",
  "sql",
  "aws",
  "docker",
  "kubernetes",
  "git",
  "typescript",
  "angular",
  "vue",
  "express",
  "django",
  "flask",
  "php",
  "c++",
  "c#",
  "ruby",
  "swift",
  "kotlin",
  "go",
  "rust",
  "machine learning",
  "ai",
  "data analysis",
  "project management",
  "agile",
  "scrum",
  "devops",
];

class AIProcessor {
  // Extract text from PDF
  static async extractTextFromPDF(dataBuffer) {
    try {
      // pdf-parse expects a buffer, but let's ensure it's properly formatted
      const data = await pdf(dataBuffer);
      return data.text || "";
    } catch (error) {
      console.warn("PDF parsing failed, returning empty text:", error.message);
      // Return a default message instead of empty string for better UX
      return "Resume uploaded but AI processing failed. Skills will be added manually.";
    }
  }

  // Extract skills from text
  static extractSkills(text) {
    const foundSkills = [];
    const textLower = text.toLowerCase();

    SKILLS_DB.forEach((skill) => {
      if (textLower.includes(skill.toLowerCase())) {
        foundSkills.push(skill);
      }
    });

    // Use NLP to find additional skills
    const tokenizer = new natural.WordTokenizer();
    const tokens = tokenizer.tokenize(textLower);

    tokens.forEach((token) => {
      if (
        token.length > 2 &&
        !foundSkills.includes(token) &&
        SKILLS_DB.some((skill) => skill.includes(token))
      ) {
        foundSkills.push(token);
      }
    });

    return [...new Set(foundSkills)]; // Remove duplicates
  }

  // Advanced multi-dimensional match score calculation
  static calculateMatchScore(
    candidateSkills,
    jobRequiredSkills,
    jobNiceToHaveSkills,
    candidate = null,
    job = null
  ) {
    let totalScore = 0;
    const maxScore = 100;

    // 1. Technical Skills Matching (50% weight)
    const technicalScore = this.calculateTechnicalMatch(
      candidateSkills,
      jobRequiredSkills,
      jobNiceToHaveSkills
    );
    totalScore += technicalScore * 0.5;

    // 2. Experience Level Matching (20% weight)
    const experienceScore = this.calculateExperienceMatch(candidate, job);
    totalScore += experienceScore * 0.2;

    // 3. Cultural Fit Prediction (15% weight)
    const culturalScore = this.calculateCulturalFit(candidate, job);
    totalScore += culturalScore * 0.15;

    // 4. Success Probability (15% weight)
    const successScore = this.calculateSuccessProbability(candidate, job);
    totalScore += successScore * 0.15;

    return Math.min(Math.round(totalScore), maxScore);
  }

  // Technical skills matching with advanced logic
  static calculateTechnicalMatch(
    candidateSkills,
    jobRequiredSkills,
    jobNiceToHaveSkills
  ) {
    const candidateSkillsLower = candidateSkills.map((s) => s.toLowerCase());
    const requiredLower = jobRequiredSkills.map((s) => s.toLowerCase());
    const niceToHaveLower = jobNiceToHaveSkills.map((s) => s.toLowerCase());

    // Required skills (70% of technical score)
    const requiredMatches = requiredLower.filter((skill) =>
      candidateSkillsLower.some((candidateSkill) =>
        this.isSkillMatch(candidateSkill, skill)
      )
    ).length;

    const requiredScore =
      (requiredMatches / Math.max(requiredLower.length, 1)) * 70;

    // Nice-to-have skills (30% of technical score)
    const niceMatches = niceToHaveLower.filter((skill) =>
      candidateSkillsLower.some((candidateSkill) =>
        this.isSkillMatch(candidateSkill, skill)
      )
    ).length;

    const niceScore = (niceMatches / Math.max(niceToHaveLower.length, 1)) * 30;

    return Math.min(requiredScore + niceScore, 100);
  }

  // Intelligent skill matching with fuzzy logic
  static isSkillMatch(candidateSkill, jobSkill) {
    // Safety checks for undefined or non-string inputs
    if (
      !candidateSkill ||
      !jobSkill ||
      typeof candidateSkill !== "string" ||
      typeof jobSkill !== "string"
    ) {
      return false;
    }

    if (candidateSkill === jobSkill) return true;

    // Check for common variations and related skills
    const skillMappings = {
      javascript: [
        "js",
        "ecmascript",
        "node.js",
        "nodejs",
        "react",
        "vue",
        "angular",
      ],
      python: ["django", "flask", "pandas", "numpy", "tensorflow", "pytorch"],
      java: ["spring", "hibernate", "maven", "gradle"],
      aws: ["amazon web services", "ec2", "s3", "lambda", "cloudformation"],
      react: ["react.js", "jsx", "redux", "next.js"],
      "node.js": ["nodejs", "express", "npm", "javascript"],
      sql: ["mysql", "postgresql", "oracle", "database", "rdbms"],
      docker: ["kubernetes", "containerization", "k8s"],
      git: ["github", "gitlab", "version control", "svn"],
    };

    const candidateLower = candidateSkill.toLowerCase();
    const jobLower = jobSkill.toLowerCase();

    // Direct mapping check
    if (skillMappings[jobLower]?.includes(candidateLower)) return true;
    if (skillMappings[candidateLower]?.includes(jobLower)) return true;

    // Fuzzy matching for close matches
    return this.calculateStringSimilarity(candidateLower, jobLower) > 0.8;
  }

  // Simple string similarity for fuzzy matching
  static calculateStringSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  // Levenshtein distance for string comparison
  static levenshteinDistance(str1, str2) {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[str2.length][str1.length];
  }

  // Experience level matching
  static calculateExperienceMatch(candidate, job) {
    if (!candidate?.experience || !job?.experience) return 50; // Neutral score

    const candidateExp = candidate.experience;
    const requiredExp = job.experience || 0;

    if (candidateExp >= requiredExp) {
      // Bonus for overqualified candidates (up to 20% bonus)
      const overQualification = Math.min(
        (candidateExp - requiredExp) / requiredExp,
        0.5
      );
      return Math.min(100, 80 + overQualification * 20);
    } else {
      // Penalty for underqualified (up to 50% penalty)
      const underQualification = (requiredExp - candidateExp) / requiredExp;
      return Math.max(0, 100 - underQualification * 50);
    }
  }

  // Cultural fit prediction (simplified model)
  static calculateCulturalFit(candidate, job) {
    // This would be enhanced with actual cultural assessment data
    // For now, return a neutral score based on available data
    let score = 50;

    // Adjust based on education level alignment
    if (candidate?.education && job?.title) {
      const educationLevel = this.getEducationLevel(candidate.education);
      const jobLevel = this.getJobLevel(job.title);

      if (Math.abs(educationLevel - jobLevel) <= 1) {
        score += 20;
      } else if (Math.abs(educationLevel - jobLevel) > 2) {
        score -= 20;
      }
    }

    return Math.max(0, Math.min(100, score));
  }

  // Success probability prediction
  static calculateSuccessProbability(candidate, job) {
    let probability = 50; // Base probability

    // Factor 1: Skill alignment (30% weight)
    if (candidate?.skills && job?.requiredSkills) {
      // Filter out invalid skills and ensure we have valid skill names
      const validCandidateSkills = candidate.skills
        .filter((skill) => skill && typeof skill === "string" && skill.trim())
        .map((skill) => skill.trim());

      if (validCandidateSkills.length > 0) {
        const skillMatch =
          validCandidateSkills.filter((skill) =>
            job.requiredSkills.some((reqSkill) =>
              this.isSkillMatch(skill, reqSkill)
            )
          ).length / Math.max(job.requiredSkills.length, 1);
        probability += (skillMatch - 0.5) * 30;
      }
    }

    // Factor 2: Experience alignment (20% weight)
    if (candidate?.experience && job?.experience) {
      const expRatio = candidate.experience / Math.max(job.experience, 1);
      if (expRatio >= 1) {
        probability += 20;
      } else if (expRatio >= 0.7) {
        probability += 10;
      } else {
        probability -= 10;
      }
    }

    // Factor 3: Company stability (10% weight)
    if (candidate?.currentCompany) {
      // Prefer candidates with stable employment history
      probability += 10;
    }

    return Math.max(0, Math.min(100, probability));
  }

  // Helper methods for cultural fit
  static getEducationLevel(education) {
    const levels = {
      "high school": 1,
      associate: 2,
      bachelor: 3,
      master: 4,
      phd: 5,
      doctorate: 5,
    };

    // Normalize input: education may be a string, an object, or an array of objects
    let texts = [];

    if (!education) return 3;

    if (Array.isArray(education)) {
      education.forEach((entry) => {
        if (!entry) return;
        if (typeof entry === "string") texts.push(entry);
        else if (typeof entry === "object") {
          if (entry.degree) texts.push(String(entry.degree));
          if (entry.fieldOfStudy) texts.push(String(entry.fieldOfStudy));
          if (entry.institution) texts.push(String(entry.institution));
        }
      });
    } else if (typeof education === "object") {
      if (education.degree) texts.push(String(education.degree));
      if (education.fieldOfStudy) texts.push(String(education.fieldOfStudy));
      if (education.institution) texts.push(String(education.institution));
    } else if (typeof education === "string") {
      texts.push(education);
    } else {
      // Unknown type — fallback
      try {
        texts.push(String(education));
      } catch (e) {
        return 3;
      }
    }

    const combined = texts.join(" ").toLowerCase();
    for (const [key, value] of Object.entries(levels)) {
      if (combined.includes(key)) return value;
    }

    // Try some heuristics on degree abbreviations
    if (combined.match(/\bphd\b|\bdoctorate\b/)) return 5;
    if (combined.match(/\bmasters?\b|\bmsc\b|\bma\b|\bms\b/)) return 4;
    if (combined.match(/\bbachelor\b|\bbs?c\b|\bba\b|\bbsc\b/)) return 3;
    if (combined.match(/\bassociate\b|\bassoc\b|\baa\b/)) return 2;
    if (combined.match(/\bhigh school\b|\bhs\b/)) return 1;

    return 3; // Default to bachelor's level
  }

  static getJobLevel(jobTitle) {
    const titleLower = jobTitle.toLowerCase();

    if (
      titleLower.includes("senior") ||
      titleLower.includes("lead") ||
      titleLower.includes("principal")
    ) {
      return 4;
    } else if (
      titleLower.includes("mid") ||
      titleLower.includes("intermediate")
    ) {
      return 3;
    } else if (titleLower.includes("junior") || titleLower.includes("entry")) {
      return 2;
    }
    return 3; // Default level
  }

  // Advanced bias detection and diversity analysis
  static analyzeBias(text) {
    const biasCategories = {
      gender: {
        terms: [
          "he",
          "she",
          "him",
          "her",
          "his",
          "hers",
          "male",
          "female",
          "man",
          "woman",
          "guy",
          "gal",
          "boy",
          "girl",
        ],
        weight: 3,
        suggestions: [
          'Use "they" or "person" instead',
          "Focus on skills and experience",
        ],
      },
      age: {
        terms: [
          "young",
          "old",
          "recent graduate",
          "fresh",
          "energetic",
          "mature",
          "seasoned",
          "junior",
          "senior",
          "youthful",
        ],
        weight: 2,
        suggestions: [
          "Focus on experience level rather than age",
          'Use "experienced" instead of age descriptors',
        ],
      },
      familial: {
        terms: [
          "family",
          "parent",
          "mother",
          "father",
          "wife",
          "husband",
          "married",
          "single",
          "kids",
          "children",
        ],
        weight: 4,
        suggestions: [
          "Avoid questions about family status",
          "Focus on work availability and commitment",
        ],
      },
      cultural: {
        terms: [
          "ethnic",
          "race",
          "religion",
          "nationality",
          "accent",
          "immigrant",
          "foreigner",
          "native",
        ],
        weight: 5,
        suggestions: [
          "Focus on skills and qualifications",
          "Emphasize diversity and inclusion",
        ],
      },
      socioeconomic: {
        terms: [
          "wealthy",
          "poor",
          "rich",
          "affluent",
          "privileged",
          "disadvantaged",
          "elite",
          "working class",
        ],
        weight: 3,
        suggestions: [
          "Focus on skills and potential",
          "Emphasize growth opportunities",
        ],
      },
      ableist: {
        terms: [
          "disabled",
          "handicapped",
          "wheelchair",
          "deaf",
          "blind",
          "chronic",
          "illness",
          "condition",
        ],
        weight: 4,
        suggestions: [
          "Focus on essential job functions",
          "Emphasize reasonable accommodations",
        ],
      },
      exclusive: {
        terms: [
          "rockstar",
          "ninja",
          "guru",
          "wizard",
          "superhero",
          "unicorn",
          "magical",
          "genius",
        ],
        weight: 2,
        suggestions: [
          "Use professional language",
          "Focus on specific skills and achievements",
        ],
      },
    };

    let biasScore = 100; // Start with perfect score
    const foundBiases = [];
    const textLower = text.toLowerCase();

    // Analyze each bias category
    Object.entries(biasCategories).forEach(([category, config]) => {
      config.terms.forEach((term) => {
        const regex = new RegExp(`\\b${term}\\b`, "gi");
        const matches = text.match(regex);
        if (matches) {
          const deduction = config.weight * matches.length;
          biasScore -= deduction;

          foundBiases.push({
            category,
            term,
            count: matches.length,
            weight: config.weight,
            totalDeduction: deduction,
            suggestions: config.suggestions,
          });
        }
      });
    });

    // Additional analysis for language patterns
    const languageAnalysis = this.analyzeLanguagePatterns(text);

    // Diversity and inclusion scoring
    const diversityScore = this.calculateDiversityScore(text, foundBiases);

    return {
      biasScore: Math.max(biasScore, 0),
      diversityScore,
      foundBiases,
      languageAnalysis,
      genderNeutral: !foundBiases.some((bias) => bias.category === "gender"),
      inclusiveLanguage: foundBiases.length === 0,
      riskLevel:
        biasScore >= 80
          ? "Low Risk"
          : biasScore >= 60
          ? "Medium Risk"
          : biasScore >= 40
          ? "High Risk"
          : "Critical Risk",
      recommendations: this.generateRecommendations(
        foundBiases,
        languageAnalysis
      ),
      compliance: {
        eeocCompliant: biasScore >= 70,
        diversityFriendly: diversityScore >= 70,
        modernLanguage: languageAnalysis.modernScore >= 70,
      },
    };
  }

  // Analyze language patterns for modernity and inclusivity
  static analyzeLanguagePatterns(text) {
    const modernIndicators = {
      inclusive: [
        "they/them",
        "team player",
        "collaborative",
        "diverse",
        "inclusive",
        "equity",
      ],
      outdated: [
        "he/him",
        "rockstar",
        "ninja",
        "guru",
        "workaholic",
        "passionate about",
      ],
    };

    let modernScore = 50;
    const patterns = [];

    // Check for inclusive language
    modernIndicators.inclusive.forEach((term) => {
      if (text.toLowerCase().includes(term.toLowerCase())) {
        modernScore += 5;
        patterns.push({ type: "inclusive", term, impact: 5 });
      }
    });

    // Check for outdated language
    modernIndicators.outdated.forEach((term) => {
      if (text.toLowerCase().includes(term.toLowerCase())) {
        modernScore -= 3;
        patterns.push({ type: "outdated", term, impact: -3 });
      }
    });

    return {
      modernScore: Math.max(0, Math.min(100, modernScore)),
      patterns,
      readability: this.calculateReadability(text),
      tone: this.analyzeTone(text),
    };
  }

  // Calculate diversity score
  static calculateDiversityScore(text, foundBiases) {
    let score = 100;

    // Deduct for each bias found
    score -= foundBiases.length * 5;

    // Bonus for diversity-friendly language
    const diversityTerms = [
      "diverse",
      "inclusion",
      "equity",
      "belonging",
      "multicultural",
      "diversity",
    ];
    diversityTerms.forEach((term) => {
      if (text.toLowerCase().includes(term)) {
        score += 3;
      }
    });

    return Math.max(0, Math.min(100, score));
  }

  // Generate actionable recommendations
  static generateRecommendations(foundBiases, languageAnalysis) {
    const recommendations = [];

    // Bias-specific recommendations
    foundBiases.forEach((bias) => {
      recommendations.push(...bias.suggestions);
    });

    // Language pattern recommendations
    if (languageAnalysis.modernScore < 60) {
      recommendations.push(
        "Consider updating language to be more modern and inclusive"
      );
      recommendations.push(
        "Replace outdated terms with contemporary equivalents"
      );
    }

    // Readability recommendations
    if (languageAnalysis.readability < 60) {
      recommendations.push("Simplify complex sentences for better readability");
      recommendations.push("Use shorter paragraphs and clearer language");
    }

    // Remove duplicates and limit to top 5
    return [...new Set(recommendations)].slice(0, 5);
  }

  // Simple readability calculation
  static calculateReadability(text) {
    const sentences = text.split(/[.!?]+/).length;
    const words = text.split(/\s+/).length;
    const avgWordsPerSentence = words / sentences;

    // Simple readability score (lower is better readability)
    let score = 100;
    if (avgWordsPerSentence > 20) score -= 20;
    if (avgWordsPerSentence > 25) score -= 20;

    return Math.max(0, Math.min(100, score));
  }

  // Basic tone analysis
  static analyzeTone(text) {
    const positiveWords = [
      "excited",
      "opportunity",
      "growth",
      "innovative",
      "dynamic",
      "collaborative",
    ];
    const negativeWords = [
      "demanding",
      "challenging",
      "difficult",
      "stressful",
      "competitive",
      "intense",
    ];

    let positiveCount = 0;
    let negativeCount = 0;

    const textLower = text.toLowerCase();
    positiveWords.forEach((word) => {
      if (textLower.includes(word)) positiveCount++;
    });
    negativeWords.forEach((word) => {
      if (textLower.includes(word)) negativeCount++;
    });

    if (positiveCount > negativeCount) return "positive";
    if (negativeCount > positiveCount) return "challenging";
    return "neutral";
  }

  // Parse resume from file path
  static async parseResume(filePath) {
    try {
      const fs = require("fs");
      const buffer = fs.readFileSync(filePath);
      const text = await this.extractTextFromPDF(buffer);

      const skills = this.extractSkills(text);
      const experience = this.extractExperience(text);

      // Extract education (basic implementation)
      const education = this.extractEducation(text);

      // Extract contact information (basic implementation)
      const contact = this.extractContactInfo(text);

      return {
        skills,
        experience,
        education,
        contact,
        rawText: text,
      };
    } catch (error) {
      console.error("Resume parsing error:", error);
      return {
        skills: [],
        experience: 0,
        education: [],
        contact: {},
        rawText: "Error parsing resume",
      };
    }
  }

  // Extract education from text
  static extractEducation(text) {
    const educationKeywords = [
      "bachelor",
      "master",
      "phd",
      "degree",
      "university",
      "college",
      "school",
    ];
    const lines = text.split("\n");
    const education = [];

    lines.forEach((line) => {
      const lowerLine = line.toLowerCase();
      if (educationKeywords.some((keyword) => lowerLine.includes(keyword))) {
        education.push(line.trim());
      }
    });

    return education;
  }

  // Extract contact information
  static extractContactInfo(text) {
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const phoneRegex =
      /(\+?\d{1,3}[-.\s]?)?\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})\b/g;

    const emails = text.match(emailRegex) || [];
    const phones = text.match(phoneRegex) || [];

    return {
      email: emails[0] || null,
      phone: phones[0] || null,
    };
  }

  // Extract experience from text
  static extractExperience(text) {
    const yearsRegex = /(\d+)\s*(?:years?|yrs?)/gi;
    const matches = [...text.matchAll(yearsRegex)];
    if (matches.length > 0) {
      return Math.max(...matches.map((m) => parseInt(m[1])));
    }
    return 0;
  }
}

module.exports = AIProcessor;
