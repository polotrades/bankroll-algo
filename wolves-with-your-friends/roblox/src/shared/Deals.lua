-- Deal apps: the client says a detail out loud, the player types it in, Verify pays out.
-- All data is fictional and never uses real-world formats like Social Security numbers.
local Deals = {}

Deals.list = {
	{
		id = "account",
		app = "Account Opener",
		title = "Account Opener",
		subtitle = "Open a Wolf & Co. trading account for the client.",
		field = "Client account number (####-####)",
		secretLabel = "account number",
		pattern = "####-####",
		payout = 250,
		color = Color3.fromRGB(200, 40, 60),
	},
	{
		id = "tradelink",
		app = "TradeLink",
		title = "TradeLink Remote Desk",
		subtitle = "Connect to the client's brokerage terminal.",
		field = "One-time TradeLink PIN (###-###)",
		secretLabel = "TradeLink PIN",
		pattern = "###-###",
		payout = 400,
		color = Color3.fromRGB(40, 110, 220),
	},
	{
		id = "pennystock",
		app = "Penny Stock Order",
		title = "Penny Stock Order",
		subtitle = "Sell the client shares of Banana Moon Mining Co.",
		field = "Client order code (AA-####)",
		secretLabel = "order code",
		pattern = "AA-####",
		payout = 600,
		color = Color3.fromRGB(240, 170, 20),
	},
}

Deals.byId = {}
for _, d in Deals.list do
	Deals.byId[d.id] = d
end

local LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"

function Deals.generate(pattern: string, rng: Random): string
	local out = {}
	for ch in pattern:gmatch(".") do
		if ch == "#" then
			table.insert(out, tostring(rng:NextInteger(0, 9)))
		elseif ch == "A" then
			local i = rng:NextInteger(1, #LETTERS)
			table.insert(out, LETTERS:sub(i, i))
		else
			table.insert(out, ch)
		end
	end
	return table.concat(out)
end

-- "1832-8465", "1832 8465", "one eight..." typed as digits all match: compare letters and digits only.
function Deals.normalize(s: string): string
	return (s:upper():gsub("[^%w]", ""))
end

return Deals
