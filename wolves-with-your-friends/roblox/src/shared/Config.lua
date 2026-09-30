-- Tuning numbers for the whole game. Change these while playtesting.
local Config = {}

Config.MAX_PLAYERS = 10
Config.INTERMISSION = 10 -- seconds before the first day starts
Config.DAY_LENGTH = 600 -- one workday = 10 minutes
Config.MEETING_VOTE_TIME = 15
Config.MEETING_VERDICT_TIME = 8
Config.FIRED_TIME = 20

-- Daily target curve (day 1, day 2, ...). Past the end of the list it grows 30% a day.
Config.QUOTAS = { 600, 1400, 1750, 2600, 3400, 4400, 5600, 7000 }
function Config.quotaFor(day: number): number
	if day <= #Config.QUOTAS then
		return Config.QUOTAS[day]
	end
	return math.floor(Config.QUOTAS[#Config.QUOTAS] * 1.3 ^ (day - #Config.QUOTAS))
end

-- Calls
Config.RING_TIMEOUT = 8 -- seconds a desk rings before the call jumps to another desk
Config.RING_MAX_JUMPS = 3 -- after this many jumps the client gives up
Config.RING_GAP_MIN = 5 -- seconds between new calls
Config.RING_GAP_MAX = 12
Config.START_TRUST = 25
Config.REVEAL_TRUST = 60 -- clients are told to share details above this interest level

-- AI
Config.AI_MAX_TOKENS = 160
Config.AI_TEMPERATURE = 0.85
Config.TTS_MAX_CHARS = 300 -- Roblox text-to-speech limit per request

-- Money
Config.VOTE_BONUS = 500 -- funniest-moment winner
Config.TARGET_BONUS = 100 -- every player, when the target is met

-- Optional sound asset ids (Creator Store). Leave "" to skip.
Config.RING_SOUND_ID = ""
Config.CHEER_SOUND_ID = ""

return Config
