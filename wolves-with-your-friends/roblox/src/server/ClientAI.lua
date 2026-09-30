-- AI clients: one Roblox TextGenerator per call, remembering the conversation through ContextToken.
-- Replies come back as JSON { reply, interest_change, hang_up }. If the API fails, canned lines take over
-- so the game still works.
local HttpService = game:GetService("HttpService")
local ServerStorage = game:GetService("ServerStorage")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared:WaitForChild("Config"))
local Clients = require(Shared:WaitForChild("Clients"))
local Deals = require(Shared:WaitForChild("Deals"))

local ClientAI = {}

local SCHEMA = HttpService:JSONEncode({
	type = "object",
	properties = {
		reply = { type = "string" },
		interest_change = { type = "integer", minimum = -20, maximum = 20 },
		hang_up = { type = "boolean" },
	},
	required = { "reply", "interest_change", "hang_up" },
	additionalProperties = false,
})

local function systemPrompt(profile, secrets): string
	local details = {}
	for _, d in Deals.list do
		table.insert(details, string.format("your %s is %s", d.secretLabel, secrets[d.id]))
	end
	return table.concat({
		string.format("You are %s, %s.", Clients.displayName(profile), profile.persona),
		"You are a fictional character in a silly cartoon comedy game. A broker from Wolf & Co. is calling you",
		"to sell you ridiculous, obviously fake investments (like banana farms on the moon).",
		"Stay in character and be funny. Every reply is at most 2 short sentences and under 200 characters.",
		"Keep it family friendly. Never give real financial advice and never mention real companies or people.",
		"Your private, completely made-up details: " .. table.concat(details, "; ") .. ".",
		string.format("Each message starts with your current interest level from 0 to 100. Below %d, you are skeptical", Config.REVEAL_TRUST),
		string.format("and never share any detail. At %d or above, if the broker asks for one of your details, share it", Config.REVEAL_TRUST),
		"and read it out exactly with its dashes.",
		"Raise interest (up to +20) when the broker is funny, confident, flattering or creative. Lower it (down to -20)",
		"when they are rude, boring, repetitive or pushy. Hang up if the broker is very rude or your interest is 0.",
		"If a note says a different broker grabbed the phone, react to that with surprise.",
		"Answer only with the JSON object.",
	}, " ")
end

export type Call = {
	profile: any,
	secrets: { [string]: string },
	trust: number,
	gen: TextGenerator?,
	contextToken: string?,
	pendingNote: string?,
}

function ClientAI.start(call: Call)
	local gen = Instance.new("TextGenerator")
	gen.SystemPrompt = systemPrompt(call.profile, call.secrets)
	gen.Temperature = Config.AI_TEMPERATURE
	gen.Parent = ServerStorage
	call.gen = gen
end

function ClientAI.stop(call: Call)
	if call.gen then
		call.gen:Destroy()
		call.gen = nil
	end
end

local function clampReply(s: string): string
	s = s:gsub("%s+", " ")
	if #s > Config.TTS_MAX_CHARS - 20 then
		s = s:sub(1, Config.TTS_MAX_CHARS - 23) .. "..."
	end
	return s
end

-- Used when the AI service is unavailable: simple lines that still follow the game rules.
local function canned(call: Call, text: string)
	local t = text:lower()
	local delta = 4
	if #t > 60 then
		delta += 3
	end
	if t:find("please") or t:find("thank") or t:find("amazing") or t:find("love") then
		delta += 4
	end
	if t:find("stupid") or t:find("shut up") or t:find("idiot") then
		delta = -15
	end
	local asked
	for _, d in Deals.list do
		local key = d.secretLabel:lower()
		if t:find(key) or (d.id == "account" and t:find("account")) or (d.id == "tradelink" and t:find("pin"))
			or (d.id == "pennystock" and t:find("code")) then
			asked = d
			break
		end
	end
	local newTrust = call.trust + delta
	if asked and newTrust >= Config.REVEAL_TRUST then
		return { reply = string.format("Oh, fine! My %s is %s. Don't tell my cat.", asked.secretLabel, call.secrets[asked.id]),
			interest_change = delta, hang_up = false }
	elseif asked then
		return { reply = "Whoa there, I barely know you. Why should I give you that?", interest_change = delta - 3, hang_up = false }
	end
	local lines = newTrust < 30 and { "Hmm. Who is this again?", "I'm not sure about this, sonny.", "Is this about my car's warranty?" }
		or newTrust < 60 and { "Okay, now you've got my attention.", "Bananas on the moon? Go on...", "Tell me more, I'm listening!" }
		or { "I love it! What do you need from me?", "You're my favorite broker ever!", "Let's do it, I'm IN!" }
	return { reply = lines[math.random(1, #lines)], interest_change = delta, hang_up = newTrust <= 0 }
end

-- Returns { reply: string, interest_change: number, hang_up: boolean }
function ClientAI.respond(call: Call, speaker: string, text: string)
	local prompt = string.format("[Interest: %d/100] ", call.trust)
	if call.pendingNote then
		prompt ..= "[Note: " .. call.pendingNote .. "] "
		call.pendingNote = nil
	end
	prompt ..= string.format("[%s says]: %s", speaker, text)

	local result
	if call.gen then
		local ok, response = pcall(function()
			return (call.gen :: TextGenerator):GenerateTextAsync({
				UserPrompt = prompt,
				ContextToken = call.contextToken,
				MaxTokens = Config.AI_MAX_TOKENS,
				JsonSchema = SCHEMA,
			})
		end)
		if ok and response and response.GeneratedText then
			call.contextToken = response.ContextToken
			local okJson, data = pcall(HttpService.JSONDecode, HttpService, response.GeneratedText)
			if okJson and type(data) == "table" and type(data.reply) == "string" then
				result = data
			else
				result = { reply = response.GeneratedText, interest_change = 3, hang_up = false }
			end
		else
			warn("[ClientAI] TextGenerator failed, using canned lines:", response)
		end
	end
	result = result or canned(call, text)
	result.reply = clampReply(tostring(result.reply))
	result.interest_change = math.clamp(tonumber(result.interest_change) or 0, -20, 20)
	result.hang_up = result.hang_up == true
	return result
end

function ClientAI.greet(call: Call)
	return ClientAI.respond(call, "System", "The phone rings and you pick up. Greet the caller in character.")
end

return ClientAI
