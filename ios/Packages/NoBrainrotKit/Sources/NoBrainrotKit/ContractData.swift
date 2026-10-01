// pnpm ios:contract - generated from src/native/contract.ts, do not edit by hand

/// The extension's catalog of switches, topics and defaults, as JSON.
enum ContractData {
    static let json = #"""
{
  "protocolVersion": 1,
  "siteHosts": [
    "m.youtube.com",
    "www.youtube.com"
  ],
  "siteAccessValues": [
    "granted",
    "not-granted",
    "unknown"
  ],
  "contactReasons": [
    "startup",
    "page"
  ],
  "sites": [
    "youtube",
    "instagram"
  ],
  "topicModes": [
    "off",
    "only",
    "block"
  ],
  "features": [
    {
      "key": "ytHomeFeed",
      "site": "youtube",
      "group": "Browsing",
      "label": "Hide the home feed",
      "description": "youtube.com opens to a quiet page. Search still works.",
      "defaultEnabled": true
    },
    {
      "key": "ytShorts",
      "site": "youtube",
      "group": "Browsing",
      "label": "Hide Shorts",
      "description": "Removes Shorts shelves, tabs and links. A Shorts link opens in the normal player instead.",
      "defaultEnabled": true
    },
    {
      "key": "ytExplore",
      "site": "youtube",
      "group": "Browsing",
      "label": "Hide Explore and Trending",
      "defaultEnabled": true
    },
    {
      "key": "ytRelated",
      "site": "youtube",
      "group": "While watching",
      "label": "Hide recommended videos next to the player",
      "defaultEnabled": true
    },
    {
      "key": "ytEndScreen",
      "site": "youtube",
      "group": "While watching",
      "label": "Hide end-of-video suggestions",
      "description": "The video wall at the end, clickable end cards and the “more videos” grid.",
      "defaultEnabled": true
    },
    {
      "key": "ytComments",
      "site": "youtube",
      "group": "While watching",
      "label": "Hide comments",
      "defaultEnabled": false
    },
    {
      "key": "igFollowingFeed",
      "site": "instagram",
      "group": "Feed",
      "label": "Show only accounts you follow",
      "description": "Home opens the Following feed: newest first, no suggested posts.",
      "defaultEnabled": true
    },
    {
      "key": "igReels",
      "site": "instagram",
      "group": "Feed",
      "label": "Hide Reels",
      "description": "Removes the Reels tab and sends the Reels page back to your feed. Reels someone sends you still open.",
      "defaultEnabled": true
    },
    {
      "key": "igExplore",
      "site": "instagram",
      "group": "Feed",
      "label": "Hide Explore",
      "description": "Removes the grid of recommended posts from the Search page and closes place pages. Search still works.",
      "defaultEnabled": true
    },
    {
      "key": "igSuggested",
      "site": "instagram",
      "group": "Feed",
      "label": "Hide suggested accounts",
      "defaultEnabled": true
    }
  ],
  "topicPresets": [
    {
      "name": "AI",
      "keywords": [
        "AI",
        "A.I.",
        "artificial intelligence",
        "machine learning",
        "deep learning",
        "neural network",
        "neural networks",
        "LLM",
        "LLMs",
        "large language model",
        "AGI",
        "GPT",
        "ChatGPT",
        "OpenAI",
        "Claude",
        "Anthropic",
        "Gemini",
        "DeepMind",
        "Copilot",
        "Midjourney",
        "Stable Diffusion",
        "Hugging Face",
        "prompt engineering"
      ]
    },
    {
      "name": "Gaming",
      "keywords": [
        "gaming",
        "gameplay",
        "gamer",
        "gamers",
        "let's play",
        "walkthrough",
        "playthrough",
        "speedrun",
        "esports",
        "Minecraft",
        "Fortnite",
        "Roblox",
        "GTA",
        "Call of Duty",
        "Valorant",
        "League of Legends",
        "Counter-Strike",
        "Overwatch",
        "Apex Legends",
        "Elden Ring",
        "Pokémon",
        "Zelda",
        "Nintendo",
        "PlayStation",
        "Xbox",
        "boss fight"
      ]
    },
    {
      "name": "Programming",
      "keywords": [
        "programming",
        "coding",
        "programmer",
        "software engineering",
        "software engineer",
        "web development",
        "computer science",
        "JavaScript",
        "TypeScript",
        "Python",
        "C++",
        "algorithms",
        "data structures",
        "LeetCode",
        "GitHub",
        "Linux"
      ]
    },
    {
      "name": "Sports",
      "keywords": [
        "football",
        "soccer",
        "basketball",
        "baseball",
        "tennis",
        "golf",
        "cricket",
        "rugby",
        "boxing",
        "NBA",
        "NFL",
        "MLB",
        "NHL",
        "UFC",
        "F1",
        "Formula 1",
        "Premier League",
        "Champions League",
        "World Cup",
        "Olympics"
      ]
    },
    {
      "name": "Politics",
      "keywords": [
        "politics",
        "political",
        "election",
        "elections",
        "president",
        "prime minister",
        "congress",
        "senate",
        "parliament",
        "government",
        "democrats",
        "republicans",
        "breaking news"
      ]
    },
    {
      "name": "Music",
      "keywords": [
        "music video",
        "official video",
        "official audio",
        "lyrics",
        "lyric video",
        "album",
        "song",
        "songs",
        "concert",
        "remix",
        "live performance"
      ]
    },
    {
      "name": "Investing",
      "keywords": [
        "investing",
        "investment",
        "stocks",
        "stock market",
        "ETF",
        "dividend",
        "dividends",
        "trading",
        "crypto",
        "bitcoin",
        "ethereum",
        "personal finance",
        "passive income",
        "real estate"
      ]
    },
    {
      "name": "Movies and TV",
      "keywords": [
        "movie",
        "movies",
        "film",
        "trailer",
        "season finale",
        "Netflix",
        "Marvel",
        "box office"
      ]
    },
    {
      "name": "Science",
      "keywords": [
        "science",
        "scientist",
        "scientists",
        "physics",
        "chemistry",
        "biology",
        "astronomy",
        "mathematics",
        "math",
        "quantum",
        "NASA",
        "evolution"
      ]
    },
    {
      "name": "Fitness",
      "keywords": [
        "workout",
        "fitness",
        "gym",
        "bodybuilding",
        "cardio",
        "strength training",
        "calisthenics",
        "yoga",
        "weight loss"
      ]
    },
    {
      "name": "Cooking",
      "keywords": [
        "recipe",
        "recipes",
        "cooking",
        "baking",
        "chef",
        "how to cook",
        "street food"
      ]
    },
    {
      "name": "Drama and reactions",
      "keywords": [
        "drama",
        "reaction",
        "reacts",
        "reacting",
        "exposed",
        "prank",
        "pranks",
        "storytime"
      ]
    }
  ],
  "defaults": {
    "sites": {
      "youtube": true,
      "instagram": true
    },
    "features": {
      "ytHomeFeed": true,
      "ytShorts": true,
      "ytExplore": true,
      "ytRelated": true,
      "ytEndScreen": true,
      "ytComments": false,
      "igFollowingFeed": true,
      "igReels": true,
      "igExplore": true,
      "igSuggested": true
    },
    "youtubeFilters": {
      "blockedKeywords": [],
      "blockedChannels": [],
      "allowedChannels": [],
      "onlyAllowedChannels": false,
      "topicMode": "off",
      "topics": []
    }
  }
}
"""#
}
