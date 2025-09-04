const OpenAI = require('openai');

// Initialize OpenAI (if API key is available)
let openai = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

// AI-powered profile completion analysis using OpenAI
const analyzeProfileWithAI = async (userData, progressiveData) => {
  if (!openai) {
    console.log('OpenAI not configured, using basic analysis');
    return performBasicAnalysis(userData, progressiveData);
  }

  try {
    const profileAnalysisPrompt = createProfileAnalysisPrompt(userData, progressiveData);
    
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an expert family genealogy and social connection analyst. Analyze user profiles to determine completion status and provide specific recommendations for better family matching. Focus on family connections, genealogy, and social matching."
        },
        {
          role: "user",
          content: profileAnalysisPrompt
        }
      ],
      max_tokens: 1000,
      temperature: 0.3
    });

    const aiResponse = completion.choices[0].message.content;
    return parseAIResponse(aiResponse, userData);

  } catch (error) {
    console.error('OpenAI analysis failed:', error);
    // Fallback to basic analysis
    return performBasicAnalysis(userData, progressiveData);
  }
};

// Create a comprehensive prompt for AI analysis
const createProfileAnalysisPrompt = (user, progressive) => {
  const familyInfo = user.family_info || {};
  const personalInfo = user.personal_info || {};
  const education = user.education || {};
  const progressiveAnswers = progressive?.answers || {};

  return `
Analyze this user profile for family/genealogy matching completeness:

BASIC INFO:
- Name: ${user.first_name} ${user.last_name}
- Age: ${user.date_of_birth ? calculateAge(user.date_of_birth) : 'Unknown'}
- Location: ${user.location || user.current_address || 'Not provided'}
- Bio: ${user.bio || 'Not provided'}

FAMILY INFORMATION:
- Father: ${user.father_name || familyInfo.father_name || 'Not provided'}
- Mother: ${user.mother_name || familyInfo.mother_name || 'Not provided'}
- Siblings: ${user.siblings || familyInfo.siblings || 'Not provided'}
- Family Stories: ${user.family_origin_stories || familyInfo.origin_stories || 'Not provided'}
- Family Traditions: ${user.family_traditions || familyInfo.traditions || 'Not provided'}

EDUCATION:
- Primary School: ${user.primary_school || education.primary_school || 'Not provided'}
- High School: ${user.high_school || education.high_school || 'Not provided'}
- University: ${user.university || education.university || 'Not provided'}

PERSONAL DETAILS:
- Childhood Memories: ${user.childhood_memories || personalInfo.childhood_memories || 'Not provided'}
- Languages: ${user.languages || personalInfo.languages || 'Not provided'}
- Profession: ${user.profession || personalInfo.profession || 'Not provided'}
- Hobbies: ${user.hobbies || personalInfo.hobbies || 'Not provided'}

PROGRESSIVE ANSWERS: ${Object.keys(progressiveAnswers).length} questions answered

Please provide:
1. Completion percentage (0-100)
2. Three most critical missing pieces for family matching
3. Specific recommendations to improve matching potential
4. Estimated time to complete missing information
5. Family tree building potential (high/medium/low)

Format as JSON:
{
  "completionPercentage": number,
  "criticalMissing": ["item1", "item2", "item3"],
  "recommendations": [{"priority": "high/medium/low", "field": "field_name", "reason": "explanation"}],
  "estimatedTime": "X minutes",
  "familyTreePotential": "high/medium/low",
  "matchingInsights": "brief explanation of matching potential"
}
`;
};

// Parse AI response and structure it
const parseAIResponse = (aiResponse, userData) => {
  try {
    // Try to extract JSON from the response
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        aiGenerated: true,
        completionScore: parsed.completionPercentage || 0,
        isComplete: (parsed.completionPercentage || 0) >= 85,
        criticalMissing: parsed.criticalMissing || [],
        recommendations: parsed.recommendations || [],
        estimatedTime: parsed.estimatedTime || '5-10 minutes',
        familyTreePotential: parsed.familyTreePotential || 'medium',
        matchingInsights: parsed.matchingInsights || '',
        aiAnalysis: aiResponse
      };
    }
  } catch (error) {
    console.error('Failed to parse AI response:', error);
  }

  // Fallback to basic analysis if parsing fails
  return performBasicAnalysis(userData);
};

// Basic analysis fallback
const performBasicAnalysis = (user, progressive) => {
  const familyInfo = user.family_info || {};
  const personalInfo = user.personal_info || {};
  const education = user.education || {};

  let score = 0;
  const missing = [];
  const recommendations = [];

  // Core information (30 points)
  if (user.first_name && user.last_name) score += 10;
  else missing.push('full_name');
  
  if (user.date_of_birth) score += 10;
  else missing.push('date_of_birth');
  
  if (user.location || user.current_address) score += 10;
  else missing.push('location');

  // Family information (40 points)
  if (user.father_name || familyInfo.father_name) score += 15;
  else missing.push('father_name');
  
  if (user.mother_name || familyInfo.mother_name) score += 15;
  else missing.push('mother_name');
  
  if (user.family_origin_stories || familyInfo.origin_stories) score += 10;
  else missing.push('family_stories');

  // Personal details (20 points)
  if (user.bio && user.bio.length > 20) score += 10;
  else missing.push('personal_bio');
  
  if (user.profile_picture_url) score += 10;
  else missing.push('profile_photo');

  // Education (10 points)
  if (user.high_school || education.high_school) score += 5;
  if (user.university || education.university) score += 5;
  if (!user.high_school && !education.high_school) missing.push('education');

  // Generate recommendations based on missing fields
  missing.forEach(field => {
    let priority = 'medium';
    let reason = 'Helps improve matching';

    if (['father_name', 'mother_name', 'date_of_birth'].includes(field)) {
      priority = 'high';
      reason = 'Critical for family tree building and genealogy matching';
    } else if (['full_name', 'location'].includes(field)) {
      priority = 'high';
      reason = 'Essential for basic profile identification';
    }

    recommendations.push({
      priority,
      field,
      reason
    });
  });

  return {
    aiGenerated: false,
    completionScore: Math.min(score, 100),
    isComplete: score >= 85,
    criticalMissing: missing.slice(0, 3),
    recommendations,
    estimatedTime: `${Math.ceil(missing.length * 1.5)}-${missing.length * 3} minutes`,
    familyTreePotential: score >= 60 ? 'high' : score >= 30 ? 'medium' : 'low',
    matchingInsights: `Profile has ${score}% completion. ${score >= 85 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Limited'} potential for family matching.`
  };
};

// Calculate age from date of birth
const calculateAge = (dateOfBirth) => {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
};

// Smart matching recommendations using AI
const generateMatchingRecommendations = async (userData) => {
  if (!openai) {
    return generateBasicMatchingRecommendations(userData);
  }

  try {
    const prompt = `
Based on this user profile, recommend specific actions to improve family and social matching:

User: ${userData.first_name} ${userData.last_name}
Location: ${userData.location || 'Unknown'}
Family: Father: ${userData.father_name || 'Unknown'}, Mother: ${userData.mother_name || 'Unknown'}
Education: ${userData.high_school || 'Unknown'} / ${userData.university || 'Unknown'}

Provide 3-5 specific, actionable recommendations that would most improve their matching potential.
Focus on family connections, genealogy research, and social networking.

Format as a JSON array of objects with: title, description, impact (high/medium/low), estimatedTime
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 500,
      temperature: 0.4
    });

    const response = completion.data.choices[0].message.content;
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('AI matching recommendations failed:', error);
  }

  return generateBasicMatchingRecommendations(userData);
};

const generateBasicMatchingRecommendations = (userData) => {
  return [
    {
      title: "Add Family Information",
      description: "Include your parents' names and family stories to improve family tree matching",
      impact: "high",
      estimatedTime: "3-5 minutes"
    },
    {
      title: "Complete Education History", 
      description: "Add your schools to connect with classmates and alumni",
      impact: "medium",
      estimatedTime: "2-3 minutes"
    },
    {
      title: "Share Personal Stories",
      description: "Add childhood memories and family traditions for better connections",
      impact: "medium", 
      estimatedTime: "5-10 minutes"
    }
  ];
};

module.exports = {
  analyzeProfileWithAI,
  generateMatchingRecommendations,
  performBasicAnalysis
};