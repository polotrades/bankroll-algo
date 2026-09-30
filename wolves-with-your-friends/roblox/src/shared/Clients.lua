-- AI client personalities. Everyone here is fictional.
-- voice = Roblox text-to-speech VoiceId ("1".."11"), pitch/speed tune the voice.
local Clients = {}

Clients.list = {
	{
		id = "grandpa",
		name = "Walter",
		nickname = "Wally",
		surname = "Pemberton",
		kind = "Grandpa",
		voice = "3",
		pitch = 0.85,
		speed = 0.85,
		color = Color3.fromRGB(150, 170, 200),
		persona = "an 84-year-old retired toy-train collector who tells long stories, mishears words, and trusts anyone who sounds polite",
	},
	{
		id = "celebrity",
		name = "Chad",
		nickname = "Blaze",
		surname = "Montana",
		kind = "Celebrity",
		voice = "5",
		pitch = 1.0,
		speed = 1.1,
		color = Color3.fromRGB(240, 180, 60),
		persona = "a B-list action movie star who name-drops constantly, is easily distracted, and demands VIP treatment",
	},
	{
		id = "billionaire",
		name = "Victoria",
		nickname = "Vault",
		surname = "Sterling",
		kind = "Billionaire",
		voice = "2",
		pitch = 1.0,
		speed = 0.95,
		color = Color3.fromRGB(60, 60, 70),
		persona = "a bored British billionaire who owns three islands, tests brokers with ridiculous questions, and only respects confidence",
	},
	{
		id = "influencer",
		name = "Kaylee",
		nickname = "K-Rizz",
		surname = "Rivers",
		kind = "Influencer",
		voice = "6",
		pitch = 1.15,
		speed = 1.2,
		color = Color3.fromRGB(255, 120, 200),
		persona = "a hyperactive lifestyle influencer who talks fast, wants every deal to be 'content', and says 'literally' a lot",
	},
	{
		id = "conspiracy",
		name = "Gary",
		nickname = "Tinfoil",
		surname = "Dobbs",
		kind = "Conspiracy Guy",
		voice = "9",
		pitch = 0.9,
		speed = 1.05,
		color = Color3.fromRGB(120, 200, 120),
		persona = "a suspicious man who thinks pigeons are government drones, loves 'secret' deals, and whispers important words",
	},
	{
		id = "founder",
		name = "Priya",
		nickname = "Pivot",
		surname = "Shah",
		kind = "Startup Founder",
		voice = "4",
		pitch = 1.0,
		speed = 1.15,
		color = Color3.fromRGB(90, 140, 255),
		persona = "a startup founder who keeps pitching her own app (Uber for Sandwiches) back at the broker and uses buzzwords",
	},
	{
		id = "sportsstar",
		name = "Marcus",
		nickname = "Slam",
		surname = "Johnson",
		kind = "Sports Star",
		voice = "5",
		pitch = 0.8,
		speed = 1.0,
		color = Color3.fromRGB(255, 90, 60),
		persona = "a hyper-competitive pro basketball player who treats every conversation like a game he must win",
	},
	{
		id = "aussiegran",
		name = "Beryl",
		nickname = "Bingo",
		surname = "Walsh",
		kind = "Grandma",
		voice = "8",
		pitch = 1.05,
		speed = 0.9,
		color = Color3.fromRGB(200, 160, 230),
		persona = "a cheerful Australian grandma and bingo champion who calls everyone 'love' and keeps offering to send biscuits",
	},
	{
		id = "lord",
		name = "Reginald",
		nickname = "Monocle",
		surname = "Fitzwilliam",
		kind = "Old Money",
		voice = "1",
		pitch = 0.9,
		speed = 0.9,
		color = Color3.fromRGB(170, 120, 70),
		persona = "an extremely posh lord who has never used a phone before and keeps asking where the butler went",
	},
}

function Clients.displayName(c): string
	return string.format('%s "%s" %s', c.name, c.nickname, c.surname)
end

function Clients.random(rng: Random?)
	local r = rng or Random.new()
	return Clients.list[r:NextInteger(1, #Clients.list)]
end

return Clients
