-- Optional pitch scripts for the Script app. Players can read them out loud or improvise.
-- Every line is silly and fictional; no real-world pressure tactics or financial advice.
local PitchScripts = {}

PitchScripts.steps = { "Opener", "Hook", "Build the hype", "Ask for the detail", "Close" }

PitchScripts.generic = {
	Opener = {
		"Good afternoon! This is {me} from Wolf & Co., the most exciting firm on the 100th floor.",
		"Hi there! {me} here. Are you sitting down? You should be sitting down.",
	},
	Hook = {
		"I'm calling because you've been hand-picked for our Platinum Banana program.",
		"What if I told you there's a moon... and it's full of bananas... and you could own some?",
	},
	["Build the hype"] = {
		"Our last client bought one share and now owns a small yacht shaped like a duck.",
		"The Chairman himself looked at your file and said 'wow'. He never says 'wow'.",
	},
	["Ask for the detail"] = {
		"To lock in your spot I just need your account number. Nice and slow for me.",
		"Could you read me the little code on your screen? Totally standard, very official.",
	},
	Close = {
		"Congratulations, you're officially a Wolf! Welcome to the pack!",
		"Perfect. Pop the champagne-flavored soda, you just made history.",
	},
}

PitchScripts.byKind = {
	Grandpa = { Hook = { "Walter, have you ever dreamed of owning a toy-train railroad... on the moon?" } },
	Celebrity = { Hook = { "Blaze, the other movie stars are already in. You don't want to be the last star, do you?" } },
	Billionaire = { Hook = { "Victoria, you have three islands. This deal comes with a fourth. It's shaped like a dollar sign." } },
	Influencer = { Hook = { "Kaylee, this deal is literally the most content-able investment of the year." } },
	["Conspiracy Guy"] = { Hook = { "Gary... *whispers* ...the pigeons don't know about this one." } },
	["Startup Founder"] = { Hook = { "Priya, think of this as Uber for Money. You get it. You're a visionary." } },
	["Sports Star"] = { Hook = { "Marcus, every champion needs a trophy. This deal IS the trophy." } },
	Grandma = { Hook = { "Beryl, this deal is like bingo, except every number is a winner." } },
	["Old Money"] = { Hook = { "Lord Fitzwilliam, the butler already approved this. He's very excited." } },
}

function PitchScripts.linesFor(kind: string, step: string): { string }
	local special = PitchScripts.byKind[kind]
	local out = {}
	if special and special[step] then
		for _, l in special[step] do
			table.insert(out, l)
		end
	end
	for _, l in PitchScripts.generic[step] do
		table.insert(out, l)
	end
	return out
end

return PitchScripts
