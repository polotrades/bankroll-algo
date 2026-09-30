-- One place that lists every RemoteEvent. The server creates them; clients wait for them.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local NAMES = {
	"Status", -- server -> all: { state, timeLeft, day, team, quota }
	"Money", -- server -> player: { personal }
	"Toast", -- server -> player/all: text popups
	"CallOpen", -- server -> player: a call is now on your screen
	"CallUpdate", -- server -> player: new transcript line / trust / waiting state
	"CallClosed", -- server -> player: call ended (reason)
	"Say", -- player -> server: something the player said (voice transcript or typed)
	"HangUp", -- player -> server
	"LeaveDesk", -- player -> server
	"Verify", -- player -> server: (dealId, value)
	"VerifyResult", -- server -> player: (dealId, ok, message, payout)
	"Meeting", -- server -> all: meeting phases
	"Vote", -- player -> server: quote index
	"Report", -- server -> all: final statement
}

local Net = {}

local folder: Folder
if RunService:IsServer() then
	folder = ReplicatedStorage:FindFirstChild("Remotes") or Instance.new("Folder")
	folder.Name = "Remotes"
	folder.Parent = ReplicatedStorage
	for _, n in NAMES do
		if not folder:FindFirstChild(n) then
			local e = Instance.new("RemoteEvent")
			e.Name = n
			e.Parent = folder
		end
	end
else
	folder = ReplicatedStorage:WaitForChild("Remotes") :: Folder
end

for _, n in NAMES do
	Net[n] = folder:WaitForChild(n)
end

return Net
